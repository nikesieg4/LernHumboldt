// Browser-Teil des Physik-Bereichs: Übungen abschicken, Feedback anzeigen, Fortschritt,
// „Verstanden“-Knopf und eingebettete interaktive Erklärungen (iframes).
// Die Bewertung passiert auf dem Server (POST /api/uebung/:id), hier wird nur angezeigt.
(function () {
  'use strict';
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 401) throw new Error('Du bist nicht mehr angemeldet. Lade die Seite neu und melde dich an.');
          if (!r.ok) throw new Error(data.error || 'Das hat nicht geklappt. Bitte versuche es noch einmal.');
          return data;
        });
      }, function () { throw new Error('Keine Verbindung zum Server. Prüfe deine Internetverbindung.'); });
  }

  function updateProgress(p) {
    if (!p) return;
    var c = $('[data-progress-count]'), b = $('[data-progress-bar]'), t = $('[data-progress-pct]');
    if (c) c.textContent = p.done + ' / ' + p.total;
    if (b) b.style.width = p.prozent + '%';
    if (t) t.textContent = p.prozent + ' %';
  }

  // ------------------------------------------------------------ Antwort einsammeln
  function collect(form) {
    var a = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || ((el.type === 'radio' || el.type === 'checkbox') && !el.checked)) return;
      if (a[el.name] === undefined) a[el.name] = el.value;
      else a[el.name] = [].concat(a[el.name], el.value);
    });
    return a;
  }

  function clearMarks(card) {
    $$('[data-mark]', card).forEach(function (el) { el.classList.remove('mark-richtig', 'mark-falsch'); });
  }
  function applyMarks(card, marks) {
    clearMarks(card);
    Object.keys(marks || {}).forEach(function (k) {
      var el = $('[data-mark="' + k + '"]', card);
      if (el) el.classList.add('mark-' + marks[k]);
    });
  }
  function setLocked(card, locked) {
    $$('.ex-form input, .ex-form select, .ex-form textarea, .ex-form .mini', card).forEach(function (el) { el.disabled = locked; });
    $('.ex-form [type=submit]', card).hidden = locked;
  }

  var TITLES = {
    richtig: '✓ Richtig!',
    teilweise: '◐ Teilweise richtig',
    falsch: '✗ Noch nicht richtig',
    selbst: 'Vergleiche selbst',
    geloest: 'Lösung'
  };

  function showResult(card, r) {
    var box = $('[data-result]', card);
    var html = '<div class="res res-' + r.status + '"><p class="res-title">' + TITLES[r.status] + '</p>';
    if (r.feedback) html += '<div class="res-feedback">' + r.feedback + '</div>';
    if (r.hinweis) html += '<div class="res-hint"><strong>Tipp:</strong> ' + r.hinweis + '</div>';
    if (r.loesung) html += '<div class="res-solution">' + r.loesung + '</div>';
    if (r.erklaerung) html += '<div class="res-explain"><strong>Warum?</strong>' + r.erklaerung + '</div>';
    if (r.status === 'selbst') {
      html += '<div class="self" role="group" aria-label="Selbsteinschätzung"><p><strong>Wie war deine Antwort?</strong></p>' +
        '<button type="button" class="btn ok" data-self="1">Im Kern richtig</button> ' +
        '<button type="button" class="btn" data-self="0">Noch nicht ganz</button></div>';
    }
    box.innerHTML = html + '</div>';
    applyMarks(card, r.marks);
    var done = r.status === 'richtig' || r.status === 'geloest' || r.status === 'selbst';
    setLocked(card, done);
    $('[data-retry]', card).hidden = done;
    $('[data-reveal]', card).hidden = done;
    if (r.status === 'richtig') { card.classList.add('solved'); $('[data-state]', card).textContent = '✓ gelöst'; }
    updateProgress(r.fortschritt);
    box.focus && box.setAttribute('tabindex', '-1');
  }

  function showError(card, msg) {
    $('[data-result]', card).innerHTML = '<p class="res-error" role="alert">' + msg + '</p>';
  }

  // ------------------------------------------------------------ Übungen
  $$('.exercise').forEach(function (card) {
    var id = card.dataset.id, form = $('.ex-form', card);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('[type=submit]', form);
      btn.disabled = true;
      post('/api/uebung/' + encodeURIComponent(id), { antwort: collect(form) })
        .then(function (r) { showResult(card, r); }, function (err) { showError(card, err.message); })
        .then(function () { btn.disabled = false; });
    });

    // Fehlermeldung verschwindet, sobald man etwas ändert
    form.addEventListener('input', function () { var e = $('.res-error', card); if (e) e.remove(); });

    $('[data-retry]', card).addEventListener('click', function () {
      $('[data-result]', card).innerHTML = '';
      clearMarks(card);
      this.hidden = true;
      $('[data-reveal]', card).hidden = true;
      var first = $('input:not([type=hidden]), select, textarea', form);
      if (first) first.focus();
    });

    $('[data-reveal]', card).addEventListener('click', function () {
      post('/api/uebung/' + encodeURIComponent(id) + '/loesung')
        .then(function (r) { showResult(card, r); }, function (err) { showError(card, err.message); });
    });

    // Selbsteinschätzung bei freien Antworten
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-self]');
      if (!b) return;
      var ok = b.dataset.self === '1';
      var ta = $('textarea', card);
      post('/api/uebung/' + encodeURIComponent(id) + '/selbst', { ok: ok, text: ta ? ta.value : '' }).then(function (r) {
        var s = $('.self', card);
        s.innerHTML = ok ? '<p class="ok-text">✓ Gespeichert. Gut gemacht!</p>'
          : '<p>Gespeichert. Lies dir die Musterlösung in Ruhe durch und versuche es später noch einmal.</p>' +
            '<button type="button" class="btn" data-again>Neue Antwort schreiben</button>';
        if (ok) { card.classList.add('solved'); $('[data-state]', card).textContent = '✓ gelöst'; }
        updateProgress(r.fortschritt);
      }, function (err) { showError(card, err.message); });
    });
    card.addEventListener('click', function (e) {
      if (!e.target.closest('[data-again]')) return;
      $('[data-result]', card).innerHTML = '';
      setLocked(card, false);
      var ta = $('textarea', card); if (ta) ta.focus();
    });

    // Reihenfolge: Elemente mit ↑/↓ verschieben
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move]');
      if (!b || b.disabled) return;
      var li = b.closest('li'), list = li.parentNode, dir = Number(b.dataset.move);
      var other = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
      if (!other) return;
      if (dir < 0) list.insertBefore(li, other); else list.insertBefore(other, li);
      b.focus();
    });
  });

  // ------------------------------------------------------------ Filter
  var filterBtns = $$('[data-filter]');
  filterBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.filter, shown = 0;
      filterBtns.forEach(function (x) { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      $$('.exercise').forEach(function (c) {
        var show = f === 'alle' || (f === 'offen' ? !c.classList.contains('solved') : c.dataset.diff === f);
        c.hidden = !show; if (show) shown++;
      });
      var empty = $('.filter-empty'); if (empty) empty.hidden = shown > 0;
    });
  });

  // ------------------------------------------------------------ „Verstanden“
  var und = $('[data-understood]');
  if (und) und.addEventListener('click', function () {
    var on = und.dataset.understood !== '1';
    post('/api/verstanden/' + encodeURIComponent(und.dataset.topic), { done: on }).then(function (r) {
      und.dataset.understood = on ? '1' : '0';
      und.textContent = on ? '✓ Verstanden' : 'Ich habe es verstanden';
      und.classList.toggle('ok', on);
      var s = $('.topic-status span');
      if (s) { s.textContent = 'Verstehen ' + (on ? '✓' : '○'); s.className = on ? 'ok-text' : 'muted'; }
      updateProgress(r.fortschritt);
    }, function (err) { alert(err.message); });
  });

  // ------------------------------------------------------------ Eingebettete interaktive Erklärungen
  // Lektionen melden ihre Höhe ({type:'lernseite:hoehe', h}) und „erledigt“ ({type:'lernseite:erledigt'}).
  var frames = $$('.interactive iframe');
  window.addEventListener('message', function (e) {
    var f = frames.filter(function (x) { return x.contentWindow === e.source; })[0];
    if (!f || !e.data) return;
    if (e.data.type === 'lernseite:hoehe' && e.data.h > 100) f.style.height = Math.min(3000, Math.ceil(e.data.h) + 4) + 'px';
    if (e.data.type === 'lernseite:erledigt') {
      var fig = f.closest('[data-lesson]');
      post('/api/fortschritt', { slug: fig.dataset.lesson, done: true }).then(function () {
        var cap = $('figcaption strong', fig);
        if (cap && !$('.badge', fig)) cap.insertAdjacentHTML('afterend', ' <span class="badge ok">✓ ausprobiert</span>');
      }, function () {});
    }
  });
})();
