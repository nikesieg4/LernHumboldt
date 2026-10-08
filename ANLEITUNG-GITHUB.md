# Lernseite auf GitHub hochladen und testen (ohne IServ-Login)

Diese Anleitung zeigt drei Wege zum Testen, vom einfachsten zum vollständigsten:

| Weg | Was du brauchst | Was du testen kannst |
|---|---|---|
| **A. Testseite auf GitHub Pages** | nur ein GitHub-Konto | Klassenstufen, Themen, Erklärungen, alle Übungen. Fortschritt nur im eigenen Browser |
| **B. GitHub Codespaces** | GitHub-Konto, nichts installieren | die **echte** Lernseite mit Test-Login, Schülerliste, Lehreransicht und Datenbank |
| **C. Auf dem eigenen Rechner** | Node.js 20 oder neuer | wie B, aber lokal |

Der IServ-Login (OAuth) wird bei keinem dieser Wege gebraucht. Stattdessen gibt es einen **Test-Login**, bei dem du Name und Rolle selbst wählst.

---

## 1. Projekt auf GitHub hochladen

### 1.1 Repository anlegen

1. Auf <https://github.com> anmelden, oben rechts **+** → **New repository**.
2. Name, z. B. `lernseite`.
3. **Public** wählen, wenn du die Testseite über GitHub Pages veröffentlichen willst. Beim kostenlosen Konto geht Pages nur mit öffentlichen Repositories. Für Weg B und C reicht auch **Private**.
4. **Kein** Häkchen bei „Add a README“ (das Projekt bringt eine mit) → **Create repository**.

### 1.2 Dateien hochladen

**Variante 1: Vom iPad oder Tablet (empfohlen, wenn man keine versteckten Dateien sieht)**

Auf iPads (besonders mit Schul-Verwaltung/MDM) kann man versteckte Dateien nicht einblenden. Deshalb lädst du hier **nur die ZIP-Datei** hoch, und GitHub packt sie selbst aus. Die ZIP musst du dafür nicht entpacken.

1. Beim Anlegen des Repositories (Schritt 1.1) **doch** das Häkchen bei **Add a README file** setzen, damit das Repository nicht leer ist. Die README wird später durch die richtige ersetzt.
2. Im Repository **Add file** → **Create new file**.
3. Als Dateinamen genau das eintippen (die Schrägstriche erzeugen automatisch Ordner):

   ```
   .github/workflows/zip-und-testseite.yml
   ```

4. In das große Textfeld den **kompletten Inhalt** der Datei `zip-und-testseite.yml` einfügen. Die Datei liegt der Anleitung bei und steckt außerdem in der ZIP im Ordner `vorlagen`. Am iPad: Datei in der Dateien-App antippen, alles markieren, kopieren.
5. **Commit changes…** → **Commit changes**.
6. **Settings** → **Pages** → bei **Source** die Option **GitHub Actions** wählen.
7. Zurück zum Reiter **Code** → **Add file** → **Upload files** → **choose your files** → in der Dateien-App `lernseite.zip` auswählen → **Commit changes**.
8. Reiter **Actions** öffnen. Der Workflow „ZIP entpacken und Testseite veröffentlichen“ läuft jetzt. Er packt die ZIP aus, übernimmt alle Dateien (auch die versteckten), löscht die ZIP und veröffentlicht die Testseite (siehe Weg A). Nach 1–2 Minuten ist alles fertig.

Für eine neue Version lädst du einfach die neue `lernseite.zip` hoch. Der Workflow ersetzt die Dateien und baut die Seite neu. Einzelne Dateien, z. B. eine Übung in `content/`, kannst du auch direkt auf GitHub mit dem Stift-Symbol bearbeiten. Auch das baut die Testseite neu.

> Der Workflow übernimmt aus der ZIP nie `.env`, `data`, `node_modules` und den Ordner `.github`. Workflows darf GitHub aus Sicherheitsgründen nicht automatisch ändern. Bei diesem Weg brauchst du die Datei `testseite.yml` nicht, `zip-und-testseite.yml` erledigt beides.

**Variante 2: Im Browser am Computer (Windows/macOS)**

1. `lernseite.zip` auf deinem Rechner entpacken.
2. Den Ordner `lernseite` öffnen. Du brauchst seinen **Inhalt**, nicht den Ordner selbst.
3. **Versteckte Dateien sichtbar machen**, denn einige Dateien beginnen mit einem Punkt (`.github`, `.gitignore`, `.env.example`, `.dockerignore`):
   - **Windows:** Explorer → *Ansicht* → *Einblenden* → *Ausgeblendete Elemente*
   - **macOS:** im Finder `Cmd` + `Shift` + `.` drücken
4. Im neuen Repository auf **uploading an existing file** klicken (oder **Add file** → **Upload files**).
5. **Alle Dateien und Ordner aus dem Ordner `lernseite`** markieren und in das Browserfenster ziehen. Der Ordner `.github` muss dabei sein, sonst funktioniert Weg A nicht.
6. Unten auf **Commit changes** klicken.

Danach muss die Startseite des Repositories so aussehen: ganz oben die Ordner `.github`, `content`, `lessons`, `public`, … und daneben `server.js`, `package.json`, `README.md`. Steht dort nur ein einzelner Ordner `lernseite`, hast du den Ordner statt seines Inhalts hochgeladen. Dann die Dateien löschen und noch einmal hochladen.

> **Niemals hochladen:** eine Datei `.env` (später mit dem IServ-Geheimnis), den Ordner `data` (Datenbank mit Schülerdaten) und den Ordner `node_modules`. In der ZIP sind sie nicht enthalten. Pass nur auf, falls du die Seite schon lokal gestartet hast.

**Variante 3: Mit GitHub Desktop (bequemer für spätere Änderungen)**

1. [GitHub Desktop](https://desktop.github.com) installieren und anmelden.
2. **File** → **Clone repository** → dein neues Repository wählen → in einen Ordner klonen.
3. Den **Inhalt** des entpackten Ordners `lernseite` in diesen Ordner kopieren.
4. In GitHub Desktop unten eine kurze Beschreibung eintragen (z. B. „Erste Version“) → **Commit to main** → **Push origin**.

Die `.gitignore` sorgt hier automatisch dafür, dass `.env`, `data` und `node_modules` nicht hochgeladen werden.

---

## 2. Weg A: Testseite auf GitHub Pages (ohne Server, ohne Login)

Das Projekt enthält eine fertige GitHub Action (`.github/workflows/testseite.yml`, bzw. beim iPad-Weg `zip-und-testseite.yml`). Sie prüft die Inhalte und baut daraus eine einzige HTML-Seite, die ohne Server läuft.

1. Im Repository: **Settings** → links **Pages**.
2. Bei **Build and deployment** → **Source** die Option **GitHub Actions** wählen.
3. Oben auf den Reiter **Actions** gehen. Dort läuft „Testseite auf GitHub Pages“ (beim iPad-Weg „ZIP entpacken und Testseite veröffentlichen“). Falls nicht: links den Workflow anklicken → **Run workflow**.
4. Nach etwa einer Minute erscheint ein grüner Haken. Die Seite ist dann unter dieser Adresse erreichbar:

   `https://DEIN-NAME.github.io/lernseite/`

   (Der Link steht auch unter **Settings** → **Pages** und im Workflow-Lauf beim Schritt *deploy*.)

**Was die Testseite kann:** Alle Klassenstufen, Themen, Erklärungen, interaktiven Simulationen und Übungen mit Feedback. Oben im orangen Balken kannst du eine Klasse simulieren (z. B. 9a) und den Fortschritt zurücksetzen. Der Fortschritt wird nur in deinem Browser gespeichert.

**Was sie nicht kann:** Anmeldung, Schülerliste, Lehrer-Übersicht und gemeinsamer Fortschritt. Außerdem stehen die Lösungen im Quelltext der Seite. Sie ist zum Ausprobieren und Zeigen gedacht, nicht für den Unterricht.

Jede Änderung, die du hochlädst (z. B. eine korrigierte Übung in `content/`), baut die Testseite automatisch neu.

**Falls der Workflow rot wird:** Den fehlgeschlagenen Lauf anklicken → Schritt **Inhalte prüfen** öffnen. Dort steht genau, in welcher Datei und welcher Übung der Fehler ist (z. B. ein vergessenes Komma im JSON).

---

## 3. Weg B: Die echte Lernseite in GitHub Codespaces testen

Codespaces startet einen kleinen Rechner in der Cloud, direkt aus deinem Repository. Du brauchst nichts zu installieren. Mit einem privaten GitHub-Konto sind jeden Monat etwa 60 Stunden kostenlos (Stand bei Redaktion dieser Anleitung, siehe GitHub-Hilfe).

Das funktioniert auch auf dem iPad in Safari.

1. Im Repository auf den grünen Knopf **Code** → Reiter **Codespaces** → **Create codespace on main**.
2. Es öffnet sich ein Editor im Browser. Unten ist ein **Terminal**. Dort nacheinander eingeben:

   ```bash
   npm install
   cp .env.example .env
   ```

3. Links die Datei `.env` öffnen und **diese Zeilen** so einstellen (die anderen dürfen leer bleiben):

   ```
   BASE_URL=http://localhost:3000
   SESSION_SECRET=irgendein-langer-test-text-123
   DEV_LOGIN=true
   ROSTER_REQUIRED=false
   ADMIN_USERS=admin
   ISERV_URL=
   ISERV_CLIENT_ID=
   ISERV_CLIENT_SECRET=
   ```

4. Im Terminal starten:

   ```bash
   npm start
   ```

   Es erscheinen u. a. die Zeilen `✔ Physik: 7, 8, 9, 10 Klassenstufen …` und `✔ Lernseite läuft auf Port 3000`.
5. Unten rechts erscheint ein Hinweis **Open in Browser**. Falls nicht: Reiter **Ports** → bei Port 3000 auf das Globus-Symbol klicken.

Die `.env` bleibt nur in deinem Codespace und wird nicht ins Repository übernommen. Den Codespace beendest du über **Code** → **Codespaces** → **…** → **Stop codespace**, damit er keine Freistunden verbraucht.

---

## 4. Weg C: Auf dem eigenen Rechner

1. [Node.js](https://nodejs.org) in Version 20 oder neuer installieren (LTS-Version).
2. ZIP entpacken (oder das Repository klonen) und im Ordner ein Terminal öffnen:
   - **Windows:** im Ordner in die Adresszeile `cmd` tippen und Enter drücken
   - **macOS:** Rechtsklick auf den Ordner → *Neues Terminal beim Ordner*
3. Eingeben:

   ```bash
   npm install
   ```

   Unter Windows `copy .env.example .env`, unter macOS/Linux `cp .env.example .env`.
4. `.env` mit einem Texteditor öffnen und dieselben Zeilen wie in Weg B, Schritt 3, eintragen.
5. `npm start` eingeben und im Browser <http://localhost:3000> öffnen.

---

## 5. Was du mit dem Test-Login ausprobieren kannst (Weg B und C)

Auf der Startseite gibt es unter „Mit IServ anmelden“ den Kasten **Test-Login**. Dort tippst du einen Benutzernamen ein, optional eine E-Mail, und wählst die Rolle. Ein Passwort gibt es nicht.

**1. Als Admin die Schülerliste anlegen**
- Anmelden mit Benutzername `admin`, Rolle **Admin**.
- Oben auf **Verwaltung** → bei **Schülerliste** einfügen:

  ```
  E-Mail;Name;Klasse
  max@test.de;Max Muster;9a
  erika@test.de;Erika Beispiel;9a
  tom@test.de;Tom Test;10b
  ```

- **Schülerliste speichern** → **Abmelden**.

**2. Als Schüler lernen**
- Anmelden mit Benutzername `max`, E-Mail `max@test.de`, Rolle **Schüler/in**.
- Auf der Startseite steht „Klasse 9“, weil Max in der Liste in der 9a ist.
- Ein Thema öffnen, z. B. **Widerstand und ohmsches Gesetz**:
  - **Verstehen:** Erklärung lesen, im Stromkreis-Labor Messreihen aufnehmen, „Ich habe es verstanden“ klicken.
  - **Üben:** Aufgaben falsch und richtig beantworten, „Lösung zeigen“ ausprobieren, eine freie Antwort schreiben.
- Oben siehst du den Fortschritt, z. B. „Übungen 4 / 10“.

**3. Als Lehrkraft den Fortschritt ansehen**
- Abmelden, anmelden mit Benutzername `lehrer`, Rolle **Lehrkraft**.
- **Verwaltung** → Klasse **9a** wählen → Tabelle mit dem Fortschritt pro Thema für Max und Erika.

**4. Zugangsschutz testen**
- In `.env` `ROSTER_REQUIRED=true` setzen und den Server neu starten (im Terminal `Strg` + `C`, dann wieder `npm start`).
- Jetzt kommen als Schüler nur noch die Personen aus der Schülerliste hinein. Ein Test-Login mit `fremd@test.de` wird abgelehnt.

Die Testdaten liegen in der Datei `data/lernseite.db`. Zum Zurücksetzen den Server stoppen und den Ordner `data` löschen.

---

## 6. Automatische Prüfungen

Im Terminal (Weg B oder C):

```bash
npm run check   # prüft alle Physik-Inhalte (Tippfehler, fehlende Lösungen, doppelte IDs)
npm test        # 20 automatische Tests: Übungslogik, Inhalte und der ganze Server
```

Beide sollten mit „Keine Fehler gefunden“ bzw. `# fail 0` enden. `npm test` startet dafür einen eigenen Test-Server mit leerer Datenbank. Deine Testdaten bleiben also unberührt.

Die Testseite aus Weg A kannst du auch lokal bauen: `npm run testseite` erzeugt die Datei `testseite.html`, die man einfach per Doppelklick im Browser öffnet.

---

## 7. Später: echter Betrieb mit IServ

Für den Unterricht mit echten Schülerkonten brauchst du einen Server und die IServ-Anmeldung. Die Schritte stehen in der `README.md` (Abschnitte 2 und 3). Wichtig ist dann:

- In der `.env` muss **`DEV_LOGIN=false`** stehen, sonst kann sich jeder ohne Passwort anmelden.
- `SESSION_SECRET` muss ein langes, zufälliges Geheimnis sein (`openssl rand -hex 32`).
- Die `.env` gehört **nie** ins Repository.
