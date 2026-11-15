# Song importieren

In der Songs-Ansicht öffnest du **+ Song** und dann **Song importieren**.

Du kannst eine ChordPro-Datei von deinem Gerät übernehmen oder Text von Ultimate Guitar einfügen.

## ChordPro-Datei

Wähle **ChordPro-Datei** und danach die Datei.

Geeignet sind Dateien mit den Endungen `.cho`, `.chopro`, `.chordpro`, `.pro` und `.txt`. Die Datei muss UTF-8 sein, damit Umlaute richtig ankommen.

SongManager liest den Titel aus `{title: ...}` oder `{t: ...}` und den Interpreten aus `{artist: ...}`, wenn die Angabe in der Datei steht. Beides kannst du vor dem Speichern ändern. Andere Angaben in der Datei bleiben im Text stehen.

Prüfe den Text im Feld **ChordPro**. **Song anlegen** speichert den Song. Dabei übernimmt der Text den Titel und, wenn du einen Interpreten eingetragen hast, den Interpreten. Eine schon vorhandene Angabe wird ersetzt, nicht verdoppelt. `{t: ...}` gilt als Titel. Ohne Interpret bleibt keine Interpretenzeile im Text. **Abbrechen** verwirft die gelesene Datei. Vor **Song anlegen** entsteht kein Song, und der gezeigte Text ändert sich nicht allein durch das Öffnen.

Ohne Titel kannst du den Song nicht anlegen. Eine leere Datei wird nicht übernommen. Lässt sich die Datei nicht lesen, bleibt ein bereits gezeigter Text stehen.

Ein Song mit demselben Titel ersetzt keinen vorhandenen Song. Es entsteht ein weiterer Song.

Die Datei selbst wird nicht hochgeladen. Gespeichert werden Titel, Interpret und der ChordPro-Text.

Im Performance Mode und mit der Rolle Gast kannst du keinen Song anlegen.

## Ultimate Guitar

Wähle **Ultimate Guitar**. Diese Ansicht ist geöffnet, wenn du den Import aufrufst.

Trag Titel und Artist ein, füge den Text ein und klicke **Konvertieren & Speichern**. Aus dem Text wird ChordPro. Kopiere nur Inhalte, die du verwenden darfst.

Ein leeres Titelfeld wird als `Unbenannt` gespeichert. Der Text muss ausgefüllt sein.
