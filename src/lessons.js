// Lektionen liegen als Ordner in lessons/<kurzname>/ mit index.html und lesson.json.
// Ordner, die mit "_" beginnen (z. B. _vorlage), werden nicht angezeigt.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
let cache = null, cacheTime = 0;

export function listLessons() {
  // Kurzer Cache, damit neue Lektionen ohne Neustart erscheinen
  if (cache && Date.now() - cacheTime < 5000) return cache;
  const out = [];
  if (fs.existsSync(config.lessonsDir)) {
    for (const slug of fs.readdirSync(config.lessonsDir)) {
      if (!SLUG.test(slug)) continue;
      const dir = path.join(config.lessonsDir, slug);
      if (!fs.existsSync(path.join(dir, 'index.html'))) continue;
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') console.warn(`lesson.json in "${slug}" ist fehlerhaft:`, e.message); }
      if (meta.hidden) continue;
      out.push({
        slug,
        title: meta.title || slug,
        subject: meta.subject || 'Allgemein',
        description: meta.description || '',
        minutes: meta.minutes || null,
        classes: Array.isArray(meta.classes) ? meta.classes.map(String) : null, // null = für alle
        order: Number.isFinite(meta.order) ? meta.order : 1000,
      });
    }
  }
  out.sort((a, b) => a.subject.localeCompare(b.subject, 'de') || a.order - b.order || a.title.localeCompare(b.title, 'de'));
  cache = out; cacheTime = Date.now();
  return out;
}

export const getLesson = slug => listLessons().find(l => l.slug === slug);

/** Welche Lektionen darf dieser Benutzer sehen? */
export function lessonsFor(user) {
  return listLessons().filter(l => user.role !== 'student' || !l.classes || l.classes.includes(user.klasse));
}

export const isValidSlug = s => typeof s === 'string' && SLUG.test(s);
