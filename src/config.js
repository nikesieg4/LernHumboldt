import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env einlesen (falls vorhanden), ohne bereits gesetzte Variablen zu überschreiben
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const env = (k, d = '') => (process.env[k] ?? d).trim();
const list = (k, d = '') => env(k, d).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const bool = (k, d = 'false') => ['1', 'true', 'yes', 'ja'].includes(env(k, d).toLowerCase());

export const config = {
  port: parseInt(env('PORT', '3000'), 10),
  baseUrl: env('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
  siteName: env('SITE_NAME', 'Lernseite'),
  sessionSecret: env('SESSION_SECRET'),
  iserv: {
    url: env('ISERV_URL').replace(/\/+$/, ''),
    clientId: env('ISERV_CLIENT_ID'),
    clientSecret: env('ISERV_CLIENT_SECRET'),
  },
  teacherRoles: list('TEACHER_ROLES', 'ROLE_TEACHER'),
  adminUsers: list('ADMIN_USERS'),
  rosterRequired: bool('ROSTER_REQUIRED', 'true'),
  devLogin: bool('DEV_LOGIN'),
  dataDir: env('DATA_DIR', path.join(ROOT, 'data')),
  lessonsDir: env('LESSONS_DIR', path.join(ROOT, 'lessons')),
  contentDir: env('CONTENT_DIR', path.join(ROOT, 'content')),
};

config.secureCookies = config.baseUrl.startsWith('https://');
config.iservEnabled = Boolean(config.iserv.url && config.iserv.clientId && config.iserv.clientSecret);

/** Prüfungen, die nur für den Serverbetrieb nötig sind (nicht für Skripte und Tests). */
export function checkServerConfig() {
  if (!config.sessionSecret || config.sessionSecret === 'bitte-aendern') {
    if (config.devLogin) {
      config.sessionSecret = 'nur-zum-testen-' + config.port;
      console.warn('⚠  SESSION_SECRET fehlt – für den Testbetrieb wird ein unsicherer Wert benutzt.');
    } else {
      console.error('✖  SESSION_SECRET fehlt oder ist noch "bitte-aendern". Siehe .env.example.');
      process.exit(1);
    }
  }
  if (config.devLogin) console.warn('⚠  DEV_LOGIN ist aktiv: Jeder kann sich ohne Passwort anmelden. Nur zum Testen!');
  if (!config.iservEnabled && !config.devLogin) {
    console.warn('⚠  IServ-SSO ist nicht konfiguriert (ISERV_URL, ISERV_CLIENT_ID, ISERV_CLIENT_SECRET).');
  }
}
