// Anmeldung über IServ (OAuth 2 / OpenID Connect, Authorization-Code-Flow mit PKCE).
// Die Lernseite sieht das IServ-Passwort NIE: Die Eingabe passiert auf der IServ-Seite,
// zurück kommen nur Name, Benutzername, E-Mail und Rollen.
import crypto from 'node:crypto';
import { config } from './config.js';

const b64url = buf => buf.toString('base64url');

export const endpoints = () => ({
  auth: `${config.iserv.url}/iserv/oauth/v2/auth`,
  token: `${config.iserv.url}/iserv/oauth/v2/token`,
  userinfo: `${config.iserv.url}/iserv/public/oauth/userinfo`,
});

export const redirectUri = () => `${config.baseUrl}/auth/callback`;

/** Baut die Weiterleitungs-URL zu IServ und liefert die Werte, die in der Sitzung gemerkt werden müssen. */
export function startLogin() {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const url = new URL(endpoints().auth);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.iserv.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid profile email roles',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), state, verifier };
}

/** Tauscht den Code gegen ein Token und holt die Benutzerdaten. */
export async function finishLogin(code, verifier) {
  const tokenRes = await fetch(endpoints().token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(
        `${encodeURIComponent(config.iserv.clientId)}:${encodeURIComponent(config.iserv.clientSecret)}`
      ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token-Abruf fehlgeschlagen (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 300)}`);
  const token = await tokenRes.json();

  const infoRes = await fetch(endpoints().userinfo, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!infoRes.ok) throw new Error(`Benutzerdaten-Abruf fehlgeschlagen (${infoRes.status})`);
  const info = await infoRes.json();

  // IServ liefert Rollen als Liste von Objekten ({ id, displayName }) oder als Strings
  const roles = (Array.isArray(info.roles) ? info.roles : [])
    .map(r => (typeof r === 'string' ? r : r?.id))
    .filter(Boolean);

  return {
    username: String(info.preferred_username || info.sub || '').toLowerCase(),
    email: String(info.email || '').toLowerCase(),
    name: info.name || [info.given_name, info.family_name].filter(Boolean).join(' ') || info.preferred_username,
    roles,
  };
}
