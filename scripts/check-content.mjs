// Prüft die Physik-Inhalte (content/physik) auf Fehler, bevor sie online gehen.
// Aufruf: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { loadContent } from '../src/physik.js';

const c = loadContent();
const errors = [...c.errors];
const warnings = [];

for (const grade of c.stufen) {
  for (const tf of grade.themenfelder) {
    for (const t of tf.topics) {
      const where = `${grade.name} › ${tf.nummer} › ${t.titel}`;
      for (const slug of [...t.interaktiv, ...t.vertiefung]) {
        if (!fs.existsSync(path.join(config.lessonsDir, slug, 'index.html'))) errors.push(`${where}: Lerneinheit "${slug}" gibt es nicht in lessons/`);
      }
      if (!t.lernziele.length) warnings.push(`${where}: keine Lernziele`);
      if (!t.uebungen.length) warnings.push(`${where}: keine Übungen`);
      const used = new Set(t.uebungen.map(e => e.lernziel));
      for (const l of t.lernziele) if (!used.has(l.id)) warnings.push(`${where}: Lernziel "${l.text}" hat keine Übung`);
      for (const d of ['leicht', 'mittel', 'schwer']) if (t.uebungen.length && !t.uebungen.some(e => e.schwierigkeit === d)) warnings.push(`${where}: keine Übung mit Schwierigkeit "${d}"`);
    }
  }
}

const topics = c.topicById.size, exercises = c.exerciseById.size;
console.log(`Physik-Inhalte: ${c.stufen.filter(s => s.themenfelder.length).map(s => s.stufe).join(', ')} · ${topics} Themen · ${exercises} Übungen`);
if (warnings.length) console.log(`\nHinweise (${warnings.length}):\n  ${warnings.join('\n  ')}`);
if (errors.length) { console.error(`\nFehler (${errors.length}):\n  ${errors.join('\n  ')}`); process.exit(1); }
console.log('\n✔ Keine Fehler gefunden.');
