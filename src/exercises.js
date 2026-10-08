// Übungs-Engine: Jeder Aufgabentyp ist ein Eintrag in TYPES mit vier Funktionen.
//
//   validate(ex)          → Liste von Fehlermeldungen (leer = ok). Läuft beim Laden der Inhalte.
//   render(ex)            → HTML der Eingabe (ohne Lösung!). Formularfelder werden vom Browser
//                           automatisch eingesammelt (public/uebung.js).
//   check(ex, a)          → Bewertung der Antwort a (die eingesammelten Formularfelder):
//                           { status: 'richtig' | 'falsch' | 'teilweise' | 'selbst',
//                             feedback: HTML, marks: { markName: 'richtig' | 'falsch' }, ... }
//   solution(ex)          → { loesung: HTML, marks } – wird erst nach richtiger Antwort oder
//                           auf Wunsch („Lösung zeigen“) an den Browser geschickt.
//
// Neuer Aufgabentyp = neuer Eintrag hier (+ ggf. ein paar Zeilen in public/uebung.js für
// besondere Bedienung wie Verschieben). Gemeinsame Felder jeder Übung:
//   id, typ, schwierigkeit (leicht|mittel|schwer), frage, erklaerung, hinweis?, lernziel?
import { esc, md, mdBlock } from './markup.js';

export const DIFFICULTIES = ['leicht', 'mittel', 'schwer'];

// ---------------------------------------------------------------- Hilfsfunktionen

/** Stabile Pseudo-Zufallsreihenfolge pro Übung (gleich bei jedem Laden). */
function shuffled(n, seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a.every((v, i) => v === i)) a.push(a.shift());
  return a;
}

const fmtNum = (x, digits = 4) => {
  if (!Number.isFinite(x)) return String(x);
  const r = Number(x.toPrecision(digits));
  return r.toLocaleString('de-DE', { maximumFractionDigits: 10 });
};

/** Liest Zahlen wie „12,5“, „0.5“, „1 200“, „3,6·10^3“, „2e-3“. */
export function parseNumber(raw) {
  let s = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (!s) return NaN;
  // Deutsche Tausenderpunkte („10.000“ oder „1.234,5“) entfernen
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(/[·*x×]10\^?\(?(-?\d+)\)?$/i, 'e$1').replace(/,/g, '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

const norm = s => String(s ?? '').toLowerCase().replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 8320))
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9α-ωµ]+/g, ' ');

const optionList = (ex, kind) => `
  <fieldset class="opts">
    <legend class="sr-only">Antwort wählen</legend>
    ${ex.optionen.map((o, i) => `
    <label class="opt" data-mark="opt-${i}">
      <input type="${kind}" name="wahl" value="${i}">
      <span>${md(o.text)}</span>
    </label>`).join('')}
  </fieldset>`;

const chosenList = a => [].concat(a?.wahl ?? []).map(Number).filter(Number.isInteger);

function validateOptions(ex, minCorrect, maxCorrect) {
  const e = [];
  if (!Array.isArray(ex.optionen) || ex.optionen.length < 2) return ['braucht mindestens 2 "optionen"'];
  ex.optionen.forEach((o, i) => { if (!o?.text) e.push(`Option ${i + 1} hat keinen "text"`); });
  const n = ex.optionen.filter(o => o.richtig).length;
  if (n < minCorrect || n > maxCorrect) e.push(`hat ${n} richtige Optionen (erlaubt: ${minCorrect}${maxCorrect > minCorrect ? '–' + maxCorrect : ''})`);
  return e;
}

// ---------------------------------------------------------------- Aufgabentypen

export const TYPES = {

  // Eine richtige Antwort. Jede Option kann ein eigenes "feedback" haben (warum falsch/richtig).
  single: {
    label: 'Eine Antwort',
    validate: ex => validateOptions(ex, 1, 1),
    render: ex => optionList(ex, 'radio'),
    check(ex, a) {
      const [i] = chosenList(a);
      if (!(i >= 0 && i < ex.optionen.length)) return { error: 'Bitte wähle eine Antwort aus.' };
      const o = ex.optionen[i];
      return {
        status: o.richtig ? 'richtig' : 'falsch',
        feedback: o.feedback ? md(o.feedback) : '',
        marks: { [`opt-${i}`]: o.richtig ? 'richtig' : 'falsch' },
      };
    },
    solution(ex) {
      const i = ex.optionen.findIndex(o => o.richtig);
      return { loesung: `Richtig ist: <strong>${md(ex.optionen[i].text)}</strong>`, marks: { [`opt-${i}`]: 'richtig' } };
    },
  },

  // Mehrere richtige Antworten.
  multi: {
    label: 'Mehrere Antworten',
    validate: ex => validateOptions(ex, 1, Infinity),
    render: ex => `<p class="small muted">Mehrere Antworten können richtig sein.</p>${optionList(ex, 'checkbox')}`,
    check(ex, a) {
      const chosen = new Set(chosenList(a));
      if (!chosen.size) return { error: 'Bitte wähle mindestens eine Antwort aus.' };
      const marks = {}, notes = [];
      let hits = 0, wrong = 0;
      const total = ex.optionen.filter(o => o.richtig).length;
      ex.optionen.forEach((o, i) => {
        if (!chosen.has(i)) return;
        marks[`opt-${i}`] = o.richtig ? 'richtig' : 'falsch';
        if (o.richtig) hits++; else { wrong++; if (o.feedback) notes.push(md(o.feedback)); }
      });
      const status = hits === total && !wrong ? 'richtig' : hits > 0 ? 'teilweise' : 'falsch';
      const summary = status === 'richtig' ? '' :
        `Du hast ${hits} von ${total} richtigen Antworten gefunden${wrong ? ` und ${wrong} falsche gewählt` : ''}.`;
      return { status, feedback: [summary, ...notes].filter(Boolean).map(x => `<p>${x}</p>`).join(''), marks };
    },
    solution(ex) {
      const marks = {};
      ex.optionen.forEach((o, i) => { if (o.richtig) marks[`opt-${i}`] = 'richtig'; });
      return { loesung: `Richtig sind: ${ex.optionen.filter(o => o.richtig).map(o => `<strong>${md(o.text)}</strong>`).join(', ')}`, marks };
    },
  },

  // Zahlenwert / Rechenaufgabe.
  //   loesung: Zahl in "einheit"; toleranz: relativ (Standard 0,02 = 2 %)
  //   alternativEinheiten: { "mA": 0.001 } → Auswahl, Umrechnung in "einheit"
  //   gegeben/gesucht (optional, Text), rechenweg: [Schritte] (wird mit der Lösung gezeigt)
  zahl: {
    label: 'Zahlenwert',
    validate(ex) {
      const e = [];
      if (!Number.isFinite(ex.loesung)) e.push('"loesung" muss eine Zahl sein');
      if (!ex.einheit && ex.einheit !== '') e.push('"einheit" fehlt (für Größen ohne Einheit "" angeben)');
      if (ex.toleranz != null && !(ex.toleranz >= 0 && ex.toleranz < 1)) e.push('"toleranz" muss zwischen 0 und 1 liegen');
      if (!Array.isArray(ex.rechenweg) || !ex.rechenweg.length) e.push('"rechenweg" fehlt');
      for (const [u, f] of Object.entries(ex.alternativEinheiten || {})) if (!(f > 0)) e.push(`Umrechnungsfaktor für "${u}" ungültig`);
      return e;
    },
    render(ex) {
      const units = [ex.einheit, ...Object.keys(ex.alternativEinheiten || {})];
      const unitHtml = units.length > 1
        ? `<select name="einheit" aria-label="Einheit">${shuffled(units.length, ex.id).map(i => `<option value="${esc(units[i])}">${esc(units[i])}</option>`).join('')}</select>`
        : `<span class="unit">${md(ex.einheit)}</span>`;
      return `
      ${ex.gegeben ? `<p class="given"><span class="muted">Gegeben:</span> ${md(ex.gegeben)}<br><span class="muted">Gesucht:</span> ${md(ex.gesucht || '')}</p>` : ''}
      <label class="numrow">
        <span class="sr-only">Dein Ergebnis</span>
        ${ex.gesuchtSymbol ? `<span class="f">${md(ex.gesuchtSymbol)} =</span>` : ''}
        <input name="wert" inputmode="decimal" autocomplete="off" placeholder="Ergebnis" data-mark="wert">
        ${unitHtml}
      </label>
      <p class="small muted">Komma oder Punkt sind beide erlaubt.</p>`;
    },
    check(ex, a) {
      let raw = String(a?.wert ?? '').trim();
      const units = { [ex.einheit]: 1, ...(ex.alternativEinheiten || {}) };
      let unit = a?.einheit && units[a.einheit] ? a.einheit : ex.einheit;
      // Einheit mit eingetippt („12 V“)? Dann abtrennen.
      for (const u of Object.keys(units).sort((x, y) => y.length - x.length)) {
        if (u && raw.endsWith(u) && raw.length > u.length) { raw = raw.slice(0, -u.length).trim(); if (Object.keys(units).length === 1) unit = u; break; }
      }
      const v = parseNumber(raw);
      if (!Number.isFinite(v)) return { error: 'Bitte gib eine Zahl ein, z. B. 12,5.' };
      const value = v * units[unit];
      const target = ex.loesung;
      const tol = ex.toleranz ?? 0.02;
      const ok = target === 0 ? Math.abs(value) <= (ex.toleranzAbs ?? 1e-9) : Math.abs(value - target) <= Math.abs(target) * tol + (ex.toleranzAbs ?? 0);
      if (ok) return { status: 'richtig', feedback: '', marks: { wert: 'richtig' } };
      let tip = '';
      const ratio = target !== 0 && value !== 0 ? value / target : NaN;
      const p10 = Math.log10(Math.abs(ratio));
      if (Number.isFinite(ratio) && Math.abs(p10 - Math.round(p10)) < 0.01 && Math.round(p10) !== 0) tip = 'Die Ziffern stimmen, aber die Größenordnung nicht. Prüfe die Umrechnung der Einheiten (z. B. mA ↔ A, kW ↔ W, min ↔ s).';
      else if (Number.isFinite(ratio) && ratio < 0) tip = 'Prüfe das Vorzeichen.';
      else if (Math.abs(value - target) <= Math.abs(target) * 0.1) tip = 'Knapp daneben. Prüfe, ob du zu früh gerundet hast.';
      return { status: 'falsch', feedback: tip ? `<p>${tip}</p>` : '', marks: { wert: 'falsch' } };
    },
    solution(ex) {
      return {
        loesung: `<p>Ergebnis: <strong><span class="f">${ex.gesuchtSymbol ? md(ex.gesuchtSymbol) + ' = ' : ''}${fmtNum(ex.loesung)} ${md(ex.einheit)}</span></strong></p>
          <ol class="steps">${ex.rechenweg.map(s => `<li>${md(s)}</li>`).join('')}</ol>`,
        marks: { wert: 'richtig' },
      };
    },
  },

  // Freie Antwort ohne KI: Stichwort-Check + Musterlösung + Selbsteinschätzung.
  //   stichworte: [{ aspekt: "Text", woerter: ["wortteil", ...] }]  – ein Aspekt gilt als
  //   genannt, wenn eines der Wörter (klein, ä→ae …) in der Antwort vorkommt.
  text: {
    label: 'Freie Antwort',
    validate(ex) {
      const e = [];
      if (!ex.musterloesung) e.push('"musterloesung" fehlt');
      if (!Array.isArray(ex.stichworte) || !ex.stichworte.length) e.push('"stichworte" fehlen');
      (ex.stichworte || []).forEach((s, i) => { if (!s.aspekt || !Array.isArray(s.woerter) || !s.woerter.length) e.push(`Stichwort ${i + 1} braucht "aspekt" und "woerter"`); });
      return e;
    },
    render: ex => `<label class="sr-only" for="t-${esc(ex.id)}">Deine Antwort</label>
      <textarea id="t-${esc(ex.id)}" name="text" rows="4" placeholder="Schreibe deine Antwort in ganzen Sätzen …" data-mark="text"></textarea>`,
    check(ex, a) {
      const text = String(a?.text ?? '').trim();
      if (text.length < 10) return { error: 'Schreibe bitte mindestens einen ganzen Satz.' };
      const t = ' ' + norm(text) + ' ';
      const aspects = ex.stichworte.map(s => ({ aspekt: s.aspekt, ok: s.woerter.some(w => t.includes(norm(w).trim())) }));
      const n = aspects.filter(x => x.ok).length;
      return {
        status: 'selbst',
        feedback: `<p>Vergleiche deine Antwort mit der Musterlösung. Diese Punkte sollte eine gute Antwort enthalten
          (${n} von ${aspects.length} habe ich in deinem Text erkannt):</p>
          <ul class="aspects">${aspects.map(x => `<li class="${x.ok ? 'hit' : 'miss'}"><span aria-hidden="true">${x.ok ? '✓' : '○'}</span> ${md(x.aspekt)}<span class="sr-only">${x.ok ? ' (erkannt)' : ' (nicht erkannt)'}</span></li>`).join('')}</ul>
          <p class="small muted">Die Erkennung sucht nur nach Stichworten. Entscheidend ist, ob du es inhaltlich richtig erklärt hast.</p>`,
        loesung: `<p><strong>Musterlösung:</strong></p>${mdBlock(ex.musterloesung)}`,
        marks: {},
      };
    },
    solution: ex => ({ loesung: `<p><strong>Musterlösung:</strong></p>${mdBlock(ex.musterloesung)}`, marks: {} }),
  },

  // Zuordnung: Zu jedem linken Begriff den passenden rechten wählen.
  //   paare: [{ links, rechts }], extraRechts?: [Ablenker]
  zuordnung: {
    label: 'Zuordnen',
    validate(ex) {
      if (!Array.isArray(ex.paare) || ex.paare.length < 2) return ['braucht mindestens 2 "paare"'];
      const r = ex.paare.map(p => p.rechts);
      return new Set(r).size !== r.length ? ['rechte Seiten müssen verschieden sein'] : [];
    },
    render(ex) {
      const right = [...ex.paare.map(p => p.rechts), ...(ex.extraRechts || [])];
      const order = shuffled(right.length, ex.id);
      return `<div class="match">${ex.paare.map((p, i) => `
        <label class="match-row" data-mark="z${i}">
          <span class="match-left">${md(p.links)}</span>
          <select name="z${i}"><option value="">– wählen –</option>${order.map(j => `<option value="${j}">${esc(right[j].replace(/`|\*\*|_\{|\^\{|\}/g, ''))}</option>`).join('')}</select>
        </label>`).join('')}</div>`;
    },
    check(ex, a) {
      const marks = {};
      let hits = 0;
      for (let i = 0; i < ex.paare.length; i++) {
        const v = a?.[`z${i}`];
        if (v === '' || v == null) return { error: 'Bitte ordne jedem Begriff etwas zu.' };
        const ok = Number(v) === i;
        marks[`z${i}`] = ok ? 'richtig' : 'falsch';
        if (ok) hits++;
      }
      const status = hits === ex.paare.length ? 'richtig' : hits ? 'teilweise' : 'falsch';
      return { status, feedback: status === 'richtig' ? '' : `<p>${hits} von ${ex.paare.length} Zuordnungen stimmen.</p>`, marks };
    },
    solution(ex) {
      const marks = Object.fromEntries(ex.paare.map((_, i) => [`z${i}`, 'richtig']));
      return { loesung: `<ul>${ex.paare.map(p => `<li>${md(p.links)} → <strong>${md(p.rechts)}</strong></li>`).join('')}</ul>`, marks };
    },
  },

  // Reihenfolge: Elemente in die richtige Reihenfolge bringen (Bedienung über ↑/↓-Knöpfe).
  //   elemente: [in richtiger Reihenfolge]
  reihenfolge: {
    label: 'Reihenfolge',
    validate: ex => (!Array.isArray(ex.elemente) || ex.elemente.length < 3 ? ['braucht mindestens 3 "elemente"'] : []),
    render(ex) {
      const order = shuffled(ex.elemente.length, ex.id);
      return `<ol class="order" data-order>${order.map(j => `
        <li data-mark="r${j}"><input type="hidden" name="reihenfolge" value="${j}">
          <span class="order-text">${md(ex.elemente[j])}</span>
          <span class="order-btns"><button type="button" class="mini" data-move="-1" aria-label="nach oben">↑</button><button type="button" class="mini" data-move="1" aria-label="nach unten">↓</button></span>
        </li>`).join('')}</ol>`;
    },
    check(ex, a) {
      const seq = [].concat(a?.reihenfolge ?? []).map(Number);
      if (seq.length !== ex.elemente.length) return { error: 'Die Reihenfolge ist unvollständig.' };
      const marks = {};
      let hits = 0;
      seq.forEach((j, pos) => { const ok = j === pos; marks[`r${j}`] = ok ? 'richtig' : 'falsch'; if (ok) hits++; });
      const status = hits === seq.length ? 'richtig' : 'falsch';
      return { status, feedback: status === 'richtig' ? '' : `<p>${hits} von ${seq.length} Elementen stehen schon an der richtigen Stelle.</p>`, marks };
    },
    solution: ex => ({ loesung: `<ol>${ex.elemente.map(e => `<li>${md(e)}</li>`).join('')}</ol>`, marks: {} }),
  },
};

// ---------------------------------------------------------------- Gemeinsame Logik

export function validateExercise(ex) {
  const errors = [];
  if (!ex || typeof ex !== 'object') return ['ist kein Objekt'];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(ex.id || '')) errors.push('"id" fehlt oder enthält ungültige Zeichen');
  if (!TYPES[ex.typ]) errors.push(`unbekannter "typ": ${ex.typ} (bekannt: ${Object.keys(TYPES).join(', ')})`);
  if (!DIFFICULTIES.includes(ex.schwierigkeit)) errors.push(`"schwierigkeit" muss ${DIFFICULTIES.join('/')} sein`);
  if (!ex.frage) errors.push('"frage" fehlt');
  if (!ex.erklaerung) errors.push('"erklaerung" fehlt');
  if (TYPES[ex.typ]) errors.push(...TYPES[ex.typ].validate(ex));
  return errors;
}

/** HTML einer Übung ohne Lösung. */
export function renderExercise(ex) {
  return TYPES[ex.typ].render(ex);
}

/** Bewertet eine Antwort und hängt bei richtiger Antwort Lösung und Erklärung an. */
export function checkAnswer(ex, answer) {
  const t = TYPES[ex.typ];
  const r = t.check(ex, answer || {});
  if (r.error) return r;
  const out = { ...r };
  if (r.status === 'richtig' || r.status === 'selbst') {
    const s = t.solution(ex);
    out.loesung = r.loesung || s.loesung;
    out.marks = { ...s.marks, ...r.marks };
    out.erklaerung = mdBlock(ex.erklaerung);
  } else if (ex.hinweis) {
    out.hinweis = md(ex.hinweis);
  }
  return out;
}

/** Lösung auf Wunsch anzeigen. */
export function revealSolution(ex) {
  const s = TYPES[ex.typ].solution(ex);
  return { status: 'geloest', loesung: s.loesung, marks: s.marks, erklaerung: mdBlock(ex.erklaerung) };
}
