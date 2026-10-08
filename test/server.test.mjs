// Startet den Server mit einer leeren Test-Datenbank und prüft die wichtigsten Abläufe.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
let server, dataDir;

class Client {
  constructor() { this.cookies = new Map(); }
  async req(url, opts = {}) {
    const headers = { ...(opts.headers || {}), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (opts.method === 'POST') headers.origin = BASE;
    const r = await fetch(BASE + url, { ...opts, headers, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
    return r;
  }
  async login(username, role, email) {
    const body = new URLSearchParams({ username, role, email: email || `${username}@schule.de` });
    const r = await this.req('/auth/dev', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 302, 'Login sollte weiterleiten');
    return this;
  }
  json(url, body) { return this.req(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }); }
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lernseite-test-'));
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), BASE_URL: BASE, DATA_DIR: dataDir, DEV_LOGIN: 'true', ROSTER_REQUIRED: 'true', SESSION_SECRET: 'test-secret-123', ISERV_URL: '', ISERV_CLIENT_ID: '', ISERV_CLIENT_SECRET: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stderr.on('data', d => { log += d; });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', d => { log += d; if (String(d).includes('läuft auf Port')) resolve(); });
    server.on('exit', code => reject(new Error(`Server beendet (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`Server startet nicht:\n${log}`)), 8000);
  });
});

after(() => { server?.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('Ohne Anmeldung: Login-Seite, geschützte Seiten leiten um', async () => {
  const c = new Client();
  assert.match(await (await c.req('/')).text(), /Test-Login/);
  assert.equal((await c.req('/physik')).status, 302);
  assert.equal((await c.json('/api/uebung/k9-ss-01', { antwort: { wahl: '1' } })).status, 401);
});

test('Schülerliste, Klassenstufe, Übungen, Fortschritt und Lehrer-Übersicht', async () => {
  const admin = await new Client().login('chef', 'admin');
  const roster = 'E-Mail;Name;Klasse\nmax@schule.de;Max Muster;9a\nerika@schule.de;Erika Beispiel;10b';
  const up = await admin.req('/admin/schuelerliste', { method: 'POST', body: new URLSearchParams({ csv: roster }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(up.status, 302);

  // Nicht in der Liste → kein Zugang
  const r = await new Client().req('/auth/dev', { method: 'POST', body: new URLSearchParams({ username: 'fremd', role: 'student', email: 'fremd@schule.de' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 403);

  const max = await new Client().login('max', 'student', 'max@schule.de');
  const home = await (await max.req('/')).text();
  assert.match(home, /Physik lernen/);
  assert.match(home, /href="\/physik\/9"/, 'Startseite führt zur eigenen Klassenstufe');
  assert.doesNotMatch(home, /Stromkreis-Labor/, 'Themen-Lektionen erscheinen nicht doppelt auf der Startseite');

  const picker = await (await max.req('/physik')).text();
  for (const g of [7, 8, 9, 10]) assert.match(picker, new RegExp(`href="/physik/${g}"`));
  assert.doesNotMatch(picker, /href="\/physik\/5"/);
  assert.equal((await max.req('/physik/5')).status, 404);
  assert.match(picker, /Deine Klasse/);

  const k9 = await (await max.req('/physik/9')).text();
  assert.match(k9, /3\.6/); assert.match(k9, /Widerstand und ohmsches Gesetz/);
  const k10 = await (await max.req('/physik/10')).text();
  assert.match(k10, /In Vorbereitung/);

  const verstehen = await (await max.req('/physik/9/k9-ohmsches-gesetz')).text();
  assert.match(verstehen, /Das lernst du hier/);
  assert.match(verstehen, /\/inhalt\/k9-ohmsches-gesetz\/index\.html/);
  assert.match(verstehen, /class="frac"/);
  assert.equal((await max.req('/physik/10/k9-ohmsches-gesetz')).status, 404, 'Thema nur unter seiner Klassenstufe');

  const ueben = await (await max.req('/physik/9/k9-ohmsches-gesetz/ueben')).text();
  assert.match(ueben, /data-id="k9-oh-01"/);
  assert.doesNotMatch(ueben, /"richtig"|data-ok/, 'Lösungen dürfen nicht im Seitenquelltext stehen');

  // Falsch → kein Lösungstext; richtig → Lösung, Erklärung und Fortschritt
  let res = await (await max.json('/api/uebung/k9-oh-01', { antwort: { wahl: '0' } })).json();
  assert.equal(res.status, 'falsch'); assert.equal(res.loesung, undefined); assert.equal(res.fortschritt.done, 0);
  res = await (await max.json('/api/uebung/k9-oh-01', { antwort: { wahl: '1' } })).json();
  assert.equal(res.status, 'richtig'); assert.ok(res.erklaerung); assert.equal(res.fortschritt.done, 1);
  res = await (await max.json('/api/uebung/k9-oh-02', { antwort: { wert: '24' } })).json();
  assert.equal(res.status, 'richtig'); assert.equal(res.fortschritt.done, 2);

  // Lösung zeigen → spätere richtige Antwort zählt nicht
  res = await (await max.json('/api/uebung/k9-oh-04/loesung', {})).json();
  assert.equal(res.status, 'geloest');
  res = await (await max.json('/api/uebung/k9-oh-04', { antwort: { wahl: '0' } })).json();
  assert.equal(res.status, 'richtig'); assert.equal(res.fortschritt.done, 2);

  // Freitext + Selbsteinschätzung
  res = await (await max.json('/api/uebung/k9-oh-08', { antwort: { text: 'Die Atomrümpfe schwingen stärker, die Elektronen stoßen öfter.' } })).json();
  assert.equal(res.status, 'selbst');
  res = await (await max.json('/api/uebung/k9-oh-08/selbst', { ok: true })).json();
  assert.equal(res.fortschritt.done, 3);

  // Fehler verständlich
  const bad = await max.json('/api/uebung/k9-oh-02', { antwort: { wert: 'viel' } });
  assert.equal(bad.status, 400); assert.match((await bad.json()).error, /Zahl/);
  assert.equal((await max.json('/api/uebung/gibts-nicht', { antwort: {} })).status, 404);

  // Verstanden
  res = await (await max.json('/api/verstanden/k9-ohmsches-gesetz', { done: true })).json();
  assert.equal(res.fortschritt.verstanden, true);
  assert.match(await (await max.req('/physik/9')).text(), /✓ Verstanden/);

  // Schüler dürfen nicht in die Verwaltung
  assert.equal((await max.req('/admin')).status, 403);

  // Lehrkraft sieht den Fortschritt der Klasse 9a
  const teacher = await new Client().login('lehrer', 'teacher');
  const adm = await (await teacher.req('/admin?klasse=9a')).text();
  assert.match(adm, /Physik · Klasse 9/);
  assert.match(adm, /Max Muster/);
  assert.match(adm, /Widerstand und ohmsches Gesetz: 3\/10, verstanden/);
});

test('Bestehende Funktionen: Lektionen, alter Fortschritt, Inhalte nur angemeldet', async () => {
  const t = await new Client().login('lehrer2', 'teacher');
  assert.equal((await t.req('/lektion/dioden-schaltung')).status, 200);
  assert.equal((await t.req('/lektion/ohmsches-gesetz')).status, 200);
  assert.equal((await t.json('/api/fortschritt', { slug: 'ohmsches-gesetz', done: true })).status, 200);
  assert.equal((await t.req('/inhalt/k9-halbwertszeit/index.html')).status, 200);
  assert.equal((await new Client().req('/inhalt/k9-halbwertszeit/index.html')).status, 302);
  assert.equal((await t.req('/static/lesson-kit.js')).status, 200);
});

test('Anfragen von fremden Seiten werden abgelehnt', async () => {
  const c = await new Client().login('anna', 'teacher');
  const r = await fetch(BASE + '/api/verstanden/k9-ohmsches-gesetz', {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
  });
  assert.equal(r.status, 403);
});
