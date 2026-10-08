// Baut eine eigenständige Testseite (eine einzige HTML-Datei) aus dem echten Code und den echten Inhalten:
// Klassenstufen, Themen, Verstehen-Seiten mit interaktiven Erklärungen und alle Übungen.
// Läuft ohne Server, ohne Login und ohne Installation – einfach im Browser öffnen.
// Der Fortschritt wird nur im Browser gespeichert.
//
// Aufruf: npm run testseite   →  erzeugt testseite.html im Projektordner
//
// Hinweis: In der Testseite stehen die Lösungen im Quelltext. Sie ist zum Ausprobieren
// gedacht, nicht als Ersatz für die echte Lernseite.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config } from '../src/config.js';
import { loadContent } from '../src/physik.js';

const out = process.argv[2] || path.join(ROOT, 'testseite.html');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---------------------------------------------------------------- Inhalte
const content = loadContent();
if (content.errors.length) { console.error('Fehler in den Inhalten:\n  ' + content.errors.join('\n  ')); process.exit(1); }
const stufen = content.stufen.filter(s => s.themenfelder.length);

// ---------------------------------------------------------------- Interaktive Erklärungen einbetten
const kitCss = read('public/lesson-kit.css');
const kitJs = read('public/lesson-kit.js').replace(/<\/script/gi, '<\\/script');   // darf das eingebettete <script> nicht beenden
const lessons = {};
const slugs = new Set(stufen.flatMap(s => s.themenfelder.flatMap(tf => tf.topics.flatMap(t => [...t.interaktiv, ...t.vertiefung]))));
for (const slug of slugs) {
  const dir = path.join(config.lessonsDir, slug);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8')); } catch {}
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet" href="\.\.\/\.\.\/static\/lesson-kit\.css">/, () => `<style>${kitCss}</style>`)
    .replace(/<script src="\.\.\/\.\.\/static\/lesson-kit\.js"><\/script>/, () => `<script>${kitJs}</script>`);
  lessons[slug] = { slug, title: meta.title || slug, description: meta.description || '', html };
}

// ---------------------------------------------------------------- Echten Code für den Browser zusammensetzen
const asScript = f => read(f).split('\n').filter(l => !/^import\s/.test(l)).join('\n').replace(/^export\s+(?=(const|function|let|class|async)\b)/gm, '');
const appCode = ['src/markup.js', 'src/exercises.js', 'src/progress.js', 'src/views-physik.js'].map(f => `// ---- ${f}\n${asScript(f)}`).join('\n\n');
const uebung = read('public/uebung.js').replace(/^\(function \(\) \{/m, 'function initUebung() {').replace(/^\}\)\(\);\s*$/m, '}');

const json = v => JSON.stringify(v).replace(/</g, '\\u003c');

const shell = /* js */ `
// ---------------------------------------------------------------- Testseite: Daten, Speicher, nachgebauter Server
const STUFEN = ${json(stufen)};
const LESSONS = ${json(lessons)};
const topicById = new Map(), exerciseById = new Map();
for (const g of STUFEN) for (const tf of g.themenfelder) for (const t of tf.topics) { topicById.set(t.id, t); for (const e of t.uebungen) exerciseById.set(e.id, e); }

const KEY = 'lernseite-testseite';
let state = { attempts: [], understood: [], lessons: [], klasse: '9a' };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state = Object.assign(state, s); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

function sets() {
  const solved = new Set(), revealed = new Set();
  for (const a of state.attempts) { if (a.r) revealed.add(a.e); else if (a.c && !revealed.has(a.e)) solved.add(a.e); }
  return { solved, understood: new Set(state.understood) };
}
const user = () => ({ name: 'Testschüler', username: 'test', role: 'student', klasse: state.klasse || null });
const status = t => { const s = sets(); return topicProgress(topicById.get(t), s.solved, s.understood); };

// Nachbau der Server-API (gleiche Antworten wie server.js)
const realFetch = window.fetch.bind(window);
window.fetch = async function (url, opts) {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const body = opts && opts.body ? JSON.parse(opts.body) : {};
  const reply = (data, code) => new Response(JSON.stringify(data), { status: code || 200, headers: { 'Content-Type': 'application/json' } });
  let m;
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    if (!ex) return reply({ error: 'Diese Aufgabe gibt es nicht.' }, 404);
    const r = checkAnswer(ex, body.antwort || {});
    if (r.error) return reply({ error: r.error }, 400);
    if (r.status !== 'selbst') { state.attempts.push({ e: ex.id, c: r.status === 'richtig' ? 1 : 0 }); save(); }
    return reply(Object.assign({}, r, { fortschritt: status(ex.topicId) }));
  }
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)\\/loesung$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    state.attempts.push({ e: ex.id, c: 0, r: 1 }); save();
    return reply(Object.assign({}, revealSolution(ex), { fortschritt: status(ex.topicId) }));
  }
  if ((m = u.match(/^\\/api\\/uebung\\/([^/]+)\\/selbst$/))) {
    const ex = exerciseById.get(decodeURIComponent(m[1]));
    state.attempts.push({ e: ex.id, c: body.ok ? 1 : 0 }); save();
    return reply({ status: body.ok ? 'richtig' : 'falsch', fortschritt: status(ex.topicId) });
  }
  if ((m = u.match(/^\\/api\\/verstanden\\/([^/]+)$/))) {
    const t = decodeURIComponent(m[1]);
    state.understood = state.understood.filter(x => x !== t);
    if (body.done !== false) state.understood.push(t);
    save();
    return reply({ ok: true, fortschritt: status(t) });
  }
  if (u === '/api/fortschritt') {
    if (body.done && !state.lessons.includes(body.slug)) state.lessons.push(body.slug);
    save();
    return reply({ ok: true });
  }
  return reply({ error: 'unbekannt' }, 404);
};

// ---------------------------------------------------------------- Seitenrahmen (ersetzt views.js)
function layout({ title, body }) {
  document.title = (title ? title + ' · ' : '') + 'Lernseite – Testseite';
  const klassen = ['', '7a', '8a', '9a', '10a'];
  return \`
  <div class="test-banner">
    <strong>Testseite</strong> · ohne Server und Login · Fortschritt nur in diesem Browser
    <label>Simulierte Klasse <select id="tKlasse">\${klassen.map(k => \`<option value="\${k}" \${k === (state.klasse || '') ? 'selected' : ''}>\${k || 'keine'}</option>\`).join('')}</select></label>
    <button type="button" id="tReset" class="link">Fortschritt zurücksetzen</button>
  </div>
  <nav class="top" aria-label="Hauptmenü">
    <a class="brand" href="/physik">Lernseite</a>
    <div class="nav-right"><a href="/physik">Physik</a><span class="who">Testschüler\${state.klasse ? ' · ' + esc(state.klasse) : ''}</span></div>
  </nav>
  <main id="inhalt">\${body}</main>\`;
}

// ---------------------------------------------------------------- Seiten
const lessonList = slugs => slugs.map(s => LESSONS[s]).filter(Boolean);
function page(p) {
  const s = sets(), grades = STUFEN, parts = p.split('/').filter(Boolean);
  const lessonDone = new Set(state.lessons);
  if (!parts.length || (parts.length === 1 && parts[0] === 'physik')) return gradePickerPage({ user: user(), grades, own: gradeOf(state.klasse), sets: s });
  if (parts[0] === 'lektion' && LESSONS[parts[1]]) {
    const l = LESSONS[parts[1]];
    return layout({ title: l.title, body: \`<div class="lesson-bar"><a href="javascript:history.back()" class="back">← zurück</a><h1>\${esc(l.title)}</h1></div>
      <iframe id="lesson" data-slug="\${esc(l.slug)}" title="\${esc(l.title)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>\` });
  }
  if (parts[0] === 'physik') {
    const grade = grades.find(g => g.stufe === Number(parts[1]));
    if (grade && parts.length === 2) return gradePage({ user: user(), grade, grades, sets: s });
    const topic = topicById.get(parts[2]);
    if (grade && topic && topic.stufe === grade.stufe) {
      const all = topicsOfGrade(grade);
      const ctx = { user: user(), grade, topic, sets: s, progress: topicProgress(topic, s.solved, s.understood), nextTopic: all[all.indexOf(topic) + 1] || null };
      if (parts.length === 3) return topicUnderstandPage(Object.assign(ctx, { lessons: lessonList(topic.interaktiv), extras: lessonList(topic.vertiefung), lessonDone }));
      if (parts[3] === 'ueben') {
        const stats = new Map();
        for (const a of state.attempts) { if (exerciseById.get(a.e)?.topicId !== topic.id) continue; const x = stats.get(a.e) || { versuche: 0 }; x.versuche++; stats.set(a.e, x); }
        return topicPracticePage(Object.assign(ctx, { solved: s.solved, stats }));
      }
    }
  }
  return layout({ title: 'Nicht gefunden', body: '<section class="login"><h1>Nicht gefunden</h1><p><a class="btn" href="/physik">Zur Übersicht</a></p></section>' });
}

function render() {
  const p = decodeURIComponent(location.hash.slice(1)) || '/physik';
  const html = page(p);
  const app = document.getElementById('app');
  app.innerHTML = html.replace(/^[\\s\\S]*<body[^>]*>|<\\/body>[\\s\\S]*$/g, '');
  // Eingebettete Erklärungen aus den mitgelieferten Dateien laden
  app.querySelectorAll('iframe').forEach(f => {
    const m = (f.getAttribute('src') || '').match(/^\\/inhalt\\/([^/]+)\\//);
    const slug = m ? m[1] : f.dataset.slug;
    if (LESSONS[slug]) { f.removeAttribute('src'); f.srcdoc = LESSONS[slug].html; }
  });
  app.querySelectorAll('a[target=_blank]').forEach(a => a.removeAttribute('target'));
  const k = document.getElementById('tKlasse');
  if (k) k.onchange = () => { state.klasse = k.value; save(); render(); };
  const r = document.getElementById('tReset');
  if (r) r.onclick = () => { if (confirm('Gesamten Test-Fortschritt löschen?')) { state = { attempts: [], understood: [], lessons: [], klasse: state.klasse }; save(); render(); } };
  initUebung();
}

// Interne Links (/physik/…) als Sprungmarken (#/physik/…) behandeln
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  location.hash = a.getAttribute('href');
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
// Vollbild-Erklärung meldet „erledigt“
window.addEventListener('message', e => {
  const f = document.getElementById('lesson');
  if (f && e.source === f.contentWindow && e.data && e.data.type === 'lernseite:erledigt') window.fetch('/api/fortschritt', { method: 'POST', body: JSON.stringify({ slug: f.dataset.slug, done: true }) });
});
render();
`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lernseite – Testseite</title>
<style>
${read('public/style.css')}
.test-banner { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; justify-content: center; padding: 6px 16px; font-size: .85rem; background: var(--warn-soft); color: var(--warn); }
.test-banner select { font: inherit; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); }
.test-banner .link { color: var(--warn); text-decoration: underline; }
#lesson { height: calc(100vh - 150px); }
</style>
</head>
<body>
<div id="app"></div>
<script>
(function () {
'use strict';
${appCode}

${uebung}

${shell}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(out, html);
const n = stufen.reduce((a, g) => a + g.themenfelder.reduce((b, tf) => b + tf.topics.length, 0), 0);
console.log(`✔ Testseite erstellt: ${path.relative(process.cwd(), out) || out} (${(html.length / 1024).toFixed(0)} KB, ${n} Themen, ${content.exerciseById.size} Übungen, ${Object.keys(lessons).length} interaktive Erklärungen)`);
