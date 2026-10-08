import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { loadContent, gradeOf, topicProgress } from '../src/physik.js';
import { checkAnswer, TYPES } from '../src/exercises.js';

const c = loadContent();

test('Inhalte laden ohne Fehler', () => {
  assert.deepEqual(c.errors, []);
  assert.ok(c.topicById.size >= 14);
  assert.ok(c.exerciseById.size >= 100);
});

test('Klassen 5 und 6 sind ohne Inhalte und damit ausgeblendet, 7 bis 10 sind sichtbar', () => {
  const visible = c.stufen.filter(s => s.themenfelder.length).map(s => s.stufe);
  assert.deepEqual(visible, [7, 8, 9, 10]);
});

test('Jedes Thema der Klasse 9 hat Lernziele, alle Schwierigkeitsgrade und gültige Verweise', () => {
  const k9 = c.stufen.find(s => s.stufe === 9);
  assert.equal(k9.themenfelder.length, 3);
  for (const tf of k9.themenfelder) for (const t of tf.topics) {
    assert.ok(t.lernziele.length >= 3, t.id);
    for (const d of ['leicht', 'mittel', 'schwer']) assert.ok(t.uebungen.some(e => e.schwierigkeit === d), `${t.id}: ${d}`);
    for (const slug of [...t.interaktiv, ...t.vertiefung]) assert.ok(fs.existsSync(path.join(config.lessonsDir, slug, 'index.html')), `${t.id}: ${slug}`);
  }
});

test('Die hinterlegte Lösung jeder Übung wird von der Engine als richtig erkannt', () => {
  for (const ex of c.exerciseById.values()) {
    let answer;
    switch (ex.typ) {
      case 'single': answer = { wahl: String(ex.optionen.findIndex(o => o.richtig)) }; break;
      case 'multi': answer = { wahl: ex.optionen.map((o, i) => (o.richtig ? String(i) : null)).filter(Boolean) }; break;
      case 'zahl': answer = { wert: String(ex.loesung).replace('.', ','), einheit: ex.einheit }; break;
      case 'zuordnung': answer = Object.fromEntries(ex.paare.map((_, i) => [`z${i}`, String(i)])); break;
      case 'reihenfolge': answer = { reihenfolge: ex.elemente.map((_, i) => String(i)) }; break;
      case 'text': continue;
      default: assert.fail(`Typ ${ex.typ} ohne Test`);
    }
    assert.equal(checkAnswer(ex, answer).status, 'richtig', ex.id);
  }
  assert.deepEqual(Object.keys(TYPES).sort(), ['multi', 'reihenfolge', 'single', 'text', 'zahl', 'zuordnung']);
});

test('Musterlösungen von Freitext-Aufgaben treffen ihre eigenen Stichworte', () => {
  for (const ex of c.exerciseById.values()) {
    if (ex.typ !== 'text') continue;
    const r = checkAnswer(ex, { text: ex.musterloesung.replace(/\*\*/g, '') });
    const hits = (r.feedback.match(/class="hit"/g) || []).length;
    assert.equal(hits, ex.stichworte.length, `${ex.id}: Musterlösung erfüllt nur ${hits}/${ex.stichworte.length} Aspekte`);
  }
});

test('Klassenstufe aus der Klassenbezeichnung', () => {
  assert.equal(gradeOf('10a'), 10);
  assert.equal(gradeOf('9'), 9);
  assert.equal(gradeOf(' 7b '), 7);
  assert.equal(gradeOf('Q1'), null);
  assert.equal(gradeOf(null), null);
});

test('Fortschritt eines Themas', () => {
  const t = c.topicById.get('k9-ohmsches-gesetz');
  const solved = new Set(t.uebungen.slice(0, 3).map(e => e.id));
  const p = topicProgress(t, solved, new Set(['k9-ohmsches-gesetz']));
  assert.equal(p.done, 3);
  assert.equal(p.total, t.uebungen.length);
  assert.equal(p.prozent, Math.round(300 / t.uebungen.length));
  assert.equal(p.verstanden, true);
});
