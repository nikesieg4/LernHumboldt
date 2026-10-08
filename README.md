# Lernseite

Eine kleine Lernplattform für interaktive Lerneinheiten (HTML-Simulationen, Quizze …).
Schüler/innen melden sich **mit ihrem IServ-Konto** an, die Lernseite speichert, welche
Lerneinheiten sie erledigt haben, und Lehrkräfte sehen den Fortschritt ihrer Klassen.

- **Anmeldung über IServ (Single-Sign-On).** Das Passwort wird nur bei IServ eingegeben.
  Die Lernseite bekommt Benutzername, Name, E-Mail und Rollen, aber nie das Passwort.
- **Schülerliste** (CSV mit E-Mail, Name, Klasse) bestimmt, wer rein darf und in welcher Klasse er ist.
- **Lerneinheiten** sind einfach Ordner mit einer `index.html`. Neue Ordner erscheinen automatisch.
- **Fortschritt:** pro Schüler/in und Lerneinheit, Übersicht als Tabelle pro Klasse.
- **Physik nach dem Schulcurriculum (SchiC):** Klassenstufe wählen → Themenfeld → Thema mit
  **Verstehen** (Erklärung, Formeln, interaktive Simulation) und **Üben** (Aufgaben mit Feedback,
  Lösungsweg und Fortschritt). Klasse 9 ist komplett, 7, 8 und 10 sind als Gerüst angelegt.

> **Schnellstart:** Wie du das Projekt auf GitHub hochlädst und ohne IServ-Login testest,
> steht in [ANLEITUNG-GITHUB.md](ANLEITUNG-GITHUB.md).

---

## 1. Ausprobieren auf dem eigenen Rechner

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
cp .env.example .env
```

In `.env` zum Testen setzen:

```
BASE_URL=http://localhost:3000
DEV_LOGIN=true
ROSTER_REQUIRED=false
```

Dann starten und <http://localhost:3000> öffnen:

```bash
npm start
```

Mit `DEV_LOGIN=true` gibt es einen Test-Login ohne IServ, bei dem man auch die Rolle
(Schüler/in, Lehrkraft, Admin) auswählen kann. **Im echten Betrieb muss `DEV_LOGIN=false` sein.**

---

## 2. IServ-Anmeldung einrichten (macht der IServ-Admin)

In IServ unter **Verwaltung → System → Single-Sign-On → Hinzufügen → OAuth-Client**:

| Feld | Wert |
|---|---|
| Name | z. B. `Lernseite` |
| Weiterleitungs-URI | `https://lernen.meine-schule.de/auth/callback` (eure Subdomain) |
| Vertrauenswürdig | ja (sonst muss jeder Schüler die Freigabe einmal bestätigen) |
| Scopes / Einschränkungen | **OpenID, Profil, E-Mail, Rollen** |

Danach zeigt IServ eine **Client-ID** und ein **Client-Secret**. Beides kommt in die `.env`:

```
ISERV_URL=https://meine-schule.de
ISERV_CLIENT_ID=...
ISERV_CLIENT_SECRET=...
```

Benutzte Adressen (fest eingebaut in `src/iserv.js`):

- Anmeldung: `ISERV_URL/iserv/oauth/v2/auth`
- Token: `ISERV_URL/iserv/oauth/v2/token`
- Benutzerdaten: `ISERV_URL/iserv/public/oauth/userinfo`

### Lehrkräfte und Admins

- **Lehrkraft** ist, wer in IServ eine der Rollen aus `TEACHER_ROLES` hat. Welche Rollen-IDs
  eure IServ liefert, steht nach dem ersten Login unter **/admin → Angemeldete Konten → IServ-Rollen**.
- **Admin** ist, wessen IServ-Benutzername oder E-Mail in `ADMIN_USERS` steht.
  Admins können die Schülerliste hochladen und alle Konten sehen.

---

## 3. Auf der Schul-Subdomain betreiben (Docker)

Ihr braucht einen Server (Schulserver oder gemieteter VPS) mit Docker, und die Subdomain
(z. B. `lernen.meine-schule.de`) muss per DNS auf diesen Server zeigen.

```bash
cp .env.example .env      # BASE_URL, DOMAIN, SESSION_SECRET, ISERV_… eintragen
openssl rand -hex 32      # Ausgabe als SESSION_SECRET verwenden
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
```

Caddy holt automatisch ein HTTPS-Zertifikat für `DOMAIN`. Die Datenbank liegt in `data/`,
die Lerneinheiten in `lessons/`. **Sichert den Ordner `data/` regelmäßig.**

Ohne Docker geht es auch: `npm install --omit=dev` und `npm start` hinter einem
Reverse-Proxy (nginx, Apache) mit HTTPS. Wichtig: der Proxy muss den `Host`-Header durchreichen.

### Automatische Updates aus GitHub

Lege den **entpackten** Projektordner in ein GitHub-Repository (nicht die ZIP).
`.env` und `data/` stehen in der `.gitignore` und landen nie auf GitHub.

Auf dem Server einmalig:

```bash
sudo git clone https://github.com/DEIN-NAME/lernseite.git /opt/lernseite
cd /opt/lernseite
cp .env.example .env            # ausfüllen wie oben
mkdir -p data && sudo chown 1000:1000 data
chmod +x update.sh
docker compose up -d --build
```

Dann `crontab -e` und diese Zeile eintragen:

```
*/5 * * * * /opt/lernseite/update.sh >> /var/log/lernseite-update.log 2>&1
```

Ab jetzt prüft der Server alle 5 Minuten, ob es auf GitHub etwas Neues gibt.
Neue oder geänderte Lerneinheiten sind sofort online, bei Code-Änderungen startet
die Seite kurz neu. Konten, Fortschritt und Schülerliste bleiben dabei erhalten.

**Privates Repository?** Dann braucht der Server einen Lesezugriff. Am einfachsten
mit einem *Deploy Key*: auf dem Server `ssh-keygen -t ed25519 -f ~/.ssh/lernseite`,
den Inhalt von `~/.ssh/lernseite.pub` auf GitHub unter
**Settings → Deploy keys** (nur Lesen) eintragen und per SSH klonen:
`GIT_SSH_COMMAND="ssh -i ~/.ssh/lernseite" git clone git@github.com:DEIN-NAME/lernseite.git /opt/lernseite`,
danach `git config core.sshCommand "ssh -i ~/.ssh/lernseite"` im Ordner setzen.

---

## 4. Schülerliste

Unter **/admin** (nur Admins) als CSV hochladen oder einfügen, eine Zeile pro Schüler/in:

```
E-Mail;Name;Klasse
max.muster@meine-schule.de;Max Muster;10a
erika.beispiel@meine-schule.de;Erika Beispiel;10b
```

- Kopfzeile optional. Spalten werden an den Namen erkannt (`E-Mail`, `Name` oder `Vorname`/`Nachname`, `Klasse`).
- Trennzeichen `;`, `,` oder Tab. Ein IServ-Export (Benutzerliste als CSV) passt meist direkt.
- Die E-Mail muss die IServ-Adresse sein, denn die kommt beim Login von IServ zurück.
- Speichern ersetzt die ganze Liste. Bestehende Konten bekommen dabei ihre neue Klasse.
- **Keine Passwörter in die Liste schreiben.** Die braucht die Lernseite nicht.

Mit `ROSTER_REQUIRED=true` kommen nur Schüler/innen aus der Liste rein (Lehrkräfte und Admins immer).
Mit `false` darf jedes IServ-Konto rein, die Liste ordnet dann nur die Klassen zu.

---

## 5. Lerneinheiten erstellen

Jede Lerneinheit ist ein Ordner in `lessons/`:

```
lessons/
  ohmsches-gesetz/
    index.html      ← der Inhalt (beliebiges HTML/JS, auch mehrere Dateien)
    lesson.json     ← Titel, Fach, …
    bild.png        ← weitere Dateien, relativ eingebunden
```

Am einfachsten `lessons/_vorlage` kopieren. Ordnernamen nur mit Kleinbuchstaben, Ziffern und `-`.
Ordner mit `_` am Anfang werden nicht angezeigt.

`lesson.json`:

```json
{
  "title": "Ohmsches Gesetz",
  "subject": "Physik",
  "description": "Kurzer Text für die Übersicht",
  "minutes": 15,
  "order": 10,
  "classes": ["10a", "10b"],
  "hidden": false
}
```

- `subject` gruppiert die Übersicht, `order` sortiert innerhalb des Fachs.
- `classes` (optional): nur diese Klassen sehen die Einheit. Weglassen oder `null` = alle.
- `hidden: true` blendet die Einheit aus.

**Fortschritt melden:** Wenn eine Einheit geschafft ist, ruft sie

```js
window.parent.postMessage({ type: 'lernseite:erledigt' }, '*');
```

auf. Sonst können Schüler/innen oben auf „Als erledigt markieren“ klicken.
Die Diodenschaltung meldet sich z. B. als erledigt, sobald alle vier Schalterstellungen ausprobiert wurden.

> Lerneinheiten laufen mit den Rechten der Lernseite. Legt daher nur Dateien von
> vertrauenswürdigen Personen (Lehrkräfte, Admins) in `lessons/`.

---

## 6. Physik-Inhalte (Klassenstufen, Themen, Übungen)

Die Inhalte liegen als JSON-Dateien in `content/physik/` und folgen dem SchiC:

```
content/physik/
  stufen.json                        ← Klassenstufen (für 11/12 einfach ergänzen)
  klasse-9/
    3-06-elektrik/
      themenfeld.json                ← Nummer, Titel, Inhalte laut SchiC
      2-ohmsches-gesetz.json         ← ein Thema: Lernziele, Erklärung, Übungen
```

Eine Klassenstufe erscheint automatisch, sobald es für sie einen Ordner mit mindestens einem
Themenfeld gibt (deshalb sind 5 und 6 ausgeblendet). Ein Themenfeld ohne Themen wird als
„In Vorbereitung“ mit den SchiC-Inhalten angezeigt.

**Ein Thema** (`<name>.json`) enthält:

| Feld | Bedeutung |
|---|---|
| `id`, `titel`, `kurz`, `reihenfolge` | Kennung (eindeutig), Name, Kurzbeschreibung, Sortierung |
| `lernziele` | `[{ "id": "lz1", "niveau": "E", "text": "…" }]` |
| `verstehen` | `einstieg`, `abschnitte` (`titel`, `text`), `formeln` (`formel`, `bedeutung`), `merksatz`, `alltag` |
| `interaktiv` | Ordnernamen aus `lessons/`, die auf der Verstehen-Seite eingebettet werden |
| `vertiefung` | weitere Lerneinheiten „für Schnelle“ |
| `uebungen` | Liste der Übungen (siehe unten) |

**Formeln in Texten:** `` `R = U / I` `` (Formelschrift), `\frac{U}{I}` (Bruch, in JSON mit doppeltem
Backslash), `R_{ges}` (tiefgestellt), `10^{3}` (hochgestellt), `**fett**`, Leerzeile = neuer Absatz.

**Übungen** haben immer `id` (eindeutig), `typ`, `schwierigkeit` (`leicht`/`mittel`/`schwer`),
`lernziel`, `frage`, `erklaerung` (wird nach der Lösung gezeigt) und optional `hinweis`
(wird nach einer falschen Antwort gezeigt). Dazu je nach Typ:

| Typ | Felder |
|---|---|
| `single` | `optionen: [{ text, richtig?, feedback? }]`, genau eine richtig |
| `multi` | wie `single`, mehrere richtig |
| `zahl` | `loesung`, `einheit`, `alternativEinheiten` (z. B. `{ "mA": 0.001 }`), `toleranz` (Standard 0,02), `gegeben`, `gesucht`, `gesuchtSymbol`, `rechenweg: [Schritte]` |
| `text` | `musterloesung`, `stichworte: [{ aspekt, woerter: [...] }]` – Bewertung ohne KI: Stichwort-Check, Musterlösung, Selbsteinschätzung |
| `zuordnung` | `paare: [{ links, rechts }]`, `extraRechts` (Ablenker) |
| `reihenfolge` | `elemente` in richtiger Reihenfolge |

Die Lösungen werden **auf dem Server** geprüft und stehen nicht im Seitenquelltext.
Eine Übung zählt als gelöst, wenn sie richtig beantwortet wurde, bevor die Lösung angezeigt wurde.

**Neuen Aufgabentyp hinzufügen:** in `src/exercises.js` einen Eintrag in `TYPES` mit
`validate`, `render`, `check` und `solution` ergänzen. Formularfelder werden vom Browser
automatisch eingesammelt (`public/uebung.js`).

**Interaktive Erklärungen** sind normale Lerneinheiten in `lessons/` (z. B. `k9-ohmsches-gesetz`).
Mit `public/lesson-kit.css` und `public/lesson-kit.js` bekommen sie das gemeinsame Aussehen,
„Entdecke selbst“-Aufgaben und passen ihre Höhe automatisch an.

**Prüfen vor dem Hochladen:**

```bash
npm run check   # findet Tippfehler, doppelte IDs, fehlende Lösungen, kaputte Verweise
npm test        # automatische Tests (Übungslogik, Inhalte, Server)
```

Fehlerhafte Übungen werden beim Start übersprungen und im Log gemeldet. Der Rest läuft weiter.

---

## 7. Datenschutz (bitte mit der Schulleitung / dem DSB klären)

Gespeichert werden: IServ-Benutzername, Name, E-Mail, Klasse, IServ-Rollen, letzter Login,
welche Lerneinheit wann erledigt wurde sowie jeder Übungsversuch (Antwort, richtig/falsch,
Zeitpunkt). Lehrkräfte sehen pro Klasse nur den Fortschritt in Prozent. Keine Passwörter, keine Tracking-Dienste,
keine externen Skripte (die Seite lädt nichts von fremden Servern).
Der Login-Cookie ist technisch notwendig und läuft nach 12 Stunden ab.

Für den Betrieb an einer Schule braucht ihr in der Regel die Zustimmung der Schulleitung,
einen Eintrag ins Verzeichnis der Verarbeitungstätigkeiten und ggf. einen Vertrag zur
Auftragsverarbeitung mit dem Hoster. Konten entfernen geht über die Datenbank
(`DELETE FROM users WHERE username = '…'`, der Fortschritt wird mitgelöscht).

---

## Aufbau

```
server.js          Routen: Login, Übersicht, Lerneinheiten, Fortschritt, Verwaltung
src/config.js      liest .env
src/db.js          SQLite-Datenbank (data/lernseite.db)
src/iserv.js       IServ-Login (OAuth 2 mit PKCE)
src/lessons.js     liest die Ordner in lessons/
src/views.js       HTML der Seiten
src/physik.js      lädt content/physik, Klassenstufen, Fortschritt
src/exercises.js   Übungs-Engine (Aufgabentypen, Bewertung)
src/views-physik.js  Seiten des Physik-Bereichs
src/markup.js      Formel-Auszeichnung für Texte
public/style.css   Aussehen (hell/dunkel automatisch)
public/uebung.js   Übungen im Browser (Abschicken, Feedback)
public/lesson-kit.*  gemeinsame Bausteine der interaktiven Erklärungen
content/physik/    Physik-Inhalte nach SchiC
test/              automatische Tests (npm test)
```

| Adresse | Zweck |
|---|---|
| `/` | Login bzw. Übersicht der Lerneinheiten |
| `/lektion/<name>` | Lerneinheit mit „Erledigt“-Knopf |
| `/inhalt/<name>/…` | Dateien der Lerneinheit (nur angemeldet) |
| `/admin` | Fortschritt pro Klasse (Physik und Lerneinheiten), Schülerliste, Konten |
| `/physik` | Klassenstufe wählen |
| `/physik/<stufe>` | Themenfelder und Themen einer Klassenstufe |
| `/physik/<stufe>/<thema>` | Verstehen; `…/ueben` = Übungen |
| `POST /api/uebung/<id>` | `{ "antwort": {…} }` → Bewertung; `/loesung`, `/selbst` |
| `POST /api/verstanden/<thema>` | „Ich habe es verstanden“ |
| `/api/ich` | eigene Daten und Fortschritt als JSON |
| `POST /api/fortschritt` | `{ "slug": "...", "done": true }` |
