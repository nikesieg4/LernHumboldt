// Lädt die Physik-Inhalte aus content/physik/ und baut daraus die Lernstruktur:
//
//   Klassenstufe ─┬─ Themenfeld (aus dem SchiC, z. B. „3.6 Elektrische Stromstärke …“)
//                 │    └─ Thema ─┬─ Lernziele
//                 │              ├─ Verstehen: Erklärung, Formeln, interaktive Erklärungen (lessons/)
//                 │              └─ Üben: Übungen (Typen siehe src/exercises.js)
//
// Ordner:  content/physik/stufen.json
//          content/physik/klasse-9/<themenfeld-ordner>/themenfeld.json
//          content/physik/klasse-9/<themenfeld-ordner>/<thema>.json   (ein Thema pro Datei)
//
// Eine Klassenstufe erscheint auf der Seite, sobald es für sie mindestens ein Themenfeld gibt.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { validateExercise, DIFFICULTIES } from './exercises.js';

const ID = /^[a-z0-9][a-z0-9-]*$/;
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

export function loadContent(dir = path.join(config.contentDir, 'physik')) {
  const errors = [];
  const err = (file, msg) => errors.push(`${path.relative(config.contentDir, file) || file}: ${msg}`);
  const content = { fach: 'Physik', stufen: [], topicById: new Map(), exerciseById: new Map(), errors };

  const stufenFile = path.join(dir, 'stufen.json');
  let stufen = [];
  try { const s = readJson(stufenFile); content.fach = s.fach || content.fach; stufen = s.stufen || []; }
  catch (e) { err(stufenFile, e.code === 'ENOENT' ? 'fehlt' : e.message); }

  for (const st of stufen) {
    const stufe = { stufe: Number(st.stufe), name: st.name || `Klasse ${st.stufe}`, themenfelder: [] };
    const sdir = path.join(dir, `klasse-${stufe.stufe}`);
    if (fs.existsSync(sdir)) {
      for (const tfName of fs.readdirSync(sdir).sort()) {
        const tfDir = path.join(sdir, tfName);
        const tfFile = path.join(tfDir, 'themenfeld.json');
        if (!fs.statSync(tfDir).isDirectory() || tfName.startsWith('_')) continue;
        let tf;
        try { tf = readJson(tfFile); } catch (e) { err(tfFile, e.code === 'ENOENT' ? 'fehlt' : e.message); continue; }
        const themenfeld = {
          id: tfName, stufe: stufe.stufe, nummer: tf.nummer || '', titel: tf.titel || tfName,
          beschreibung: tf.beschreibung || '', inhalte: tf.inhalte || [], erweiterung: tf.erweiterung || '',
          reihenfolge: tf.reihenfolge ?? 100, topics: [],
        };
        for (const f of fs.readdirSync(tfDir).sort()) {
          if (!f.endsWith('.json') || f === 'themenfeld.json' || f.startsWith('_')) continue;
          const file = path.join(tfDir, f);
          let t;
          try { t = readJson(file); } catch (e) { err(file, e.message); continue; }
          if (!ID.test(t.id || '')) { err(file, '"id" fehlt oder ungültig'); continue; }
          if (content.topicById.has(t.id)) { err(file, `Thema-ID "${t.id}" gibt es doppelt`); continue; }
          const topic = {
            id: t.id, stufe: stufe.stufe, themenfeldId: themenfeld.id, themenfeldTitel: themenfeld.titel,
            titel: t.titel || t.id, kurz: t.kurz || '', reihenfolge: t.reihenfolge ?? 100,
            lernziele: Array.isArray(t.lernziele) ? t.lernziele : [],
            verstehen: t.verstehen || {}, interaktiv: t.interaktiv || [], vertiefung: t.vertiefung || [],
            uebungen: [],
          };
          const goalIds = new Set(topic.lernziele.map(l => l.id));
          topic.lernziele.forEach((l, i) => { if (!l.id || !l.text) err(file, `Lernziel ${i + 1} braucht "id" und "text"`); });
          for (const ex of t.uebungen || []) {
            const problems = validateExercise(ex);
            if (ex?.lernziel && !goalIds.has(ex.lernziel)) problems.push(`Lernziel "${ex.lernziel}" gibt es in diesem Thema nicht`);
            if (ex?.id && content.exerciseById.has(ex.id)) problems.push('ID gibt es doppelt');
            if (problems.length) { err(file, `Übung ${ex?.id ?? '?'}: ${problems.join('; ')}`); continue; }
            const full = { ...ex, topicId: topic.id };
            topic.uebungen.push(full);
            content.exerciseById.set(ex.id, full);
          }
          topic.uebungen.sort((a, b) => DIFFICULTIES.indexOf(a.schwierigkeit) - DIFFICULTIES.indexOf(b.schwierigkeit));
          themenfeld.topics.push(topic);
          content.topicById.set(topic.id, topic);
        }
        themenfeld.topics.sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel, 'de'));
        stufe.themenfelder.push(themenfeld);
      }
    }
    stufe.themenfelder.sort((a, b) => a.reihenfolge - b.reihenfolge || a.nummer.localeCompare(b.nummer, 'de', { numeric: true }));
    content.stufen.push(stufe);
  }
  return content;
}

// Kurzer Cache: Änderungen an den Dateien sind nach wenigen Sekunden sichtbar (auch per update.sh).
let cache = null, cacheTime = 0;
export function content() {
  if (cache && Date.now() - cacheTime < 5000) return cache;
  const fresh = loadContent();
  if (fresh.errors.length && (!cache || fresh.errors.join() !== cache.errors.join())) {
    console.warn(`⚠  Fehler in den Physik-Inhalten (diese Teile werden übersprungen):\n   ${fresh.errors.join('\n   ')}`);
  }
  cache = fresh; cacheTime = Date.now();
  return cache;
}

/** Klassenstufen, für die es Inhalte gibt. */
export const visibleGrades = () => content().stufen.filter(s => s.themenfelder.length);
export const getGrade = n => visibleGrades().find(s => s.stufe === Number(n));

export { gradeOf, topicsOfGrade, topicProgress, gradeProgress } from './progress.js';
