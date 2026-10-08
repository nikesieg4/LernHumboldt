// Hilfen für interaktive Erklärungen (lessons/k9-*).
// Einbinden mit <script src="../../static/lesson-kit.js"></script>
//
//   LK.fmt(zahl, stellen)   deutsche Zahl, z. B. LK.fmt(0.25, 2) → "0,25"
//   LK.reach('ziel-id')     Ziel-Aufgabe <div class="task" data-goal="ziel-id"> als erledigt markieren
//   Fragen:  <div class="task"><p class="task-q">…</p><div class="choices">
//              <button data-ok data-fb="Begründung">richtig</button><button data-fb="Warum falsch">…</button>
//            </div><p class="fb"></p></div>
//   Sind alle Aufgaben erledigt, meldet die Seite „erledigt“ an die Lernseite.
(function () {
  'use strict';
  var inFrame = window.parent && window.parent !== window;
  var sent = false;

  function fmt(x, digits) {
    if (!isFinite(x)) return '–';
    return Number(x).toLocaleString('de-DE', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  function check() {
    var tasks = document.querySelectorAll('.task');
    var done = document.querySelectorAll('.task.done').length;
    var c = document.querySelector('[data-task-count]');
    if (c) c.textContent = done + ' / ' + tasks.length;
    if (tasks.length && done === tasks.length) {
      var box = document.querySelector('.all-done');
      if (box) box.classList.add('show');
      if (inFrame && !sent) { sent = true; window.parent.postMessage({ type: 'lernseite:erledigt' }, '*'); }
    }
  }

  function reach(id) {
    var t = document.querySelector('.task[data-goal="' + id + '"]');
    if (t && !t.classList.contains('done')) { t.classList.add('done'); check(); }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.choices button');
    if (!b) return;
    var task = b.closest('.task'), fb = task.querySelector('.fb');
    task.querySelectorAll('.choices button').forEach(function (x) { x.classList.remove('wrong'); });
    if (b.hasAttribute('data-ok')) {
      b.classList.add('right');
      task.classList.add('done');
      task.querySelectorAll('.choices button').forEach(function (x) { x.disabled = true; });
      fb.textContent = '✓ ' + (b.dataset.fb || 'Richtig!');
      check();
    } else {
      b.classList.add('wrong');
      fb.textContent = b.dataset.fb || 'Noch nicht. Probiere es in der Simulation aus und versuche es noch einmal.';
    }
  });

  // Höhe an die Lernseite melden, damit der Rahmen genau passt
  function reportHeight() {
    if (inFrame) window.parent.postMessage({ type: 'lernseite:hoehe', h: document.documentElement.scrollHeight }, '*');
  }
  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.documentElement);
  window.addEventListener('load', function () { reportHeight(); check(); });

  window.LK = { fmt: fmt, reach: reach, check: check };
})();
