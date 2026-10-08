import { config } from './config.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = s => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const roleName = { student: 'Schüler/in', teacher: 'Lehrkraft', admin: 'Admin' };

export function layout({ title, user, body, wide = false, bare = false, scripts = [] }) {
  const nav = user ? `
    <a class="skip" href="#inhalt">Zum Inhalt springen</a>
    <nav class="top" aria-label="Hauptmenü">
      <a class="brand" href="/">${esc(config.siteName)}</a>
      <div class="nav-right">
        <a href="/physik">Physik</a>
        ${user.role !== 'student' ? '<a href="/admin">Verwaltung</a>' : ''}
        <span class="who" title="${esc(user.username)}">${esc(user.name || user.username)}${user.klasse ? ` · ${esc(user.klasse)}` : ''}</span>
        <form method="post" action="/auth/logout"><button class="link">Abmelden</button></form>
      </div>
    </nav>` : '';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} · ${config.siteName}` : config.siteName)}</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body class="${bare ? 'bare' : ''}">
${nav}
<main id="inhalt" class="${wide ? 'wide' : ''}">
${body}
</main>
${scripts.map(s => `<script src="${esc(s)}" defer></script>`).join('\n')}
</body>
</html>`;
}

export function loginPage({ error } = {}) {
  return layout({
    title: 'Anmelden',
    body: `
    <section class="login">
      <h1>${esc(config.siteName)}</h1>
      <p class="muted">Interaktive Lerneinheiten deiner Schule.</p>
      ${error ? `<p class="alert">${esc(error)}</p>` : ''}
      ${config.iservEnabled ? `<a class="btn primary big" href="/auth/login">Mit IServ anmelden</a>
      <p class="small muted">Du wirst zu IServ weitergeleitet und gibst dort dein normales IServ-Passwort ein. Diese Seite bekommt dein Passwort nie zu sehen.</p>` : ''}
      ${!config.iservEnabled && !config.devLogin ? '<p class="alert">Die IServ-Anmeldung ist noch nicht eingerichtet. Siehe README.</p>' : ''}
      ${config.devLogin ? `
      <form class="devlogin" method="post" action="/auth/dev">
        <p class="small"><b>Test-Login</b> (DEV_LOGIN ist aktiv, nur zum Ausprobieren)</p>
        <input name="username" placeholder="Benutzername, z. B. max.muster" required>
        <input name="email" placeholder="E-Mail (optional)">
        <select name="role"><option value="student">Schüler/in</option><option value="teacher">Lehrkraft</option><option value="admin">Admin</option></select>
        <button class="btn">Test-Anmeldung</button>
      </form>` : ''}
    </section>`,
  });
}

export function messagePage({ title, text, user }) {
  return layout({ title, user, body: `<section class="login"><h1>${esc(title)}</h1><p>${text}</p><p><a class="btn" href="/">Zur Startseite</a></p></section>` });
}

export function homePage({ user, lessons, done, physik = null }) {
  const hero = physik ? `
    <a class="hero" href="${esc(physik.href)}">
      <div class="hero-text">
        <span class="eyebrow">Physik lernen</span>
        <h2>${esc(physik.titel)}</h2>
        <p>${esc(physik.text)}</p>
      </div>
      ${physik.progress ? `<div class="hero-progress"><div class="bar"><span style="width:${physik.progress.prozent}%"></span></div>
        <span class="small">${physik.progress.done} von ${physik.progress.total} Übungen gelöst</span></div>` : ''}
      <span class="btn primary">${esc(physik.cta)} →</span>
    </a>` : '';
  const total = lessons.length, n = lessons.filter(l => done.has(l.slug)).length;
  const bySubject = new Map();
  for (const l of lessons) { if (!bySubject.has(l.subject)) bySubject.set(l.subject, []); bySubject.get(l.subject).push(l); }
  const groups = [...bySubject].map(([subject, ls]) => `
    <h2>${esc(physik ? `Weitere Lerneinheiten · ${subject}` : subject)}</h2>
    <div class="cards">
      ${ls.map(l => `
      <a class="card lesson ${done.has(l.slug) ? 'done' : ''}" href="/lektion/${esc(l.slug)}">
        <div class="card-top"><h3>${esc(l.title)}</h3>${done.has(l.slug) ? '<span class="badge ok">Erledigt</span>' : ''}</div>
        ${l.description ? `<p>${esc(l.description)}</p>` : ''}
        ${l.minutes ? `<span class="small muted">ca. ${esc(l.minutes)} Min.</span>` : ''}
      </a>`).join('')}
    </div>`).join('');
  return layout({
    title: 'Lerneinheiten', user, body: `
    <header class="page-head">
      <h1>Hallo ${esc((user.name || user.username).split(' ')[0])}!</h1>
      ${total && !physik ? `<div class="progress-line"><div class="bar"><span style="width:${Math.round(n / total * 100)}%"></span></div><span class="small muted">${n} von ${total} Lerneinheiten erledigt</span></div>` : ''}
    </header>
    ${hero}
    ${groups || (physik ? '' : '<p class="muted">Es gibt noch keine Lerneinheiten. Lege einen Ordner unter <code>lessons/</code> an (siehe README).</p>')}`,
  });
}

export function lessonPage({ user, lesson, isDone }) {
  return layout({
    title: lesson.title, user, bare: true, wide: true, body: `
    <div class="lesson-bar">
      <a href="/" class="back">← Übersicht</a>
      <h1>${esc(lesson.title)}</h1>
      <button id="done" class="btn ${isDone ? 'ok' : 'primary'}" data-done="${isDone ? 1 : 0}">${isDone ? '✓ Erledigt' : 'Als erledigt markieren'}</button>
    </div>
    <iframe id="lesson" src="/inhalt/${esc(lesson.slug)}/index.html" title="${esc(lesson.title)}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>
    <script>
    (function () {
      var btn = document.getElementById('done'), frame = document.getElementById('lesson'), slug = ${JSON.stringify(lesson.slug)};
      function render(d) { btn.dataset.done = d ? 1 : 0; btn.textContent = d ? '✓ Erledigt' : 'Als erledigt markieren'; btn.className = 'btn ' + (d ? 'ok' : 'primary'); }
      function save(d) {
        return fetch('/api/fortschritt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: slug, done: d }) })
          .then(function (r) { if (!r.ok) throw new Error(); render(d); })
          .catch(function () { alert('Speichern hat nicht geklappt. Bist du noch angemeldet?'); });
      }
      btn.addEventListener('click', function () { save(btn.dataset.done !== '1'); });
      // Lektionen können sich selbst als erledigt melden:
      //   parent.postMessage({ type: 'lernseite:erledigt' }, '*')
      window.addEventListener('message', function (e) {
        if (e.source !== frame.contentWindow || !e.data || e.data.type !== 'lernseite:erledigt') return;
        if (btn.dataset.done !== '1') save(true);
      });
    })();
    </script>`,
  });
}

export function adminPage({ user, lessons, classes, selected, students, progress, roster, users, notice, physikHtml = '' }) {
  const isAdmin = user.role === 'admin';
  const matrix = selected ? `
    <div class="table-wrap">
    <table class="matrix">
      <thead><tr><th>Schüler/in</th>${lessons.map(l => `<th title="${esc(l.title)}"><span>${esc(l.title)}</span></th>`).join('')}<th>Summe</th></tr></thead>
      <tbody>
      ${students.map(s => {
        const p = progress.get(s.id) || new Map();
        return `<tr><td>${esc(s.name || s.username)}</td>${lessons.map(l => p.has(l.slug)
          ? `<td class="yes" title="erledigt am ${esc(fmtDate(p.get(l.slug)))}">✓</td>` : '<td class="no">–</td>').join('')}
          <td><b>${lessons.filter(l => p.has(l.slug)).length}</b>/${lessons.length}</td></tr>`;
      }).join('') || `<tr><td colspan="${lessons.length + 2}" class="muted">Aus dieser Klasse hat sich noch niemand angemeldet.</td></tr>`}
      </tbody>
    </table></div>` : '';

  const rosterSection = isAdmin ? `
    <section class="panel">
      <h2>Schülerliste</h2>
      <p class="small muted">Eine Zeile pro Schüler/in: <code>E-Mail;Name;Klasse</code>. Eine Kopfzeile ist erlaubt, Trennzeichen <code>;</code> <code>,</code> oder Tab.
      Die E-Mail muss die IServ-Adresse sein (z. B. <code>max.muster@meine-schule.de</code>). ${config.rosterRequired
        ? 'Nur wer in der Liste steht, kann sich anmelden (Lehrkräfte und Admins immer).'
        : 'ROSTER_REQUIRED ist aus: Alle IServ-Konten können sich anmelden, die Liste ordnet nur Klassen zu.'}
      <b>Passwörter gehören nicht in diese Liste</b>, die Anmeldung läuft über IServ.</p>
      <form method="post" action="/admin/schuelerliste">
        <input type="file" id="csvfile" accept=".csv,.txt,text/csv">
        <textarea name="csv" id="csv" rows="8" placeholder="E-Mail;Name;Klasse&#10;max.muster@meine-schule.de;Max Muster;10a">${esc(roster.map(r => `${r.email};${r.name || ''};${r.klasse || ''}`).join('\n'))}</textarea>
        <button class="btn primary">Schülerliste speichern (ersetzt die alte)</button>
        <span class="small muted">${roster.length} Einträge</span>
      </form>
      <script>
      document.getElementById('csvfile').addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        var r = new FileReader(); r.onload = function () { document.getElementById('csv').value = r.result; }; r.readAsText(f);
      });
      </script>
    </section>
    <section class="panel">
      <h2>Angemeldete Konten (${users.length})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Benutzername</th><th>Rolle</th><th>Klasse</th><th>IServ-Rollen</th><th>Letzter Login</th></tr></thead>
        <tbody>${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${roleName[u.role]}</td><td>${esc(u.klasse)}</td>
          <td class="small muted">${esc(u.iserv_roles)}</td><td>${esc(fmtDate(u.last_login))}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>` : '';

  return layout({
    title: 'Verwaltung', user, wide: true, body: `
    <header class="page-head"><h1>Verwaltung</h1></header>
    ${notice ? `<p class="notice">${esc(notice)}</p>` : ''}
    <section class="panel">
      <h2>Fortschritt nach Klasse</h2>
      <form method="get" action="/admin" class="inline">
        <select name="klasse" onchange="this.form.submit()">
          <option value="">Klasse wählen …</option>
          ${classes.map(c => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <noscript><button class="btn">Anzeigen</button></noscript>
      </form>
      ${physikHtml}
      ${selected && lessons.length ? '<h3>Lerneinheiten</h3>' : ''}
      ${matrix}
    </section>
    ${rosterSection}`,
  });
}
