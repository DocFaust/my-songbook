# Converter-Dokumentation (UG -> ChordPro)

## Ziel

Der Converter wandelt einen eingegebenen Rohtext (z. B. aus Ultimate Guitar) in ChordPro-kompatiblen Text um, der anschliessend im Viewer gerendert und als Song gespeichert werden kann.

Zentrale Implementierung:

- `src/converter/convertToChordPro.js`
- `src/converter/chords.js`
- `src/converter/sections.js`

## Aufruf und Eingabe

Der Converter wird in `ImportPage` mit folgendem Eingabeobjekt aufgerufen:

```ts
convertToChordPro({
  title: string,
  artist: string,
  input: string,
  capo?: number | string,
  key?: string
})
```

Pflicht fuer sinnvolle Ausgabe:

- `input` sollte mehrzeiligen Songtext enthalten.
- `title` und `artist` koennen leer sein; im UI werden Defaultwerte gesetzt.

## Ausgabestruktur

Die Rueckgabe ist ein einzelner String im ChordPro-Format mit:

1. optionalen Header-Direktiven (`{title: ...}`, `{artist: ...}`, optional `{capo: ...}`, `{key: ...}`)
2. konvertierten Songzeilen
3. Absatztrennungen fuer Leerzeilen

## Verarbeitungslogik im Ueberblick

## 1) Header-Direktiven

`headerDirectives(...)` erzeugt:

- `{title: ...}` wenn Titel gesetzt ist
- `{artist: ...}` wenn Artist gesetzt ist
- `{capo: ...}` nur bei gueltigem Bereich `1..11`
- `{key: ...}` nur bei passendem Pattern (inkl. deutschem `H`)

Nach vorhandenen Headern wird eine Leerzeile eingefuegt.

## 2) Zeilenweises Parsing mit Puffer

`convertToChordPro(...)` iteriert ueber alle Eingabezeilen plus eine kuenstliche Sentinel-Leerzeile am Ende.

Es arbeitet mit einem `chordBuffer` fuer erkannte Akkordzeilen:

- Akkordzeile erkannt -> in `chordBuffer` legen (oder vorige Akkordzeile vorher flushen)
- Textzeile nach Akkordzeile -> Akkorde und Text zusammenfuehren
- Leerzeile -> ggf. gepufferte Akkordzeile als reine Akkordzeile ausgeben + Absatz

## 3) Akkordzeilenerkennung

`isChordLine(...)` aus `chords.js` basiert auf Regex-Bausteinen:

- Root-Noten `A-G` plus deutsches `H`
- optionale Vorzeichen `#` oder `b`
- flexible Suffixe (z. B. `m7`, `sus4`, `/F#`)
- Taktstrich `|` als eigenes Token erlaubt

Eine Zeile gilt als Akkordzeile, wenn sie nur aus diesen Token und Leerzeichen besteht.

## 4) Merging von Akkorden und Text

`mergeChordAndText(chords, text)`:

- Zerlegt Akkordzeile inkl. Leerzeichen (`splitChordLinePreserveSpaces`)
- Nicht-leere Tokens werden in `[Akkord]` umgewandelt
- Leerzeichenbereiche werden genutzt, um den Textindex fortzuschieben
- Resttext wird hinten angehaengt

So bleiben relative Positionen von Akkorden zur Textzeile moeglichst erhalten.

## 5) Abschnittslabels

`parseLabeledLine(...)` erkennt Zeilen wie:

- `[Chorus]`
- `[Verse 2]`
- `[Intro]` (oder andere Labels)

`labelToDirective(...)` mappt auf ChordPro-Direktiven:

- `chorus`/`refrain` -> `soc`
- `verse`/`strophe`/`vers` -> `sov`
- sonst -> `c` (Kommentar/Abschnittsmarker)

Die Ausgabe erfolgt als `{directive: Label}`.
Falls hinter dem Label Resttext steht, wird dieser in die naechste Zeile geschrieben.

## Beispiel

### Input

```text
[Verse 1]
G     D
Hello world

[Chorus]
Em C D
Sing with me
```

### Output (verkuerzt)

```text
{title: ...}
{artist: ...}

{sov: Verse 1}
[G]    [D]Hello world

{soc: Chorus}
[Em] [C] [D]Sing with me
```

## Bekannte Grenzen / Edge Cases

- Heuristik kann kurze reine Textzeilen, die wie Akkorde aussehen, als Akkordzeile interpretieren.
- Positionierung bei stark ungleichmaessigen Whitespaces bleibt best effort.
- `capo` ist aktuell auf `1..11` begrenzt (12 wird nicht akzeptiert).
- `key`-Validierung ist regex-basiert und bildet nicht alle Musiktheorie-Sonderfaelle ab.
- Direktiv-Mapping fuer Sections ist sprachlich begrenzt (de/en Grundfaelle).

## Fehlerverhalten

- Der Converter selbst wirft im Normalfall keine fachlichen Fehler fuer "ungewoehnlichen" Input; er transformiert best effort.
- Rendering-Fehler (ungueltiges ChordPro) werden spaeter im `ChordProViewer` abgefangen und als Fehlertext angezeigt.

## Erweiterungsmoeglichkeiten

- Konfigurierbare Section-Mappings (z. B. Bridge, Pre-Chorus, Outro)
- Strengere oder lockere Akkorderkennung per Option
- Erweiterte Metadatenuebernahme (BPM, Tonart, Capo direkt aus Input)
- Testmatrix mit realen UG-Beispielen und Snapshot-Tests fuer Converter-Ausgabe
