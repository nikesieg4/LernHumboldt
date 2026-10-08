// Kleine, sichere Auszeichnung für Lerninhalte (Texte in den JSON-Dateien).
//
//   **fett**              → fett
//   `R = U / I`           → Formel (eigene Schrift, kein Umbruch)
//   I_{ges}  10^{3}       → tiefgestellt / hochgestellt
//   \frac{U}{I}           → Bruch
//   Leerzeile             → neuer Absatz,  einfacher Zeilenumbruch → <br>
//
// Alles andere wird HTML-escaped, Inhalte können also kein HTML/JS einschleusen.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  return esc(s)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '<span class="frac" role="math"><span>$1</span><span>$2</span></span>')
    .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>')
    .replace(/`([^`]+)`/g, '<span class="f">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Ein Text ohne Absätze (z. B. Antwortoption, Überschrift). */
export const md = s => inline(s).replace(/\n/g, '<br>');

/** Längerer Text mit Absätzen. */
export const mdBlock = s => String(s ?? '').trim().split(/\n\s*\n/).filter(Boolean).map(p => `<p>${md(p.trim())}</p>`).join('');
