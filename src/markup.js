// Kleine, sichere Auszeichnung für Lerninhalte (Texte in den JSON-Dateien).
//
//   **fett**              → fett
//   `R = U / I`           → Formel (eigene Schrift, kein Umbruch)
//   I_{ges}  10^{3}       → tiefgestellt / hochgestellt
//   \frac{U}{I}           → Bruch,  \sqrt{x} → Wurzel
//   Leerzeile             → neuer Absatz,  einfacher Zeilenumbruch → <br>
//   Zeilen mit "- "        → Aufzählung
//
// Alles andere wird HTML-escaped, Inhalte können also kein HTML/JS einschleusen.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  return esc(s)
    // Indizes zuerst, damit Brüche und Wurzeln mit Indizes (z. B. \frac{U_{2}}{U_{1}}) funktionieren
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '<span class="frac" role="math"><span>$1</span><span>$2</span></span>')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√<span class="sqrt">$1</span>')
    .replace(/`([^`]+)`/g, '<span class="f">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Ein Text ohne Absätze (z. B. Antwortoption, Überschrift). */
export const md = s => inline(s).replace(/\n/g, '<br>');

/** Längerer Text mit Absätzen. */
export const mdBlock = s => String(s ?? '').trim().split(/\n\s*\n/).filter(Boolean).map(block => {
  // Zeilen gruppieren: Aufzählungszeilen ("- …") werden zu <ul>, der Rest zu Absätzen
  const out = []; let text = [], list = [];
  const flushText = () => { if (text.length) out.push(`<p>${md(text.join('\n'))}</p>`); text = []; };
  const flushList = () => { if (list.length) out.push(`<ul>${list.map(i => `<li>${md(i)}</li>`).join('')}</ul>`); list = []; };
  for (const line of block.trim().split('\n')) {
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) { flushText(); list.push(m[1]); } else { flushList(); text.push(line); }
  }
  flushText(); flushList();
  return out.join('');
}).join('');
