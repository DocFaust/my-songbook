# Domain-Modell

## Status

TARGET DOMAIN MODEL

Dieses Dokument beschreibt die **intendierten fachlichen Konzepte** von My Songbook.
Es ist bewusst technologieunabhängig.

Es beschreibt insbesondere **nicht**:

- das aktuelle IndexedDB-Schema
- Persistenzmodelle, Tabellen oder Entities einer konkreten Plattform
- APIs, Endpunkte oder Synchronisationsprotokolle
- UI-Komponenten oder Navigationsstrukturen

Der aktuelle Ist-Zustand der Anwendung ist in `docs/current-architecture.md`
und `docs/current-data-model.md` dokumentiert. Dort existieren noch keine Bands,
User, Memberships oder persönlichen Notizen.

Abweichungen zwischen diesem Dokument und der laufenden Implementierung
sind erwartet, solange die hier beschriebenen Konzepte noch nicht
umgesetzt sind.

---

## 1. Zweck und Scope

My Songbook ist ein Werkzeug für Musiker und Bands. Fachlich geht es um
Songs im ChordPro-Format, deren Organisation in Setlists und die
Zusammenarbeit innerhalb einer Band — auch offline, etwa in Probe und
Auftritt.

Dieses Domain-Modell legt fest:

- welche fachlichen Dinge es gibt
- wie sie zusammenhängen
- wem sie gehören
- welche Rollen und Rechte an einer Membership hängen
- wie Band, Membership, Einladung und Ownership entstehen und enden
- welche Grenzen zwischen Bands gelten
- dass My Songbook Zusammenarbeit innerhalb einer Band erleichtert,
  nicht die Verteilung von Songinhalt zwischen Bands
- welche Regeln bei Sichtbarkeit und Offline-Nutzung fachlich gelten

Es legt **nicht** fest, wie diese Dinge gespeichert, übertragen oder in
einer Oberfläche dargestellt werden.

Produktziele, die das Modell tragen muss:

- Offline-first Nutzung
- Multi-Tenancy mit der Band als Mandant
- robuste Synchronisation gemeinsam genutzter Banddaten
- einfache und sichere Anmeldung
- Nutzung auf der Bühne
- eine UI in der Sprache von Musikern

---

## 2. Zentrale Domain Entities

### 2.1 User

Ein **User** ist die globale Identität einer Person in My Songbook.

Die Identität gilt anwendungsweit. Sie ist unabhängig von einzelnen Bands.
Ein User kann Mitglied in keiner, einer oder mehreren Bands sein.
Ein globaler User darf ohne aktive Band-Membership existieren.

Der User ist Träger von:

- der eigenen Identität
- den Memberships zu Bands, sofern vorhanden
- den persönlichen Song-Notizen, sofern eine aktive Membership besteht

Ein User hat keine anwendungsweite Rolle OWNER, ADMIN, MEMBER oder GUEST.
Rollen hängen ausschließlich an den Memberships zu einzelnen Bands.

Account-Lebenszyklus und Membership-Lebenszyklus sind getrennte fachliche
Konzepte. Das Beenden oder Entfernen einer Membership löscht oder
deaktiviert den globalen User nicht.

Ohne aktive Membership darf der User:

- sein Konto verwalten
- Band-Einladungen empfangen und annehmen
- eine neue Band anlegen

Ohne aktive Membership hat der User keine Band-Songs, keine
Band-Setlists und keine persönlichen Song-Notizen. Es gibt keine
persönliche Song-Bibliothek und kein persönliches bandübergreifendes
Song-Repository.

Zusätzliche User-Profilangaben sind derzeit keine Produktanforderung
und werden erst modelliert, wenn ein konkreter Bedarf besteht. Sie sind
nicht ausgeschlossen und dürfen später hinzukommen. Ein spekulatives
Profilmodell wird heute nicht eingeführt.

Wie Anmeldung konkret erfolgt, ist nicht Teil dieses Modells.
Fachlich muss die Identität jedoch so einfach und verlässlich sein, dass
Zusammenarbeit in der Band möglich ist, ohne dass die Anwendung wie ein
Verwaltungssystem wirkt.

### 2.2 Band

Eine **Band** ist ein eigenständiger Mandant.

Zu einer Band gehören ausschließlich ihre eigenen:

- Mitglieder (über Memberships)
- Songs
- Setlists
- sonstige geteilte Banddaten

Es gibt derzeit keine akzeptierte Produktanforderung für generische
Band-Einstellungen. Ein solches Konzept ist nicht Teil dieses Modells.
Eine konkrete bandbezogene Einstellung wird erst modelliert, wenn sie
als Anforderung existiert.

Zwei Bands sind vollständig voneinander getrennt. Sie können vollständig
unterschiedliche Mitglieder haben. Es gibt keinen gemeinsamen Datenraum
zwischen Bands.

Jeder authentifizierte User darf eine Band anlegen. Es gibt keine
fachliche Obergrenze für die Zahl der Bands, die ein User anlegen darf.
Eine neu angelegte Band hat vom ersten Moment an genau einen OWNER.

### 2.3 Membership

Eine **Membership** ist die fachliche Beziehung zwischen genau einem User
und genau einer Band.

Sie drückt aus: dieser User gehört zu dieser Band.

Rollen und Berechtigungen hängen an der Membership, nicht an der globalen
User-Identität. Ein User hat deshalb keine anwendungsweite Rolle OWNER,
ADMIN, MEMBER oder GUEST. Dieselbe Person kann in verschiedenen Bands
verschiedene Rollen haben. Rechte gelten immer nur im Kontext der
konkreten Band.

Eine Membership hat genau eine der folgenden Rollen:

- OWNER
- ADMIN
- MEMBER
- GUEST

OWNER ist eine besondere Verantwortlichkeit innerhalb einer Band, kein
globaler Benutzertyp.

#### User und Membership als getrennte Lebenszyklen

Eine Membership repräsentiert die Beziehung eines Users zu genau einer
Band. Ein User kann gleichzeitig Memberships in mehreren Bands haben und
in jeder Band eine andere Rolle haben.

Das Beenden oder Entfernen einer Membership:

- löscht oder deaktiviert den globalen User nicht
- berührt Memberships in anderen Bands nicht
- berührt den Zugang des Users zu anderen Bands nicht

Account-Lebenszyklus und Membership-Lebenszyklus bleiben getrennt.

#### Band anlegen

Jeder authentifizierte User darf eine Band anlegen. Es gibt keine
fachliche Obergrenze, wie viele Bands ein User anlegen darf.

Beim Anlegen einer Band gilt:

- der anlegende User erhält automatisch eine Membership in dieser Band
- diese Membership hat die Rolle OWNER
- die Band hat daher vom ersten Moment an genau einen OWNER

#### Einladungen

Eine Einladung gehört zu genau einer Band.

OWNER und ADMIN dürfen User in eine Band einladen. Bei der Einladung
gibt es keine Rollenauswahl.

Eine ausstehende Einladung erzeugt keine aktive Membership. Die
Membership wird erst aktiv, wenn der eingeladene User die Einladung
annimmt. Jede angenommene Einladung erzeugt eine neue Membership mit
der Rolle GUEST.

ADMIN entsteht nicht durch eine Einladung. OWNER entsteht nicht durch
eine Einladung. OWNER entsteht nur durch Anlegen der Band oder durch
Ownership-Übertragung.

Nachdem die Membership existiert, dürfen OWNER oder ADMIN die Rolle
nach den bestehenden Regeln zur Rollenverwaltung ändern. Ein neu
eingeladener User beginnt deshalb als GUEST und kann später zum MEMBER
und anschließend zum ADMIN befördert werden.

Für einen gegebenen User und eine gegebene Band darf gleichzeitig
höchstens eine ausstehende Einladung existieren.

Ein User, der in einer Band bereits eine aktive Membership hat, darf
in diese Band nicht erneut eingeladen werden. Rollenänderungen
bestehender Mitglieder erfolgen an der bestehenden Membership, nicht
über Einladungen.

##### Ausgänge einer Einladung

Eine ausstehende Einladung endet auf einem der folgenden Wege.

**Angenommen.** Der eingeladene User nimmt die Einladung an.

Dann gilt:

- es entsteht eine aktive Membership mit der Rolle GUEST
- die Einladung ist nicht mehr ausstehend

**Abgelehnt.** Der eingeladene User darf die Einladung ablehnen.

Dann gilt:

- es entsteht keine Membership
- die Einladung gilt als abgeschlossen
- der User darf später erneut eingeladen werden

**Zurückgezogen.** OWNER oder ADMIN dürfen eine noch ausstehende
Einladung zurückziehen.

Dann gilt:

- es entsteht keine Membership
- die Einladung gilt als abgeschlossen
- der User darf später erneut eingeladen werden

**Abgelaufen.** Eine ausstehende Einladung läuft automatisch nach
14 Tagen ab, wenn sie nicht angenommen wurde.

Dann gilt:

- es entsteht keine Membership
- die Einladung ist nicht mehr gültig
- der User darf später erneut eingeladen werden

##### Erneute Einladung

Nachdem eine Einladung abgelehnt, zurückgezogen oder abgelaufen ist,
darf später eine neue Einladung erzeugt werden.

Frühere abgelehnte, zurückgezogene oder abgelaufene Einladungen sind
kein dauerhaftes Hindernis. Eine neue Einladung ist nur zulässig, wenn
für diesen User in dieser Band weder eine aktive Membership noch eine
ausstehende Einladung existiert.

Der technische Einladungsweg bleibt unentschieden und ist nicht Teil
dieses Modells. Insbesondere sind nicht festgelegt:

- E-Mail-Einladungen
- Links
- QR-Codes
- Einladungscodes
- Benachrichtigungswege

#### OWNER

Jede Band hat genau einen OWNER.

Der OWNER:

- hat alle Rechte eines ADMIN
- ist die einzige Rolle, die die Band löschen darf
- ist die einzige Rolle, die das Ownership auf ein anderes Mitglied
  übertragen darf
- darf ADMIN, MEMBER und GUEST entfernen

Der OWNER darf die Band nicht verlassen, solange er OWNER ist.
Ownership muss zuerst übertragen werden. Die Membership des OWNER darf
nicht entfernt werden, solange das Ownership nicht übertragen wurde.

#### Ownership-Übertragung

Nur der aktuelle OWNER darf Ownership übertragen.

Ownership darf auf ein bestehendes Mitglied mit der Rolle ADMIN oder
MEMBER übertragen werden. Eine direkte Übertragung auf einen GUEST ist
nicht zulässig. Soll ein GUEST OWNER werden, muss dessen Rolle zuvor
auf MEMBER oder ADMIN geändert werden.

Die Ownership-Übertragung ist fachlich atomar:

- der neue User wird OWNER
- der bisherige OWNER wird ADMIN
- die Band darf dabei niemals vorübergehend keinen oder mehrere OWNER
  haben

#### ADMIN

Ein ADMIN darf:

- User einladen
- ausstehende Einladungen zurückziehen
- andere ADMINs, MEMBERs und GUESTs entfernen
- Membership-Rollen verwalten, ausgenommen das Zuweisen oder Übertragen
  von OWNER
- Songs anlegen, bearbeiten und löschen
- Setlists anlegen, bearbeiten und löschen
- alle Band-Songs und Setlists lesen und nutzen
- die Mitgliederliste der Band sehen
- die Band freiwillig verlassen

Ein ADMIN darf die Band nicht löschen, Ownership nicht übertragen und
den OWNER nicht entfernen.

#### MEMBER

Ein MEMBER darf:

- Band-Songs lesen
- Songs anlegen
- Band-Songs bearbeiten
- Setlists lesen und nutzen
- Setlists anlegen
- Setlists bearbeiten
- persönliche Song-Notizen pflegen
- die Mitgliederliste der Band sehen
- die Band freiwillig verlassen

Ein MEMBER darf nicht:

- Songs löschen
- Setlists löschen
- Memberships verwalten
- Membership-Rollen ändern
- die Band löschen

#### GUEST

Ein GUEST ist die Einstiegsrolle jeder angenommenen Einladung. Die Rolle
steht auch für Fälle wie Aushilfe oder Gastmusiker, die vorübergehend
mit der Band spielen.

Ein GUEST darf:

- Band-Songs lesen
- Setlists lesen und nutzen
- die eigenen persönlichen Song-Notizen pflegen
- die Mitgliederliste der Band sehen
- die Band freiwillig verlassen

Ein GUEST darf geteilte Banddaten nicht verändern.

Insbesondere darf ein GUEST nicht:

- Songs anlegen, bearbeiten oder löschen
- Setlists anlegen, bearbeiten oder löschen
- Memberships verwalten
- Rollen ändern
- die Band löschen

Persönliche Song-Notizen bleiben privates Eigentum des Users. Deshalb
dürfen auch GUEST-Nutzer sie anlegen und bearbeiten.

#### Membership verlassen und entfernen

ADMIN, MEMBER und GUEST dürfen eine Band freiwillig verlassen.
OWNER darf die Band nicht verlassen, solange er OWNER ist.

Vor dem freiwilligen Verlassen muss die Konsequenz fachlich sichtbar
sein: die persönlichen Song-Notizen des Users zu Songs dieser Band
werden gelöscht. Die konkrete Darstellung in der Oberfläche ist nicht
Teil dieses Modells.

OWNER darf entfernen:

- ADMIN
- MEMBER
- GUEST

ADMIN darf entfernen:

- andere ADMINs
- MEMBERs
- GUESTs

ADMIN darf den OWNER nicht entfernen.

Endet eine Membership — freiwillig oder durch Entfernen durch OWNER
oder ADMIN — gilt:

- der User verliert sofort den Zugang zu den Songs der Band
- alle persönlichen Song-Notizen dieses Users, die sich auf Songs
  dieser Band beziehen, werden gelöscht
- Memberships und persönliche Song-Notizen zu anderen Bands bleiben
  unberührt

Es gibt keine Aufbewahrungsfrist, kein Archiv, keine Wiederherstellung
und keine versteckte Speicherung dieser Notizen. Ein späterer erneuter
Beitritt stellt gelöschte Notizen nicht wieder her.

Verlassen oder Entfernen einer Membership betrifft nur die Beziehung zu
dieser Band. Der globale User, Memberships in anderen Bands und der
Zugang zu anderen Bands bleiben unberührt.

#### Gemeinsames Bearbeiten

Mehrere MEMBER und ADMIN dürfen denselben Song bearbeiten. Der OWNER hat
alle ADMIN-Rechte und darf denselben Song ebenfalls bearbeiten.
Gleichzeitiges Bearbeiten ist deshalb ein erwartetes fachliches Szenario
und muss später beim Entwurf des Synchronisationsverhaltens betrachtet
werden.

#### Übersicht der Band-Rollen

| Aktion | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|
| Band löschen | ja | nein | nein | nein |
| Ownership übertragen | ja | nein | nein | nein |
| Mitglieder einladen | ja | ja | nein | nein |
| Ausstehende Einladung zurückziehen | ja | ja | nein | nein |
| Mitgliederliste sehen | ja | ja | ja | ja |
| Mitglieder entfernen (ohne OWNER) | ja | ja | nein | nein |
| Band freiwillig verlassen | nein | ja | ja | ja |
| Rollen verwalten (ohne OWNER) | ja | ja | nein | nein |
| Songs anlegen und bearbeiten | ja | ja | ja | nein |
| Songs löschen | ja | ja | nein | nein |
| Setlists anlegen und bearbeiten | ja | ja | ja | nein |
| Setlists löschen | ja | ja | nein | nein |
| Songs und Setlists lesen und nutzen | ja | ja | ja | ja |
| Persönliche Song-Notizen pflegen | ja | ja | ja | ja |

### 2.4 Song

Ein **Song** ist das zentrale musikalische Arbeitsobjekt einer Band.

Ein Song gehört immer **genau zu einer Band**. Es gibt keinen globalen
Song-Pool und kein persönliches bandübergreifendes Song-Repository.
Songs werden nicht zwischen Bands geteilt, direkt kopiert oder
automatisch synchronisiert.

My Songbook erleichtert die Zusammenarbeit innerhalb einer Band, nicht
die Verteilung von Songinhalt zwischen Bands. Ein User, der Mitglied in
mehreren Bands ist, sieht die Songsammlung jeder Band als unabhängig.

Fachlich umfasst ein Song mindestens:

- eine eigene Identität
- die Zugehörigkeit zu genau einer Band
- einen Titel
- einen Interpreten bzw. Artist
- den Songinhalt im ChordPro-Format

ChordPro ist die kanonische inhaltliche Darstellung eines Songs. Andere
Eingabeformen (zum Beispiel importierter Rohtext) werden fachlich in
ChordPro überführt, bevor ein Song als Band-Song existiert.

Strukturierte Zusatzangaben wie Tonart, Capo, BPM oder Tags sind nicht
festgelegt. Soweit solche Informationen im ChordPro-Inhalt stehen, sind
sie Teil des Band-Songs. Ob dieselben Angaben zusätzlich als eigene
Metadaten geführt werden, ist offen.

`OPEN QUESTION`: Welche Song-Metadaten bandgeteilt und strukturiert
geführt werden und welche nur im ChordPro-Inhalt oder in persönlichen
Notizen liegen.

### 2.5 Setlist

Eine **Setlist** ist eine benannte, geordnete Zusammenstellung von Songs
für Probe oder Auftritt.

Eine Setlist gehört immer **genau zu einer Band**. Sie darf nur Songs
**derselben** Band referenzieren. Das Kopieren einer Setlist in eine
andere Band ist keine unterstützte Komfortfunktion, weil es eine
Verteilung von Songinhalt zwischen Bands erfordern würde.

Fachlich umfasst eine Setlist mindestens:

- eine eigene Identität
- die Zugehörigkeit zu genau einer Band
- einen Namen
- eine geordnete Folge von Verweisen auf Songs dieser Band

Die Reihenfolge ist fachlich bedeutsam: auf der Bühne muss der Wechsel
zwischen Songs vorhersagbar und schnell sein.

`OPEN QUESTION`: Ob derselbe Song in einer Setlist mehrfach vorkommen
darf.

`OPEN QUESTION`: Was mit einer Setlist geschieht, wenn ein referenzierter
Song gelöscht wird.

### 2.6 Persönliche Song-Notiz

Eine **persönliche Song-Notiz** gehört einem User und bezieht sich auf
genau einen konkreten Song.

Sie ist privates Eigentum des Users und nicht Bestandteil des geteilten
Band-Songs. Andere Bandmitglieder sehen sie nicht automatisch.

Eine persönliche Song-Notiz darf nur existieren, solange der User eine
aktive Membership zu der Band hat, der der referenzierte Song gehört.

Typische Inhalte können sein:

- Spielhinweise
- Akkord-Erinnerungen
- Capo-Position
- Arrangement-Notizen
- Auftritts-Cues

Diese Beispiele beschreiben den fachlichen Zweck. Sie legen nicht fest,
welche Angaben zwingend persönlich und welche bandgeteilt sind.

`OPEN QUESTION`: Ob es je User und Song genau eine Notiz gibt oder
mehrere.

`OPEN QUESTION`: Ob es zusätzlich zu persönlichen Notizen bandgeteilte
Song-Anmerkungen gibt.

### 2.7 Arbeitskontext „aktive Band“

Ein User, der einer oder mehreren Bands angehört, arbeitet fachlich
jeweils im Kontext **einer** Band. Songs, Setlists und geteilte
Banddaten gehören immer zu diesem Mandanten.

Ein User ohne aktive Membership hat keinen Band-Arbeitskontext.

Die jeweils aktive Band ist ein Nutzungs- bzw. Arbeitskontext. Sie ist
keine eigene Domain-Entity und keine persistierte fachliche
Voreinstellung.

Es gibt insbesondere keine fachlichen Konzepte wie:

- PreferredBand
- DefaultBand
- ActiveBand als Entity
- eine persistierte fachliche Band-Priorität

Die jeweils aktive Band muss für den User klar erkennbar sein.

Ob die Oberfläche Bands später aus Bequemlichkeit merkt oder sortiert,
ist eine Frage der Nutzung und Umsetzung, keine Domain-Anforderung
dieses Modells.

---

## 3. Beziehungen zwischen Entities

```text
User 1 ──────── * Membership * ──────── 1 Band
                                          │
                                          │ 1
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    *                                           *
                  Song                                       Setlist
                    │                                           │
                    │                                           │ nur Songs
                    │                                           │ derselben Band
                    │                                           *
                    │                                    Setlist-Eintrag
                    │                                    (Position + Song)
                    │
User 1 ── * Persönliche Song-Notiz * ── 1 Song
```

### 3.1 User und Band

- Ein User hat null, eine oder viele Memberships.
- Ein User ohne aktive Membership darf sein Konto verwalten,
  Band-Einladungen empfangen und annehmen und eine Band anlegen.
  Ohne Membership hat er keine Band-Songs, keine Band-Setlists und
  keine persönlichen Song-Notizen.
- Eine Band hat die Memberships ihrer Mitglieder.
- Es gibt keine direkte User–Band-Beziehung ohne Membership.
- Dieselbe Person kann in Band A eine andere Rolle und andere Rechte
  haben als in Band B, weil Rolle und Rechte an der jeweiligen
  Membership hängen.
- Eine Band hat genau einen OWNER. Eine Band ohne Mitglieder kann
  deshalb nicht existieren.
- Jeder authentifizierte User darf eine Band anlegen und erhält dabei
  automatisch die OWNER-Membership.
- Eine Einladung gehört zu genau einer Band. Sie legt keine
  Membership-Rolle fest. Bei Annahme entsteht stets eine Membership
  mit der Rolle GUEST.
- Für denselben User in derselben Band darf gleichzeitig höchstens
  eine ausstehende Einladung existieren. Ein User mit aktiver
  Membership in einer Band darf in diese Band nicht erneut eingeladen
  werden.
- Das Ende einer Membership betrifft nur diese Bandbeziehung. Der globale
  User und Memberships in anderen Bands bleiben unberührt. Persönliche
  Song-Notizen zu Songs dieser Band werden gelöscht; Notizen zu anderen
  Bands bleiben unberührt.

### 3.2 Band, Song und Setlist

- Eine Band besitzt viele Songs.
- Eine Band besitzt viele Setlists.
- Ein Song gehört zu genau einer Band.
- Eine Setlist gehört zu genau einer Band.
- Eine Setlist verweist auf null oder viele Songs.
- Jeder Verweis in einer Setlist muss auf einen Song derselben Band
  zeigen.

### 3.3 User, Song und persönliche Notiz

- Eine persönliche Notiz gehört zu genau einem User.
- Eine persönliche Notiz bezieht sich auf genau einen Song.
- Der Song bleibt Eigentum der Band; die Notiz bleibt Eigentum des Users.
- Die Notiz ist nicht Bestandteil der geteilten Banddaten.
- Die Notiz erzeugt keine Teilhabe anderer Mitglieder am Inhalt der Notiz.
- Eine persönliche Notiz darf nur existieren, solange der User eine
  aktive Membership zu der Band hat, der der referenzierte Song gehört.
- Endet die Membership, werden alle persönlichen Notizen dieses Users
  zu Songs dieser Band gelöscht. Notizen zu anderen Bands bleiben
  unberührt.

### 3.4 Keine Song-Verteilung zwischen Bands

My Songbook erleichtert die Zusammenarbeit innerhalb einer Band, nicht
die Verteilung von Songinhalt zwischen Bands.

Deshalb gibt es keine normale Produktfunktion für:

- das direkte Kopieren eines Songs von einer Band in eine andere
- das Teilen eines Songs mit einer anderen Band
- das Suchen oder Durchsuchen von Songs fremder Bands
- ein globales Song-Repository
- ein persönliches bandübergreifendes Song-Repository
- das automatische Synchronisieren von Songs zwischen Bands
- das Übertragen von Songs zwischen Bands in einem Stapel

Ein User, der Mitglied in mehreren Bands ist, sieht die Songsammlung
jeder Band als unabhängig.

Diese Produktgrenze ist kein DRM und keine technische Kopiersperre.
Nutzer können weiterhin technisch in der Lage sein:

- ChordPro-Text manuell zu kopieren
- Inhalt zu exportieren, auf den sie Zugriff haben
- Inhalt in einer anderen Band zu importieren oder neu anzulegen

My Songbook muss solche manuellen Handlungen nicht verhindern.
Normale Bearbeitung, Export und Import dürfen nicht absichtlich
erschwert werden, nur um manuelles Kopieren schwieriger zu machen.

Die Anwendung darf lediglich keinen eigenen, bequemen Workflow zur
Verteilung von Songs zwischen Bands anbieten.

Dasselbe gilt für Setlists: Das Kopieren einer Setlist zwischen Bands
würde eine bandübergreifende Verteilung von Songinhalt erfordern und
ist daher keine unterstützte Komfortfunktion.

Wenn ein User Inhalt manuell in einer anderen Band neu anlegt oder
importiert, entsteht dort — falls der Inhalt als Song existiert — stets
ein **neuer, unabhängiger Song** in diesem Mandanten. Es gibt keine
automatische Herkunfts- oder Synchronisationsbeziehung zu Songs
anderer Bands.

---

## 4. Fachliche Regeln / Invarianten

Die folgenden Regeln gelten unabhängig von einer technischen Umsetzung.

1. **Mandantengrenze.** Eine Band ist ein eigenständiger Mandant.
   Banddaten einer Band sind für eine andere Band nicht sichtbar und
   nicht implizit gemeinsam.

2. **Keine Bandüberschreitung der Arbeitsdaten.** Songs, Setlists und
   geteilte Banddaten werden nicht zwischen Bands geteilt, direkt
   kopiert oder automatisch synchronisiert. Es gibt keinen globalen
   Song-Pool und kein persönliches bandübergreifendes Song-Repository.
   My Songbook erleichtert die Zusammenarbeit innerhalb einer Band,
   nicht die Verteilung von Songinhalt zwischen Bands.

3. **User ist global, Rechte sind lokal.** Die Identität des Users gilt
   anwendungsweit. Mitgliedschaft, Rollen und Berechtigungen gelten nur
   innerhalb der jeweiligen Band über die Membership. Ein User hat keine
   anwendungsweite Rolle OWNER, ADMIN, MEMBER oder GUEST. Account-
   Lebenszyklus und Membership-Lebenszyklus sind getrennte Konzepte.

4. **Song-Zugehörigkeit.** Jeder Song gehört zu genau einer Band.
   Ein Song ohne Band existiert in diesem Modell nicht.

5. **Setlist-Zugehörigkeit.** Jede Setlist gehört zu genau einer Band.

6. **Setlist-Integrität.** Eine Setlist darf nur Songs ihrer eigenen
   Band referenzieren.

7. **Keine bandübergreifende Verteilungsfunktion.** My Songbook bietet
   keine normale Produktfunktion, um Songs oder Setlists von einer Band
   in eine andere zu kopieren, zu teilen oder zu übertragen. Manuelles
   Kopieren von ChordPro-Text sowie Export und Import bleiben möglich
   und dürfen nicht absichtlich erschwert werden. Sie begründen keine
   Herkunfts- oder Synchronisationsbeziehung zwischen Bands.

8. **Persönliche Notiz ist nicht der Song.** Persönliche Notizen sind
   kein Bestandteil des geteilten Band-Songs. Änderungen am Band-Song
   überschreiben sie nicht fachlich; die Notiz ist ein eigenes Objekt.

9. **Keine automatische Notiz-Sichtbarkeit.** Andere Mitglieder derselben
   Band sehen eine persönliche Notiz nicht automatisch.

10. **Offline-Nutzung bleibt gültig.** Songs, Setlists und persönliche
    Notizen müssen ohne Netzverbindung fachlich nutzbar bleiben. Fehlende
    Synchronisation darf die lokale Nutzung nicht verhindern.

11. **Keine stille Vernichtung gemeinsamer Arbeit.** Bei späteren
    Abgleichen gemeinsam bearbeiteter Banddaten dürfen Änderungen nicht
    still verloren gehen.

12. **Genau ein OWNER.** Jede Band hat vom ersten Moment an genau einen
    OWNER. Eine Ownership-Übertragung darf nicht dazu führen, dass eine
    Band keinen oder mehrere OWNER hat, auch nicht vorübergehend.

13. **Eine Rolle je Membership.** Eine Membership hat genau eine Rolle:
    OWNER, ADMIN, MEMBER oder GUEST.

14. **Song- und Setlist-Rechte.** OWNER, ADMIN und MEMBER dürfen Songs
    und Setlists anlegen und bearbeiten. Löschen dürfen nur OWNER und
    ADMIN. GUEST darf geteilte Banddaten nicht verändern.

15. **Persönliche Notizen unabhängig von der Bandrolle.** Persönliche
    Song-Notizen darf jede Membership-Rolle pflegen, einschließlich GUEST.

16. **Gemeinsames Bearbeiten ist erwartet.** Mehrere MEMBER und ADMIN
    dürfen denselben Song bearbeiten. Gleichzeitige Änderungen sind ein
    erwartetes fachliches Szenario.

17. **Band anlegen.** Jeder authentifizierte User darf eine Band anlegen.
    Dabei entsteht automatisch eine OWNER-Membership für den anlegenden
    User. Es gibt keine fachliche Obergrenze für die Zahl der Bands, die
    ein User anlegen darf.

18. **Aktive Membership durch Annahme.** Eine Einladung erzeugt keine
    aktive Membership. Die Membership wird erst aktiv, wenn der
    eingeladene User die Einladung annimmt. Die neue Membership hat
    stets die Rolle GUEST. Es gibt keine Rollenauswahl bei der
    Einladung. ADMIN entsteht nicht durch Einladung. OWNER entsteht
    nicht durch Einladung, sondern durch Anlegen der Band oder durch
    Ownership-Übertragung.

19. **Ausgänge einer Einladung.** Eine ausstehende Einladung endet durch
    Annahme, Ablehnung, Zurückziehen durch OWNER oder ADMIN oder durch
    Ablauf nach 14 Tagen. Nur die Annahme erzeugt eine Membership.
    Nach Ablehnung, Zurückziehen oder Ablauf darf später erneut
    eingeladen werden, sofern für diesen User in dieser Band keine
    aktive Membership und keine ausstehende Einladung existiert;
    frühere solche Einladungen sind kein dauerhaftes Hindernis.

20. **Höchstens eine ausstehende Einladung.** Für denselben User in
    derselben Band darf gleichzeitig höchstens eine ausstehende
    Einladung existieren. Ein User mit aktiver Membership in einer Band
    darf in diese Band nicht erneut eingeladen werden. Rollenänderungen
    bestehender Mitglieder erfolgen an der bestehenden Membership,
    nicht über Einladungen.

21. **OWNER bleibt, bis Ownership übertragen ist.** OWNER darf die Band
    nicht verlassen und die OWNER-Membership darf nicht entfernt werden,
    solange das Ownership nicht übertragen wurde.

22. **Entfernen ohne OWNER.** OWNER darf ADMIN, MEMBER und GUEST
    entfernen. ADMIN darf andere ADMINs, MEMBERs und GUESTs entfernen.
    ADMIN darf den OWNER nicht entfernen. ADMIN, MEMBER und GUEST dürfen
    die Band freiwillig verlassen.

23. **Ownership-Übertragung.** Nur der aktuelle OWNER darf Ownership
    übertragen, und nur auf ein bestehendes Mitglied mit der Rolle ADMIN
    oder MEMBER. Der neue User wird OWNER, der bisherige OWNER wird
    ADMIN.

24. **Persönliche Notiz nur bei aktiver Membership.** Eine persönliche
    Song-Notiz darf nur existieren, solange der User eine aktive
    Membership zu der Band hat, der der referenzierte Song gehört.
    Endet die Membership — freiwillig oder durch Entfernen — verliert
    der User sofort den Zugang zu den Songs der Band, und alle seine
    persönlichen Notizen zu Songs dieser Band werden gelöscht.
    Memberships und Notizen zu anderen Bands bleiben unberührt. Es gibt
    keine Aufbewahrung, kein Archiv und keine Wiederherstellung dieser
    Notizen.

25. **User ohne Membership.** Ein User darf ohne aktive Membership
    existieren. Ohne Membership darf er sein Konto verwalten,
    Einladungen empfangen und annehmen und eine Band anlegen. Ohne
    Membership hat er keine Band-Songs, keine Band-Setlists und keine
    persönlichen Song-Notizen. Es gibt keine persönliche
    Song-Bibliothek und kein persönliches bandübergreifendes
    Song-Repository.

26. **Aktive Band ist Nutzungskontext.** Die jeweils aktive Band ist ein
    Arbeitskontext der Nutzung. Sie ist keine eigene Domain-Entity und
    keine persistierte fachliche Voreinstellung.

27. **Sichtbarkeit anderer Mitglieder.** Alle aktiven Mitglieder einer
    Band dürfen den Anzeigenamen eines anderen Mitglieds und dessen
    Rolle in dieser Band sehen. Weitere User-, Konto- oder Profildaten
    sind derzeit nicht für andere Mitglieder sichtbar.

---

## 5. Ownership und Sichtbarkeit

Ownership beschreibt, wem ein Objekt fachlich gehört.
Sichtbarkeit beschreibt, wer es sehen oder nutzen darf.

Diese beiden Fragen sind nicht dasselbe.

| Objekt | Gehört fachlich | Sichtbar / nutzbar |
|---|---|---|
| User-Identität | dem User | anwendungsweit als Identität, nicht als Banddaten |
| Band | der Band als Mandant | den Mitgliedern dieser Band |
| Membership | der Beziehung User–Band | sichtbar allen aktiven Mitgliedern dieser Band; ändern dürfen OWNER und ADMIN |
| Song | der Band | den Mitgliedern dieser Band |
| Setlist | der Band | den Mitgliedern dieser Band |
| Persönliche Song-Notiz | dem User | nur diesem User, bezogen auf den konkreten Song |

Alle aktiven Mitglieder einer Band dürfen die Mitgliederliste sehen:
OWNER, ADMIN, MEMBER und GUEST.

Für andere Bandmitglieder sind derzeit sichtbar:

- der Anzeigename des Mitglieds
- die Rolle dieses Mitglieds in der aktuellen Band

Keine weiteren User-, Konto- oder Profildaten sind derzeit für andere
Bandmitglieder sichtbar. Insbesondere nicht:

- E-Mail-Adresse
- Angaben zur Anmeldeidentität
- Profilfoto
- Instrumente
- Biografie
- sonstige Kontometadaten

Zusätzliche Angaben wie Profilfoto, Instrumente, Biografie oder andere
Profilinformationen dürfen später eingeführt werden, wenn es eine
konkrete Produktanforderung gibt. Das Sehen der Mitgliederliste gewährt
nicht automatisch Zugang zu privaten Kontoinformationen.

### 5.1 Geteilte Banddaten

Songs und Setlists sind **geteilte Banddaten**. OWNER, ADMIN und MEMBER
arbeiten daran gemeinsam. GUEST darf geteilte Banddaten nur lesen und
nutzen, nicht verändern.

Persönliche Song-Notizen gehören **nicht** zu den geteilten Banddaten.
Bandweite Metadaten und persönliche Metadaten bleiben begrifflich getrennt.

`OPEN QUESTION`: Welche Angaben konkret bandweite Metadaten sind
(zum Beispiel ein für die Band geltendes Capo oder Arrangement) und
welche nur in der persönlichen Notiz liegen.

### 5.2 Persönliche Notizen und Band-Songs

Die persönliche Notiz verweist auf einen Band-Song, ohne den Song zu
erweitern. Der Song bleibt vollständig der Band zugeordnet.

Daraus folgt:

- Ein Mitglied kann denselben Band-Song sehen und zusätzlich die eigene
  Notiz.
- Ein anderes Mitglied sieht denselben Band-Song, nicht aber die fremde
  Notiz.
- Persönliche Notizen bleiben an den konkreten Song ihrer Band gebunden.
  Ein manuell in einer anderen Band neu angelegter oder importierter
  Song erhält sie nicht.

Persönliche Song-Notizen sind privates Eigentum des Users. Sie gehören
nicht zu den geteilten Banddaten.

Eine persönliche Song-Notiz darf nur existieren, solange der User eine
aktive Membership zu der Band hat, der der referenzierte Song gehört.

Endet die Membership — freiwillig oder weil OWNER oder ADMIN den User
entfernt — gilt:

- der User verliert sofort den Zugang zu den Songs der Band
- alle persönlichen Song-Notizen dieses Users, die sich auf Songs
  dieser Band beziehen, werden gelöscht
- Memberships und persönliche Song-Notizen zu anderen Bands bleiben
  unberührt

Vor dem freiwilligen Verlassen muss diese Folge fachlich sichtbar sein.
Die konkrete Oberfläche ist nicht Teil dieses Modells.

Es gibt keine Aufbewahrungsfrist, kein Archiv, keine Wiederherstellung
und keine versteckte Speicherung. Ein späterer erneuter Beitritt stellt
gelöschte Notizen nicht wieder her.

`OPEN QUESTION`: Was mit persönlichen Notizen geschieht, wenn der Song
gelöscht wird.

### 5.3 User ohne Band

Ein User kann ohne Membership existieren. Ohne Membership besitzt er
keine Band-Songs, keine Band-Setlists und keine persönlichen
Song-Notizen.

Ohne Membership darf der User:

- sein Konto verwalten
- Band-Einladungen empfangen und annehmen
- eine neue Band anlegen und wird dadurch OWNER dieser Band

Es gibt keine persönliche Song-Bibliothek und kein persönliches
bandübergreifendes Song-Repository. Zusätzliche User-Profilangaben sind
derzeit keine Produktanforderung und werden erst modelliert, wenn ein
konkreter Bedarf besteht.

---

## 6. Tenant-Grenzen

Die **Band ist der Mandant**. Alle geteilten Arbeitsdaten liegen innerhalb
genau einer Band.

### 6.1 Was innerhalb einer Band liegt

- Mitglieder über Memberships
- Songs
- Setlists
- sonstige geteilte Banddaten

Ein User sieht in einer Band nur die geteilten Daten dieser Band. Die
aktive Band bestimmt als Nutzungskontext, in welchem Mandanten gerade
gearbeitet wird.

### 6.2 Was die Band-Grenze überschreitet

Nur wenige Konzepte sind bewusst bandübergreifend:

- **User-Identität** — global, nicht Eigentum einer Band
- **Memberships** — verbinden einen User mit einzelnen Bands, ohne
  Banddaten zu vermischen
- **Persönliche Song-Notizen** — gehören dem User und sind keine
  geteilten Banddaten; sie dürfen nur existieren, solange der User eine
  aktive Membership zu der Band des referenzierten Songs hat

Alles andere bleibt innerhalb des Mandanten.

Es gibt keine Produktfunktion zur Verteilung von Songinhalt zwischen
Bands. Isolation der Mandanten ist die geltende Produktgrenze, nicht
eine vorläufige Annahme.

### 6.3 Was Isolation konkret bedeutet

- Band A kann die Songs von Band B nicht sehen.
- Eine Setlist von Band A kann keinen Song von Band B enthalten.
- Rechte aus der Membership zu Band A gelten nicht in Band B.
- Das Ende einer Membership in Band A berührt Band B nicht.
- Eine Änderung an einem Song von Band A ändert keinen Song von Band B.
  Auch wenn ein User Inhalt manuell in einer anderen Band neu anlegt
  oder importiert, entstehen keine automatischen Beziehungen zwischen
  Songs verschiedener Bands.
- Persönliche Notizen eines Users werden nicht zur Bandnachricht.

Zwei Bands dürfen vollständig unterschiedliche Mitglieder haben. Gemeinsame
Mitglieder erzeugen keine gemeinsame Datenmenge, sondern nur mehrere
getrennte Memberships derselben Person.

---

## 7. Offline- und Sync-relevante fachliche Aspekte

Dieser Abschnitt beschreibt nur fachliche Konsequenzen. Er legt kein
Sync-Verfahren fest.

### 7.1 Offline ist Normalbetrieb

Ohne Netzverbindung muss ein User weiterhin:

- Songs der aktiven Band lesen und nutzen
- Setlists der aktiven Band lesen und nutzen
- die eigenen persönlichen Song-Notizen lesen und nutzen
- die Anwendung in Probe und Auftritt verwenden

Synchronisation darf in dieser Zeit ausbleiben. Lokale Nutzung muss
dennoch fortgesetzt werden können. Offline ist Normalbetrieb, nicht nur
ein Notfallmodus.

Sobald eine Verbindung wieder da ist, soll der Abgleich sicher
fortgesetzt werden. Ein unterbrochener Abgleich darf die lokale Nutzung
nicht unbrauchbar machen und muss fortsetzbar bleiben.

### 7.2 Was gemeinsam abgeglichen wird — und was nicht

**Geteilte Banddaten** (Songs und Setlists)
können von mehreren Mitgliedern, auf mehreren Geräten und zu
unterschiedlichen Zeiten geändert werden. Mehrere MEMBER und ADMIN
dürfen denselben Song bearbeiten; gleichzeitiges Bearbeiten ist deshalb
ein erwartetes fachliches Szenario. Ein späterer Abgleich muss damit
rechnen.

**Persönliche Song-Notizen** gehören zum User. Sie nehmen nicht am
gemeinsamen Bearbeiten des Band-Songs teil. Ein Abgleich persönlicher
Notizen darf den Band-Song anderer Mitglieder nicht verändern und die
Notiz nicht automatisch für andere sichtbar machen.

**Songs verschiedener Bands** sind verschiedene Objekte in verschiedenen
Mandanten. Ein Abgleich in Band A hat fachlich keine Auswirkung auf
Band B. Auch manuell nachgebildeter oder importierter Inhalt begründet
keine Synchronisationsbeziehung.

### 7.3 Identität und Unabhängigkeit

Damit Offline-Nutzung und späterer Abgleich fachlich sinnvoll bleiben,
brauchen Songs, Setlists, Memberships und persönliche Notizen eine
stabile eigene Identität innerhalb ihres Mandanten.

Ein Song gehört zu genau einer Band. Dieselbe Song-Identität darf nicht
in zwei Bands verwendet werden; das würde implizit eine
Synchronisationsbeziehung zwischen Mandanten erzeugen, die dieses Modell
ausschließt.

### 7.4 Konflikte

Parallele Änderungen an demselben Band-Song oder derselben Setlist sind
fachlich möglich und erwartet, weil mehrere MEMBER und ADMIN denselben
Song bearbeiten dürfen und weil mehrere Mitglieder offline arbeiten
können.

Solche Konflikte dürfen nicht still zu Datenverlust führen. Wo eine
automatische Auflösung unsicher wäre, muss der ungelöste Konflikt für
den User erkennbar bleiben.

`OPEN QUESTION`: Was die fachliche Konflikteinheit ist (zum Beispiel der
ganze Song, nur der ChordPro-Inhalt oder einzelne Metadaten).

`OPEN QUESTION`: Nach welchen fachlichen Regeln Konflikte aufgelöst
werden, wenn mehrere Mitglieder denselben Band-Song oder dieselbe
Setlist geändert haben.

`OPEN QUESTION`: Ob und wie Konflikte an persönlichen Notizen desselben
Users auf mehreren Geräten behandelt werden.

### 7.5 Bühne und unsichere Verbindung

Auf der Bühne zählt Verfügbarkeit vor Verwaltung. Fachlich heißt das:

- der benötigte Song und die benötigte Setlist müssen lokal vorliegen
- der Wechsel zwischen Songs einer Setlist muss ohne Netz funktionieren
- persönliche Notizen zum aktuellen Song müssen ohne Netz lesbar sein
- fehlende Synchronisation darf den Auftritt nicht blockieren

Bearbeitungs- und Verwaltungskonflikte sind nachgelagert gegenüber dem
Lesen und Nutzen der bereits vorhandenen Banddaten.

---

## 8. Offene fachliche Fragen

Die folgenden Punkte sind bewusst **nicht** entschieden. Sie dürfen nicht
aus der aktuellen Implementierung oder aus technischen Nahelegungen
abgeleitet werden.

Das Rollen- und Berechtigungsmodell der Membership sowie der Lebenszyklus
von Band, Membership, Einladung und Ownership-Übertragung sind in
Abschnitt 2.3 festgelegt und hier nicht erneut als offen geführt.
Jede angenommene Einladung erzeugt eine Membership mit der Rolle GUEST.
Für denselben User in derselben Band gibt es höchstens eine ausstehende
Einladung. Alle aktiven Mitglieder dürfen die Mitgliederliste sehen.
Sichtbar sind dabei derzeit der Anzeigename und die Rolle in der
aktuellen Band, nicht weitere Konto- oder Profildaten. Zusätzliche
Profilangaben sind derzeit keine Produktanforderung und dürfen später
eingeführt werden, wenn ein konkreter Bedarf besteht.

Ein User ohne aktive Membership darf sein Konto verwalten, Einladungen
empfangen und annehmen und eine Band anlegen. Ohne Membership hat er
keine Band-Songs, keine Band-Setlists und keine persönlichen
Song-Notizen. Es gibt keine persönliche Song-Bibliothek und kein
persönliches bandübergreifendes Song-Repository.

Die aktive Band ist ein Nutzungs- bzw. Arbeitskontext, keine eigene
Domain-Entity und keine persistierte fachliche Voreinstellung.

Es gibt derzeit keine akzeptierte Produktanforderung für generische
Band-Einstellungen. Ein solches Konzept ist nicht Teil dieses Modells.

Der technische Einladungsweg (E-Mail, Link, QR-Code, Einladungscode oder
Benachrichtigung) bleibt unentschieden.

Die Produktgrenze gegen die Verteilung von Songinhalt zwischen Bands
ist in Abschnitt 3.4 festgelegt. Es gibt keine offene Frage mehr zum
direkten Kopieren von Songs oder Setlists zwischen Bands, zur Herkunft
von Songinhalt oder zu automatisch gepflegten Beziehungen zwischen
Songs verschiedener Bands.

### Song-Metadaten und Notizen

- `OPEN QUESTION`: Welche Song-Metadaten bandgeteilt und strukturiert
  sind und welche persönlich bleiben.
- `OPEN QUESTION`: Ob es bandgeteilte Song-Anmerkungen zusätzlich zu
  persönlichen Notizen gibt.
- `OPEN QUESTION`: Eine oder mehrere persönliche Notizen je User und
  Song.
- `OPEN QUESTION`: Lebenszyklus persönlicher Notizen bei Song-Löschung.

### Setlist

- `OPEN QUESTION`: Ob derselbe Song in einer Setlist mehrfach vorkommen
  darf.
- `OPEN QUESTION`: Verhalten der Setlist, wenn ein referenzierter Song
  gelöscht wird.

### Abgleich und Konflikte

- `OPEN QUESTION`: Fachliche Konflikteinheit bei paralleler Bearbeitung.
- `OPEN QUESTION`: Fachliche Regeln zur Konfliktauflösung bei geteilten
  Banddaten.
- `OPEN QUESTION`: Konflikte persönlicher Notizen desselben Users auf
  mehreren Geräten.

### Identität und Zugang

- `OPEN QUESTION`: Wie eine Person zum User wird und welches
  Anmeldeverfahren fachlich gelten soll. Festgelegt ist nur: Anmeldung
  muss sicher und mit geringer Reibung sein.

Diese Liste ist der Ort für spätere Entscheidungen. Solange ein Punkt
als `OPEN QUESTION` markiert ist, darf er nicht als stillschweigend
beantwortet gelten.
