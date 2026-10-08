// Fortschritt und Klassenstufen: reine Funktionen ohne Node-Abhängigkeiten
// (werden auch von der Testseite im Browser benutzt, siehe scripts/build-testseite.mjs).

/** „10a“ → 10, „9“ → 9, sonst null. */
export function gradeOf(klasse) {
  const m = /^\s*(\d{1,2})/.exec(klasse || '');
  return m ? Number(m[1]) : null;
}

/** Alle Themen einer Stufe in Reihenfolge. */
export const topicsOfGrade = grade => grade.themenfelder.flatMap(tf => tf.topics);

/** Fortschritt eines Themas aus der Menge gelöster Übungs-IDs. */
export function topicProgress(topic, solved, understood) {
  const total = topic.uebungen.length;
  const done = topic.uebungen.filter(e => solved.has(e.id)).length;
  return { total, done, prozent: total ? Math.round(done / total * 100) : 0, verstanden: understood.has(topic.id) };
}

export function gradeProgress(grade, solved, understood) {
  let total = 0, done = 0, und = 0, topics = 0;
  for (const t of topicsOfGrade(grade)) {
    const p = topicProgress(t, solved, understood);
    total += p.total; done += p.done; topics++; if (p.verstanden) und++;
  }
  return { total, done, prozent: total ? Math.round(done / total * 100) : 0, verstanden: und, topics };
}
