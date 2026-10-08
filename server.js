import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieSession from 'cookie-session';
import { config, ROOT, checkServerConfig } from './src/config.js';
checkServerConfig();
import { q, replaceRoster, progressSets, understoodSlug } from './src/db.js';
import { startLogin, finishLogin } from './src/iserv.js';
import { lessonsFor, isValidSlug } from './src/lessons.js';
import * as views from './src/views.js';
import * as pviews from './src/views-physik.js';
import { content, visibleGrades, getGrade, gradeOf, topicsOfGrade, topicProgress, gradeProgress } from './src/physik.js';
import { checkAnswer, revealSolution } from './src/exercises.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // läuft hinter Caddy/nginx

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "frame-ancestors 'self'",
  });
  next();
});
app.use(cookieSession({
  name: 'lernseite',
  keys: [config.sessionSecret],
  httpOnly: true,
  sameSite: 'lax',
  secure: config.secureCookies,
  maxAge: 12 * 60 * 60 * 1000, // 12 Stunden
}));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.json({ limit: '20kb' }));
app.use('/static', express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));

// Angemeldeten Benutzer laden
app.use((req, res, next) => {
  req.user = req.session?.uid ? q.userById.get(req.session.uid) : null;
  if (req.session?.uid && !req.user) req.session = null;
  next();
});

// Schutz gegen Formular-Absendungen von fremden Seiten (CSRF)
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    try { if (new URL(origin).host !== (req.get('x-forwarded-host') || req.get('host'))) return res.status(403).send('Fremde Herkunft abgelehnt.'); }
    catch { return res.status(403).send('Ungültige Herkunft.'); }
  }
  next();
});

const requireLogin = (req, res, next) => {
  if (req.user) return next();
  if (req.method === 'GET' && req.accepts('html')) req.session.returnTo = req.originalUrl;
  return req.path.startsWith('/api/') ? res.status(401).json({ error: 'nicht angemeldet' }) : res.redirect('/');
};
const requireStaff = (req, res, next) => (req.user && req.user.role !== 'student' ? next() : res.status(403).send(views.messagePage({ title: 'Kein Zugriff', text: 'Dieser Bereich ist nur für Lehrkräfte.', user: req.user })));
const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).send(views.messagePage({ title: 'Kein Zugriff', text: 'Dieser Bereich ist nur für Admins.', user: req.user })));

// ---------------------------------------------------------------- Anmeldung

/** Legt das Konto an bzw. aktualisiert es. Gibt null zurück, wenn der Zugang verweigert wird. */
function upsertUser({ username, email, name, roles = [], forceRole = null }) {
  const lowerRoles = roles.map(r => r.toLowerCase());
  let role = 'student';
  if (lowerRoles.some(r => config.teacherRoles.includes(r))) role = 'teacher';
  if (config.adminUsers.includes(username) || (email && config.adminUsers.includes(email))) role = 'admin';
  if (forceRole) role = forceRole;

  const entry = email ? q.rosterByEmail.get(email) : null;
  if (role === 'student' && config.rosterRequired && !entry) return null;

  const existing = q.userByUsername.get(username);
  const data = {
    username, email, name: entry?.name || name || username, role,
    klasse: entry?.klasse || existing?.klasse || null,
    iserv_roles: roles.join(', '),
  };
  if (existing) { q.updateUser.run({ ...data, id: existing.id }); return existing.id; }
  return q.insertUser.run(data).lastInsertRowid;
}

function loginDone(req, res, uid) {
  const target = req.session.returnTo;
  req.session = { uid: Number(uid) };
  res.redirect(target && target.startsWith('/') && !target.startsWith('//') ? target : '/');
}

app.get('/auth/login', (req, res) => {
  if (!config.iservEnabled) return res.status(503).send(views.loginPage({ error: 'IServ-Anmeldung ist nicht eingerichtet.' }));
  const { url, state, verifier } = startLogin();
  req.session.oauth = { state, verifier, t: Date.now() };
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const saved = req.session.oauth;
  delete req.session.oauth;
  if (req.query.error) return res.status(400).send(views.loginPage({ error: `IServ hat die Anmeldung abgebrochen (${req.query.error}).` }));
  if (!saved || req.query.state !== saved.state || Date.now() - saved.t > 10 * 60 * 1000) {
    return res.status(400).send(views.loginPage({ error: 'Die Anmeldung ist abgelaufen. Bitte noch einmal versuchen.' }));
  }
  try {
    const info = await finishLogin(String(req.query.code || ''), saved.verifier);
    if (!info.username) throw new Error('IServ hat keinen Benutzernamen geliefert.');
    const uid = upsertUser(info);
    if (!uid) {
      return res.status(403).send(views.messagePage({
        title: 'Noch nicht freigeschaltet',
        text: `Dein IServ-Konto (${views.esc(info.email || info.username)}) steht nicht auf der Schülerliste dieser Lernseite. Bitte wende dich an deine Lehrkraft.`,
      }));
    }
    loginDone(req, res, uid);
  } catch (err) {
    console.error('IServ-Login fehlgeschlagen:', err);
    res.status(502).send(views.loginPage({ error: 'Die Anmeldung bei IServ hat nicht geklappt. Bitte später noch einmal versuchen.' }));
  }
});

if (config.devLogin) {
  app.post('/auth/dev', (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,64}$/.test(username)) return res.status(400).send(views.loginPage({ error: 'Ungültiger Benutzername.' }));
    const role = ['student', 'teacher', 'admin'].includes(req.body.role) ? req.body.role : 'student';
    const email = String(req.body.email || '').trim().toLowerCase() || `${username}@test.local`;
    const uid = upsertUser({ username, email, name: username, forceRole: role });
    if (!uid) return res.status(403).send(views.loginPage({ error: `${email} steht nicht auf der Schülerliste (ROSTER_REQUIRED=true).` }));
    loginDone(req, res, uid);
  });
}

app.post('/auth/logout', (req, res) => { req.session = null; res.redirect('/'); });

// ---------------------------------------------------------------- Lerneinheiten

app.get('/', (req, res) => {
  if (!req.user) return res.send(views.loginPage());
  const done = new Set(q.progressOf.all(req.user.id).map(p => p.slug));
  // Lerneinheiten, die zu einem Physik-Thema gehören, erscheinen dort und nicht doppelt auf der Startseite
  const used = usedLessonSlugs();
  const lessons = lessonsFor(req.user).filter(l => !used.has(l.slug));
  res.send(views.homePage({ user: req.user, lessons, done, physik: physikHero(req.user) }));
});

// ---------------------------------------------------------------- Physik

function usedLessonSlugs() {
  const used = new Set();
  for (const t of content().topicById.values()) for (const s of [...t.interaktiv, ...t.vertiefung]) used.add(s);
  return used;
}

function physikHero(user) {
  const grades = visibleGrades();
  if (!grades.length) return null;
  const grade = grades.find(g => g.stufe === gradeOf(user.klasse));
  if (!grade || !topicsOfGrade(grade).length) {
    return { href: '/physik', titel: 'Wähle deine Klassenstufe', text: 'Interaktive Erklärungen und Übungen nach dem Schulcurriculum.', cta: 'Zur Auswahl' };
  }
  const sets = progressSets(user.id);
  const progress = gradeProgress(grade, sets.solved, sets.understood);
  return {
    href: `/physik/${grade.stufe}`, titel: grade.name, progress,
    text: `${topicsOfGrade(grade).length} Themen mit interaktiven Erklärungen und Übungen.`,
    cta: progress.done ? 'Weiterlernen' : 'Loslegen',
  };
}

const notFound = (req, res, text) => res.status(404).send(views.messagePage({ title: 'Nicht gefunden', text, user: req.user }));

app.get('/physik', requireLogin, (req, res) => {
  res.send(pviews.gradePickerPage({ user: req.user, grades: visibleGrades(), own: gradeOf(req.user.klasse), sets: progressSets(req.user.id) }));
});

app.get('/physik/:stufe', requireLogin, (req, res) => {
  const grade = getGrade(req.params.stufe);
  if (!grade) return notFound(req, res, 'Für diese Klassenstufe gibt es keine Inhalte.');
  res.send(pviews.gradePage({ user: req.user, grade, grades: visibleGrades(), sets: progressSets(req.user.id) }));
});

/** Gemeinsame Daten für beide Themen-Seiten. */
function topicContext(req, res) {
  const grade = getGrade(req.params.stufe);
  const topic = content().topicById.get(req.params.thema);
  if (!grade || !topic || topic.stufe !== grade.stufe) { notFound(req, res, 'Dieses Thema gibt es nicht.'); return null; }
  const sets = progressSets(req.user.id);
  const all = topicsOfGrade(grade);
  return { grade, topic, sets, progress: topicProgress(topic, sets.solved, sets.understood), nextTopic: all[all.indexOf(topic) + 1] || null };
}

app.get('/physik/:stufe/:thema', requireLogin, (req, res) => {
  const ctx = topicContext(req, res); if (!ctx) return;
  const visible = new Map(lessonsFor(req.user).map(l => [l.slug, l]));
  const pick = slugs => slugs.map(s => visible.get(s)).filter(Boolean);
  const lessonDone = new Set(q.progressOf.all(req.user.id).map(p => p.slug));
  res.send(pviews.topicUnderstandPage({ user: req.user, ...ctx, lessons: pick(ctx.topic.interaktiv), extras: pick(ctx.topic.vertiefung), lessonDone }));
});

app.get('/physik/:stufe/:thema/ueben', requireLogin, (req, res) => {
  const ctx = topicContext(req, res); if (!ctx) return;
  const stats = new Map(q.attemptStatsOf.all(req.user.id, ctx.topic.id).map(r => [r.exercise_id, r]));
  res.send(pviews.topicPracticePage({ user: req.user, ...ctx, solved: ctx.sets.solved, stats }));
});

function topicStatus(userId, topicId) {
  const sets = progressSets(userId);
  return topicProgress(content().topicById.get(topicId), sets.solved, sets.understood);
}

// Antwort prüfen
app.post('/api/uebung/:id', requireLogin, (req, res) => {
  const ex = content().exerciseById.get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Diese Aufgabe gibt es nicht (mehr). Lade die Seite neu.' });
  const antwort = req.body?.antwort && typeof req.body.antwort === 'object' ? req.body.antwort : {};
  const result = checkAnswer(ex, antwort);
  if (result.error) return res.status(400).json({ error: result.error });
  if (result.status !== 'selbst') {
    q.insertAttempt.run({ user_id: req.user.id, exercise_id: ex.id, topic_id: ex.topicId, correct: result.status === 'richtig' ? 1 : 0, revealed: 0, answer: JSON.stringify(antwort).slice(0, 2000) });
  }
  res.json({ ...result, fortschritt: topicStatus(req.user.id, ex.topicId) });
});

// Lösung auf Wunsch zeigen (zählt danach nicht mehr als gelöst)
app.post('/api/uebung/:id/loesung', requireLogin, (req, res) => {
  const ex = content().exerciseById.get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Diese Aufgabe gibt es nicht (mehr).' });
  q.insertAttempt.run({ user_id: req.user.id, exercise_id: ex.id, topic_id: ex.topicId, correct: 0, revealed: 1, answer: null });
  res.json({ ...revealSolution(ex), fortschritt: topicStatus(req.user.id, ex.topicId) });
});

// Selbsteinschätzung bei freien Antworten
app.post('/api/uebung/:id/selbst', requireLogin, (req, res) => {
  const ex = content().exerciseById.get(req.params.id);
  if (!ex || ex.typ !== 'text') return res.status(404).json({ error: 'Diese Aufgabe gibt es nicht.' });
  const ok = req.body?.ok === true;
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 2000) : null;
  q.insertAttempt.run({ user_id: req.user.id, exercise_id: ex.id, topic_id: ex.topicId, correct: ok ? 1 : 0, revealed: 0, answer: JSON.stringify({ text, selbst: ok }) });
  res.json({ status: ok ? 'richtig' : 'falsch', fortschritt: topicStatus(req.user.id, ex.topicId) });
});

// „Ich habe es verstanden“
app.post('/api/verstanden/:thema', requireLogin, (req, res) => {
  const topic = content().topicById.get(req.params.thema);
  if (!topic) return res.status(404).json({ error: 'Dieses Thema gibt es nicht.' });
  if (req.body?.done === false) q.unsetDone.run(req.user.id, understoodSlug(topic.id));
  else q.setDone.run(req.user.id, understoodSlug(topic.id));
  res.json({ ok: true, fortschritt: topicStatus(req.user.id, topic.id) });
});

const visibleLesson = (user, slug) => isValidSlug(slug) && lessonsFor(user).find(l => l.slug === slug);

app.get('/lektion/:slug', requireLogin, (req, res) => {
  const lesson = visibleLesson(req.user, req.params.slug);
  if (!lesson) return res.status(404).send(views.messagePage({ title: 'Nicht gefunden', text: 'Diese Lerneinheit gibt es nicht.', user: req.user }));
  const isDone = q.progressOf.all(req.user.id).some(p => p.slug === lesson.slug);
  res.send(views.lessonPage({ user: req.user, lesson, isDone }));
});

// Dateien einer Lektion (nur für angemeldete Benutzer)
app.get('/inhalt/:slug/*', requireLogin, (req, res) => {
  if (!visibleLesson(req.user, req.params.slug)) return res.sendStatus(404);
  const root = path.join(config.lessonsDir, req.params.slug);
  res.sendFile(req.params[0] || 'index.html', { root, dotfiles: 'deny' }, err => {
    if (err && !res.headersSent) res.sendStatus(err.statusCode === 403 ? 403 : 404);
  });
});

app.post('/api/fortschritt', requireLogin, (req, res) => {
  const { slug, done } = req.body || {};
  if (!visibleLesson(req.user, slug)) return res.status(400).json({ error: 'unbekannte Lerneinheit' });
  if (done) q.setDone.run(req.user.id, slug); else q.unsetDone.run(req.user.id, slug);
  res.json({ ok: true, slug, done: Boolean(done) });
});

app.get('/api/ich', requireLogin, (req, res) => {
  const { username, name, role, klasse } = req.user;
  res.json({ username, name, role, klasse, erledigt: q.progressOf.all(req.user.id) });
});

// ---------------------------------------------------------------- Verwaltung

function parseRoster(text) {
  const rows = [], errors = [];
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { rows, errors };
  const sep = [';', '\t', ','].find(s => lines[0].includes(s)) || ';';
  const split = l => l.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1').trim());
  let cols = { email: 0, name: 1, klasse: 2, vorname: -1, nachname: -1 };
  const head = split(lines[0]).map(h => h.toLowerCase());
  if (!head.some(h => h.includes('@'))) {
    const find = (...names) => head.findIndex(h => names.includes(h));
    cols = {
      email: find('email', 'e-mail', 'mail', 'emailadresse', 'e-mail-adresse'),
      name: find('name', 'anzeigename', 'schüler', 'schueler'),
      vorname: find('vorname', 'firstname'),
      nachname: find('nachname', 'familienname', 'lastname'),
      klasse: find('klasse', 'class', 'gruppe', 'lerngruppe'),
    };
    if (cols.email < 0) return { rows, errors: ['Keine Spalte "E-Mail" in der Kopfzeile gefunden.'] };
    lines.shift();
  }
  lines.forEach((line, i) => {
    const c = split(line);
    const email = (c[cols.email] || '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push(`Zeile ${i + 1}: "${email}" ist keine gültige E-Mail.`); return; }
    const name = cols.name >= 0 && c[cols.name] ? c[cols.name]
      : [c[cols.vorname], c[cols.nachname]].filter(Boolean).join(' ');
    rows.push({ email, name: name || null, klasse: (cols.klasse >= 0 && c[cols.klasse]) || null });
  });
  return { rows, errors };
}

app.get('/admin', requireStaff, (req, res) => {
  const lessons = lessonsFor({ role: 'teacher' });
  const classes = q.classes.all().map(r => r.klasse);
  const selected = classes.includes(req.query.klasse) ? req.query.klasse : null;
  let students = [], progress = new Map();
  if (selected) {
    students = q.studentsOfClass.all(selected);
    const ids = new Set(students.map(s => s.id));
    for (const p of q.allProgress.all()) {
      if (!ids.has(p.user_id)) continue;
      if (!progress.has(p.user_id)) progress.set(p.user_id, new Map());
      progress.get(p.user_id).set(p.slug, p.done_at);
    }
  }
  let physikHtml = '';
  if (selected) {
    const solvedBy = new Map(), understoodBy = new Map();
    const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
    for (const r of q.solvedOfClass.all(selected)) add(solvedBy, r.user_id, r.exercise_id);
    for (const r of q.understoodOfClass.all(selected)) add(understoodBy, r.user_id, r.topic_id);
    physikHtml = pviews.physicsMatrix({ grade: getGrade(gradeOf(selected)), students, solvedBy, understoodBy });
  }
  const isAdmin = req.user.role === 'admin';
  const notice = req.session.notice; delete req.session.notice;
  res.send(views.adminPage({
    user: req.user, lessons, classes, selected, students, progress, notice, physikHtml,
    roster: isAdmin ? q.allRoster.all() : [], users: isAdmin ? q.allUsers.all() : [],
  }));
});

app.post('/admin/schuelerliste', requireAdmin, (req, res) => {
  const { rows, errors } = parseRoster(req.body.csv);
  if (errors.length) {
    req.session.notice = `Nicht gespeichert: ${errors.slice(0, 5).join(' ')}${errors.length > 5 ? ` (und ${errors.length - 5} weitere Fehler)` : ''}`;
  } else {
    replaceRoster(rows);
    req.session.notice = `Schülerliste gespeichert: ${rows.length} Einträge.`;
  }
  res.redirect('/admin');
});

app.use((req, res) => res.status(404).send(views.messagePage({ title: 'Nicht gefunden', text: 'Diese Seite gibt es nicht.', user: req.user })));

if (!fs.existsSync(config.lessonsDir)) console.warn(`⚠  Lektionsordner ${config.lessonsDir} fehlt.`);
{
  const c = content();
  const n = c.stufen.reduce((a, g) => a + topicsOfGrade(g).length, 0);
  console.log(`✔  Physik: ${visibleGrades().map(g => g.stufe).join(', ') || 'keine'} Klassenstufen, ${n} Themen, ${c.exerciseById.size} Übungen${c.errors.length ? `, ${c.errors.length} Fehler (siehe oben)` : ''}`);
}
app.listen(config.port, () => console.log(`✔  ${config.siteName} läuft auf Port ${config.port} (${config.baseUrl})`));
