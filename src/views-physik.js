// Seiten des Physik-Bereichs: Klassenstufe wählen → Themenfelder → Thema (Verstehen / Üben)
import { layout, esc } from './views.js';
import { md, mdBlock } from './markup.js';
import { TYPES, renderExercise } from './exercises.js';
import { topicProgress, gradeProgress, topicsOfGrade } from './progress.js';

const DIFF = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };

const bar = (prozent, label) => `
  <div class="progress-line">
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prozent}" aria-label="${esc(label)}"><span style="width:${prozent}%"></span></div>
    <span class="small muted">${esc(label)}</span>
  </div>`;

const crumbs = items => `
  <nav class="crumbs" aria-label="Brotkrümel">
    ${items.map((it, i) => i < items.length - 1 ? `<a href="${esc(it.href)}">${esc(it.label)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(it.label)}</span>`).join('')}
  </nav>`;

const gradeSwitch = (grades, current) => `
  <nav class="grade-switch" aria-label="Klassenstufe wechseln">
    ${grades.map(g => `<a href="/physik/${g.stufe}" class="${g.stufe === current ? 'active' : ''}" ${g.stufe === current ? 'aria-current="page"' : ''}>${g.stufe}</a>`).join('')}
  </nav>`;

// ---------------------------------------------------------------- Klassenstufe wählen

export function gradePickerPage({ user, grades, own, sets }) {
  return layout({
    title: 'Physik', user, body: `
    <header class="page-head">
      <h1>Physik lernen</h1>
      <p class="muted">Wähle deine Klassenstufe. Die Inhalte folgen dem schulinternen Curriculum.</p>
    </header>
    <div class="grade-grid">
      ${grades.map(g => {
        const p = gradeProgress(g, sets.solved, sets.understood);
        const ready = p.topics > 0;
        return `
        <a class="grade-card ${g.stufe === own ? 'own' : ''}" href="/physik/${g.stufe}">
          <span class="grade-num" aria-hidden="true">${g.stufe}</span>
          <span class="grade-name">${esc(g.name)}${g.stufe === own ? ' <span class="badge">Deine Klasse</span>' : ''}</span>
          <span class="small muted">${g.themenfelder.length} Themenfeld${g.themenfelder.length === 1 ? '' : 'er'}${ready ? ` · ${p.topics} Themen` : ' · in Vorbereitung'}</span>
          ${ready ? bar(p.prozent, `${p.prozent} % geschafft`) : ''}
        </a>`;
      }).join('')}
    </div>
    ${own && !grades.some(g => g.stufe === own) ? `<p class="muted small">Für Klasse ${own} gibt es noch keine Inhalte.</p>` : ''}`,
  });
}

// ---------------------------------------------------------------- Themenfelder einer Klassenstufe

export function gradePage({ user, grade, grades, sets }) {
  const p = gradeProgress(grade, sets.solved, sets.understood);
  return layout({
    title: `Physik ${grade.name}`, user, body: `
    ${crumbs([{ href: '/physik', label: 'Physik' }, { label: grade.name }])}
    <header class="page-head head-row">
      <div>
        <h1>${esc(grade.name)}</h1>
        ${p.topics ? bar(p.prozent, `${p.done} von ${p.total} Übungen gelöst · ${p.verstanden} von ${p.topics} Themen verstanden`) : ''}
      </div>
      ${gradeSwitch(grades, grade.stufe)}
    </header>
    ${grade.themenfelder.map(tf => `
    <section class="themenfeld" aria-labelledby="tf-${esc(tf.id)}">
      <h2 id="tf-${esc(tf.id)}"><span class="tf-num">${esc(tf.nummer)}</span> ${esc(tf.titel)}</h2>
      ${tf.beschreibung ? `<p class="muted">${md(tf.beschreibung)}</p>` : ''}
      ${tf.topics.length ? `
      <div class="cards">
        ${tf.topics.map(t => {
          const tp = topicProgress(t, sets.solved, sets.understood);
          return `
          <a class="card topic ${tp.total && tp.done === tp.total ? 'done' : ''}" href="/physik/${grade.stufe}/${esc(t.id)}">
            <div class="card-top"><h3>${esc(t.titel)}</h3>${tp.verstanden ? '<span class="badge ok" title="Verstehen abgeschlossen">✓ Verstanden</span>' : ''}</div>
            ${t.kurz ? `<p>${md(t.kurz)}</p>` : ''}
            <div class="card-meta">
              ${t.interaktiv.length ? '<span class="chip">Interaktiv</span>' : ''}
              <span class="chip">${tp.total} Übungen</span>
            </div>
            ${tp.total ? bar(tp.prozent, `${tp.done} / ${tp.total} gelöst`) : ''}
          </a>`;
        }).join('')}
      </div>` : `
      <div class="card planned">
        <div class="card-top"><h3>In Vorbereitung</h3><span class="chip">bald</span></div>
        <p>Inhalte laut Curriculum:</p>
        <ul class="small">${tf.inhalte.map(i => `<li>${md(i)}</li>`).join('')}</ul>
      </div>`}
    </section>`).join('')}`,
  });
}

// ---------------------------------------------------------------- Thema: gemeinsamer Kopf

function topicHead({ grade, topic, tab, progress }) {
  const base = `/physik/${grade.stufe}/${esc(topic.id)}`;
  return `
    ${crumbs([{ href: '/physik', label: 'Physik' }, { href: `/physik/${grade.stufe}`, label: grade.name }, { label: topic.titel }])}
    <header class="page-head topic-head">
      <span class="eyebrow">${esc(topic.themenfeldTitel)}</span>
      <h1>${esc(topic.titel)}</h1>
      <div class="topic-status">
        <span class="${progress.verstanden ? 'ok-text' : 'muted'}">Verstehen ${progress.verstanden ? '✓' : '○'}</span>
        <span class="muted">Übungen <b data-progress-count>${progress.done} / ${progress.total}</b></span>
        <div class="bar" aria-hidden="true"><span data-progress-bar style="width:${progress.prozent}%"></span></div>
        <span class="muted" data-progress-pct>${progress.prozent} %</span>
      </div>
      <nav class="tabs" aria-label="Bereiche des Themas">
        <a href="${base}" class="${tab === 'verstehen' ? 'active' : ''}" ${tab === 'verstehen' ? 'aria-current="page"' : ''}><span class="tab-step">1</span> Verstehen</a>
        <a href="${base}/ueben" class="${tab === 'ueben' ? 'active' : ''}" ${tab === 'ueben' ? 'aria-current="page"' : ''}><span class="tab-step">2</span> Üben</a>
      </nav>
    </header>`;
}

const lessonFrame = (l, done) => `
  <figure class="interactive" data-lesson="${esc(l.slug)}">
    <figcaption>
      <span><span class="chip">Interaktiv</span> <strong>${esc(l.title)}</strong>${done ? ' <span class="badge ok">✓ ausprobiert</span>' : ''}</span>
      <a href="/lektion/${esc(l.slug)}" target="_blank" rel="noopener">Im Vollbild öffnen ↗</a>
    </figcaption>
    ${l.description ? `<p class="small muted">${esc(l.description)}</p>` : ''}
    <iframe src="/inhalt/${esc(l.slug)}/index.html" title="${esc(l.title)}" loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>
  </figure>`;

// ---------------------------------------------------------------- Thema: Verstehen

export function topicUnderstandPage({ user, grade, topic, progress, lessons, extras, lessonDone, nextTopic }) {
  const v = topic.verstehen;
  return layout({
    title: topic.titel, user, scripts: ['/static/uebung.js'], body: `
    ${topicHead({ grade, topic, tab: 'verstehen', progress })}
    <div class="topic-grid" data-topic="${esc(topic.id)}">
      <div class="topic-main">
        ${topic.lernziele.length ? `
        <section class="box goals">
          <h2>Das lernst du hier</h2>
          <ul>${topic.lernziele.map(l => `<li>${md(l.text)}</li>`).join('')}</ul>
        </section>` : ''}
        ${v.einstieg ? `<section class="box question"><h2>Frage zum Einstieg</h2>${mdBlock(v.einstieg)}</section>` : ''}
        ${(v.abschnitte || []).map(a => `
        <section class="explain">
          <h2>${md(a.titel)}</h2>
          ${mdBlock(a.text)}
        </section>`).join('')}
        ${(v.formeln || []).length ? `
        <section class="box formulas">
          <h2>Formeln</h2>
          ${v.formeln.map(f => `
          <div class="formula">
            <div class="formula-main">${md(f.formel)}</div>
            ${f.bedeutung ? `<div class="formula-legend">${md(f.bedeutung)}</div>` : ''}
          </div>`).join('')}
        </section>` : ''}
        ${lessons.map(l => lessonFrame(l, lessonDone.has(l.slug))).join('')}
        ${v.merksatz ? `<section class="box merksatz"><h2>Merksatz</h2>${mdBlock(v.merksatz)}</section>` : ''}
        ${v.alltag ? `<section class="box alltag"><h2>Im Alltag</h2>${mdBlock(v.alltag)}</section>` : ''}
        ${extras.length ? `
        <section class="explain">
          <h2>Vertiefung für Schnelle</h2>
          <div class="cards">${extras.map(l => `
            <a class="card lesson" href="/lektion/${esc(l.slug)}">
              <div class="card-top"><h3>${esc(l.title)}</h3>${lessonDone.has(l.slug) ? '<span class="badge ok">Erledigt</span>' : ''}</div>
              ${l.description ? `<p>${esc(l.description)}</p>` : ''}
            </a>`).join('')}</div>
        </section>` : ''}
        <div class="next-step">
          <button type="button" class="btn ${progress.verstanden ? 'ok' : ''}" data-understood="${progress.verstanden ? 1 : 0}" data-topic="${esc(topic.id)}">
            ${progress.verstanden ? '✓ Verstanden' : 'Ich habe es verstanden'}
          </button>
          ${topic.uebungen.length ? `<a class="btn primary" href="/physik/${grade.stufe}/${esc(topic.id)}/ueben">Weiter zu den Übungen →</a>` : ''}
        </div>
      </div>
    </div>`,
  });
}

// ---------------------------------------------------------------- Thema: Üben

export function topicPracticePage({ user, grade, topic, progress, solved, stats, nextTopic }) {
  const goals = Object.fromEntries(topic.lernziele.map(l => [l.id, l.text]));
  return layout({
    title: `${topic.titel} – Üben`, user, scripts: ['/static/uebung.js'], body: `
    ${topicHead({ grade, topic, tab: 'ueben', progress })}
    ${topic.uebungen.length ? `
    <div class="filters" role="group" aria-label="Übungen filtern">
      <button type="button" class="chip-btn active" data-filter="alle" aria-pressed="true">Alle</button>
      ${Object.entries(DIFF).map(([k, v]) => `<button type="button" class="chip-btn" data-filter="${k}" aria-pressed="false">${v}</button>`).join('')}
      <button type="button" class="chip-btn" data-filter="offen" aria-pressed="false">Noch offen</button>
    </div>
    <div class="exercises" data-topic="${esc(topic.id)}">
      ${topic.uebungen.map((ex, i) => {
        const st = stats.get(ex.id);
        const isSolved = solved.has(ex.id);
        return `
      <article class="exercise ${isSolved ? 'solved' : ''}" id="${esc(ex.id)}" data-id="${esc(ex.id)}" data-diff="${esc(ex.schwierigkeit)}" data-typ="${esc(ex.typ)}" aria-labelledby="q-${esc(ex.id)}">
        <header class="ex-head">
          <span class="ex-num">Aufgabe ${i + 1}</span>
          <span class="diff diff-${esc(ex.schwierigkeit)}">${DIFF[ex.schwierigkeit]}</span>
          <span class="chip">${esc(TYPES[ex.typ].label)}</span>
          <span class="ex-state" data-state>${isSolved ? '✓ gelöst' : st ? `${st.versuche} Versuch${st.versuche === 1 ? '' : 'e'}` : ''}</span>
        </header>
        <div class="ex-q" id="q-${esc(ex.id)}">${mdBlock(ex.frage)}</div>
        ${ex.lernziel && goals[ex.lernziel] ? `<p class="small muted ex-goal">Lernziel: ${md(goals[ex.lernziel])}</p>` : ''}
        <form class="ex-form" novalidate>
          ${renderExercise(ex)}
          <div class="ex-actions">
            <button class="btn primary" type="submit">Prüfen</button>
            <button class="btn" type="button" data-retry hidden>Nochmal versuchen</button>
            <button class="btn" type="button" data-reveal hidden>Lösung zeigen</button>
          </div>
        </form>
        <div class="ex-result" data-result aria-live="polite"></div>
      </article>`;
      }).join('')}
    </div>
    <p class="filter-empty muted" hidden>In dieser Auswahl gibt es keine Aufgaben.</p>` : '<p class="muted">Für dieses Thema gibt es noch keine Übungen.</p>'}
    <div class="next-step">
      <a class="btn" href="/physik/${grade.stufe}/${esc(topic.id)}">← Zurück zu Verstehen</a>
      ${nextTopic ? `<a class="btn primary" href="/physik/${grade.stufe}/${esc(nextTopic.id)}">Nächstes Thema: ${esc(nextTopic.titel)} →</a>` : `<a class="btn primary" href="/physik/${grade.stufe}">Zur Übersicht ${esc(grade.name)} →</a>`}
    </div>`,
  });
}

// ---------------------------------------------------------------- Lehrkräfte: Physik-Fortschritt einer Klasse

export function physicsMatrix({ grade, students, solvedBy, understoodBy }) {
  if (!grade) return '<p class="muted small">Zu dieser Klasse gibt es keine passende Klassenstufe mit Physik-Inhalten.</p>';
  const topics = topicsOfGrade(grade);
  if (!topics.length) return `<p class="muted small">Für ${esc(grade.name)} gibt es noch keine Themen.</p>`;
  const empty = new Set();
  return `
    <h3>Physik · ${esc(grade.name)}</h3>
    <p class="small muted">Prozent = gelöste Übungen des Themas, ✓ = „Verstanden“ markiert.</p>
    <div class="table-wrap">
    <table class="matrix heat">
      <thead><tr><th>Schüler/in</th>${topics.map(t => `<th title="${esc(t.titel)}"><span>${esc(t.titel)}</span></th>`).join('')}<th>Gesamt</th></tr></thead>
      <tbody>
      ${students.map(s => {
        const solved = solvedBy.get(s.id) || empty, und = understoodBy.get(s.id) || empty;
        const gp = gradeProgress(grade, solved, und);
        return `<tr><td>${esc(s.name || s.username)}</td>${topics.map(t => {
          const p = topicProgress(t, solved, und);
          return `<td style="--p:${p.prozent}" title="${esc(t.titel)}: ${p.done}/${p.total}${p.verstanden ? ', verstanden' : ''}">${p.done ? p.prozent + ' %' : '–'}${p.verstanden ? ' ✓' : ''}</td>`;
        }).join('')}<td><b>${gp.prozent} %</b></td></tr>`;
      }).join('') || `<tr><td colspan="${topics.length + 2}" class="muted">Aus dieser Klasse hat sich noch niemand angemeldet.</td></tr>`}
      </tbody>
    </table></div>`;
}
