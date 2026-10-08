import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, checkAnswer, revealSolution, renderExercise, validateExercise } from '../src/exercises.js';
import { md } from '../src/markup.js';

const base = { schwierigkeit: 'leicht', frage: 'F?', erklaerung: 'E.' };

test('Zahlen werden wie in der Schule eingegeben gelesen', () => {
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('0.5'), 0.5);
  assert.equal(parseNumber('1 200'), 1200);
  assert.equal(parseNumber('10.000'), 10000);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('3,6·10^3'), 3600);
  assert.equal(parseNumber('2e-3'), 0.002);
  assert.equal(parseNumber('−4'), -4);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('')));
});

test('single: richtig, falsch mit Feedback, ohne Auswahl', () => {
  const ex = { ...base, id: 's', typ: 'single', optionen: [{ text: 'A', feedback: 'nein' }, { text: 'B', richtig: true }] };
  assert.deepEqual(validateExercise(ex), []);
  const ok = checkAnswer(ex, { wahl: '1' });
  assert.equal(ok.status, 'richtig');
  assert.ok(ok.loesung && ok.erklaerung);
  const bad = checkAnswer(ex, { wahl: '0' });
  assert.equal(bad.status, 'falsch');
  assert.match(bad.feedback, /nein/);
  assert.equal(bad.loesung, undefined, 'Lösung darf bei falscher Antwort nicht mitgeschickt werden');
  assert.ok(checkAnswer(ex, {}).error);
});

test('multi: teilweise richtig', () => {
  const ex = { ...base, id: 'm', typ: 'multi', optionen: [{ text: 'A', richtig: true }, { text: 'B', richtig: true }, { text: 'C' }] };
  assert.equal(checkAnswer(ex, { wahl: ['0', '1'] }).status, 'richtig');
  assert.equal(checkAnswer(ex, { wahl: '0' }).status, 'teilweise');
  assert.equal(checkAnswer(ex, { wahl: ['0', '2'] }).status, 'teilweise');
  assert.equal(checkAnswer(ex, { wahl: '2' }).status, 'falsch');
});

test('zahl: Toleranz, Einheitenumrechnung, Hinweise', () => {
  const ex = { ...base, id: 'z', typ: 'zahl', loesung: 0.02, einheit: 'A', alternativEinheiten: { mA: 0.001 }, rechenweg: ['x'] };
  assert.deepEqual(validateExercise(ex), []);
  assert.equal(checkAnswer(ex, { wert: '0,02', einheit: 'A' }).status, 'richtig');
  assert.equal(checkAnswer(ex, { wert: '20', einheit: 'mA' }).status, 'richtig');
  assert.equal(checkAnswer(ex, { wert: '0,0203', einheit: 'A' }).status, 'richtig', '2 % Toleranz');
  const wrongUnit = checkAnswer(ex, { wert: '20', einheit: 'A' });
  assert.equal(wrongUnit.status, 'falsch');
  assert.match(wrongUnit.feedback, /Einheiten/);
  assert.ok(checkAnswer(ex, { wert: 'zwanzig' }).error);
  const typedUnit = { ...base, id: 'z2', typ: 'zahl', loesung: 12, einheit: 'V', rechenweg: ['x'] };
  assert.equal(checkAnswer(typedUnit, { wert: '12 V' }).status, 'richtig');
});

test('text: Stichworte werden erkannt, Bewertung durch Selbsteinschätzung', () => {
  const ex = { ...base, id: 't', typ: 'text', musterloesung: 'M', stichworte: [{ aspekt: 'Stoß', woerter: ['stoß'] }, { aspekt: 'Wärme', woerter: ['wärme'] }] };
  const r = checkAnswer(ex, { text: 'Die Elektronen stoßen häufiger zusammen.' });
  assert.equal(r.status, 'selbst');
  assert.match(r.feedback, /1 von 2/);
  assert.match(r.loesung, /Musterlösung/);
  assert.ok(checkAnswer(ex, { text: 'kurz' }).error);
});

test('zuordnung und reihenfolge', () => {
  const z = { ...base, id: 'zu', typ: 'zuordnung', paare: [{ links: 'a', rechts: '1' }, { links: 'b', rechts: '2' }], extraRechts: ['3'] };
  assert.equal(checkAnswer(z, { z0: '0', z1: '1' }).status, 'richtig');
  assert.equal(checkAnswer(z, { z0: '0', z1: '2' }).status, 'teilweise');
  assert.ok(checkAnswer(z, { z0: '0' }).error);
  const o = { ...base, id: 'or', typ: 'reihenfolge', elemente: ['a', 'b', 'c'] };
  assert.equal(checkAnswer(o, { reihenfolge: ['0', '1', '2'] }).status, 'richtig');
  assert.equal(checkAnswer(o, { reihenfolge: ['1', '0', '2'] }).status, 'falsch');
  // Die angezeigte Startreihenfolge ist nie schon die Lösung
  const order = [...renderExercise(o).matchAll(/name="reihenfolge" value="(\d)"/g)].map(m => m[1]).join('');
  assert.notEqual(order, '012');
});

test('Lösung zeigen liefert Lösung und Erklärung', () => {
  const ex = { ...base, id: 's2', typ: 'single', optionen: [{ text: 'A', richtig: true }, { text: 'B' }] };
  const r = revealSolution(ex);
  assert.equal(r.status, 'geloest');
  assert.match(r.loesung, /A/);
});

test('Formel-Auszeichnung ist sicher und setzt Brüche, Indizes und Hochzahlen', () => {
  assert.equal(md('<script>'), '&lt;script&gt;');
  assert.match(md('\\frac{U}{I}'), /class="frac"/);
  assert.match(md('R_{ges}'), /<sub>ges<\/sub>/);
  assert.match(md('10^{3}'), /<sup>3<\/sup>/);
  assert.match(md('`U = R · I`'), /class="f"/);
});

test('Ungültige Übungen werden erkannt', () => {
  assert.ok(validateExercise({ id: 'x', typ: 'gibtsnicht', schwierigkeit: 'leicht', frage: 'f', erklaerung: 'e' }).length);
  assert.ok(validateExercise({ ...base, id: 'x', typ: 'single', optionen: [{ text: 'a' }, { text: 'b' }] }).length, 'keine richtige Option');
  assert.ok(validateExercise({ ...base, id: 'x', typ: 'zahl', loesung: 'zwölf', einheit: 'V', rechenweg: ['x'] }).length);
});
