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
- wie Band, Membership und Ownership entstehen und enden
- welche Grenzen zwischen Bands gelten
- welche Regeln beim Kopieren, bei Sichtbarkeit und bei Offline-Nutzung
  fachlich gelten

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

Der User ist Träger von:

- der eigenen Identität
- den Memberships zu Bands
- den persönlichen Song-Notizen

Ein User hat keine anwendungsweite Rolle OWNER, ADMIN, MEMBER oder GUEST.
Rollen hängen ausschließlich an den Memberships zu einzelnen Bands.

Account-Lebenszyklus und Membership-Lebenszyklus sind getrennte fachliche
Konzepte. Das Beenden oder Entfernen einer Membership löscht oder
deaktiviert den globalen User nicht.

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
- bandbezogene Einstellungen
- sonstige geteilte Banddaten

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

OWNER und ADMIN dürfen User in eine Band einladen.

Die vorgesehene Membership-Rolle wird mit der Einladung festgelegt.
Zulässige Einladungsrollen sind:

- ADMIN
- MEMBER
- GUEST

OWNER ist keine Einladungsrolle.

Eine Einladung erzeugt nicht sofort eine aktive Membership. Der
eingeladene User muss die Einladung annehmen, bevor die Membership
aktiv wird.

Der technische Einladungsweg (zum Beispiel E-Mail, Link, QR-Code oder
Einladungscode) ist nicht Teil dieses Modells.

`OPEN QUESTION`: Was mit einer noch nicht angenommenen Einladung
geschieht, wenn sie nicht angenommen wird (zum Beispiel Rücknahme,
Ablehnung oder zeitliches Verfallen).

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

- User mit den Rollen ADMIN, MEMBER oder GUEST einladen
- andere ADMINs, MEMBERs und GUESTs entfernen
- Membership-Rollen verwalten, ausgenommen das Zuweisen oder Übertragen
  von OWNER
- Band-Einstellungen verwalten
- Songs anlegen, bearbeiten und löschen
- Setlists anlegen, bearbeiten und löschen
- alle Band-Songs und Setlists lesen und nutzen
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
- die Band freiwillig verlassen

Ein MEMBER darf nicht:

- Songs löschen
- Setlists löschen
- Memberships verwalten
- Membership-Rollen ändern
- Band-Einstellungen ändern
- die Band löschen

#### GUEST

Ein GUEST steht für Fälle wie Aushilfe oder Gastmusiker, die vorübergehend
mit der Band spielen.

Ein GUEST darf:

- Band-Songs lesen
- Setlists lesen und nutzen
- die eigenen persönlichen Song-Notizen pflegen
- die Band freiwillig verlassen

Ein GUEST darf geteilte Banddaten nicht verändern.

Insbesondere darf ein GUEST nicht:

- Songs anlegen, bearbeiten oder löschen
- Setlists anlegen, bearbeiten oder löschen
- Memberships verwalten
- Rollen ändern
- Band-Einstellungen ändern
- die Band löschen

Persönliche Song-Notizen bleiben privates Eigentum des Users. Deshalb
dürfen auch GUEST-Nutzer sie anlegen und bearbeiten.

#### Membership verlassen und entfernen

ADMIN, MEMBER und GUEST dürfen eine Band freiwillig verlassen.
OWNER darf die Band nicht verlassen, solange er OWNER ist.

OWNER darf entfernen:

- ADMIN
- MEMBER
- GUEST

ADMIN darf entfernen:

- andere ADMINs
- MEMBERs
- GUESTs

ADMIN darf den OWNER nicht entfernen.

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
| Mitglieder einladen (ADMIN, MEMBER, GUEST) | ja | ja | nein | nein |
| Mitglieder entfernen (ohne OWNER) | ja | ja | nein | nein |
| Band freiwillig verlassen | nein | ja | ja | ja |
| Rollen verwalten (ohne OWNER) | ja | ja | nein | nein |
| Band-Einstellungen verwalten | ja | ja | nein | nein |
| Songs anlegen und bearbeiten | ja | ja | ja | nein |
| Songs löschen | ja | ja | nein | nein |
| Setlists anlegen und bearbeiten | ja | ja | ja | nein |
| Setlists löschen | ja | ja | nein | nein |
| Songs und Setlists lesen und nutzen | ja | ja | ja | ja |
| Persönliche Song-Notizen pflegen | ja | ja | ja | ja |

### 2.4 Song

Ein **Song** ist das zentrale musikalische Arbeitsobjekt einer Band.

Ein Song gehört immer **genau zu einer Band**. Es gibt keinen globalen
Song-Pool. Songs werden nicht bandübergreifend automatisch geteilt.

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
**derselben** Band referenzieren.

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

Sie gehört dem globalen User, nicht einer Membership und nicht einer Band.
Sie ist nicht Bestandteil des geteilten Band-Songs. Andere Bandmitglieder
sehen sie nicht automatisch.

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

Ein User, der mehreren Bands angehört, arbeitet fachlich jeweils im
Kontext **einer** Band. Songs, Setlists und geteilte Banddaten gehören
immer zu diesem Mandanten.

Die jeweils aktive Band muss für den User klar erkennbar sein.

`OPEN QUESTION`: Ob die aktive Band nur ein Arbeitskontext der Nutzung
ist oder eine vom User festgehaltene Voreinstellung.

---

## 3. Beziehungen zwischen Entities

```text
User 1 ──────── * Membership * ──────── 1 Band
                                          │
                                          │ 1
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    *                     *                     │
                  Song                 Setlist                  │
                    │                     │                     │
                    │                     │ nur Songs           │
                    │                     │ derselben Band      │
                    │                     *                     │
                    │              Setlist-Eintrag              │
                    │              (Position + Song)            │
                    │                                           │
User 1 ── * Persönliche Song-Notiz * ── 1 Song                  │
                                                                │
Band 1 ── * bandbezogene Einstellung / geteilte Banddaten ──────┘
```

### 3.1 User und Band

- Ein User hat null, eine oder viele Memberships.
- Eine Band hat die Memberships ihrer Mitglieder.
- Es gibt keine direkte User–Band-Beziehung ohne Membership.
- Dieselbe Person kann in Band A eine andere Rolle und andere Rechte
  haben als in Band B, weil Rolle und Rechte an der jeweiligen
  Membership hängen.
- Eine Band hat genau einen OWNER. Eine Band ohne Mitglieder kann
  deshalb nicht existieren.
- Jeder authentifizierte User darf eine Band anlegen und erhält dabei
  automatisch die OWNER-Membership.
- Das Ende einer Membership betrifft nur diese Bandbeziehung. Der globale
  User und Memberships in anderen Bands bleiben unberührt.

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
- Die Notiz gehört nicht zur Membership und nicht zur Band.
- Die Notiz erzeugt keine Teilhabe anderer Mitglieder am Inhalt der Notiz.
- Endet die Membership zur Band des Songs, wird die Notiz nicht
  automatisch gelöscht. Ohne Zugang zu den Songs der Band ist sie jedoch
  nicht über den normalen Song-Kontext verfügbar.

### 3.4 Song-Kopie zwischen Bands

Ein User, der Mitglied in mehreren Bands ist, kann einen Song bewusst
von einer Band in eine andere kopieren.

Dabei gilt:

- Es entsteht ein **neuer, unabhängiger Song** in der Ziel-Band.
- Original und Kopie haben danach keine automatische
  Synchronisationsbeziehung.
- Änderungen an der Kopie dürfen die andere Band nicht beeinflussen
  — und umgekehrt.
- Persönliche Notizen werden nicht automatisch mitkopiert.

Eine Song-Kopie ist **kein Teilen**. Nach dem Kopieren existieren zwei
getrennte Songs in zwei Mandanten.

`OPEN QUESTION`: Wer Songs oder Setlists von einer Band in eine andere
kopieren darf.

`OPEN QUESTION`: Ob eine Herkunftsinformation (welcher Song wurde
kopiert) festgehalten wird, ohne daraus eine Sync-Beziehung zu machen.

`OPEN QUESTION`: Welche Bestandteile eines Songs beim Kopieren
übernommen werden (zum Beispiel nur Titel, Artist und ChordPro-Inhalt,
oder auch weitere Band-Metadaten).

`OPEN QUESTION`: Ob Setlists analog in eine andere Band kopiert werden
können.

---

## 4. Fachliche Regeln / Invarianten

Die folgenden Regeln gelten unabhängig von einer technischen Umsetzung.

1. **Mandantengrenze.** Eine Band ist ein eigenständiger Mandant.
   Banddaten einer Band sind für eine andere Band nicht sichtbar und
   nicht implizit gemeinsam.

2. **Keine automatische Bandüberschreitung.** Songs, Setlists und
   geteilte Banddaten werden nicht automatisch zwischen Bands geteilt.
   Es gibt keinen globalen Song-Pool.

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

7. **Unabhängigkeit nach Kopie.** Eine bewusste Kopie erzeugt einen
   neuen Song. Danach gibt es keine automatische inhaltliche Bindung
   zwischen Original und Kopie.

8. **Persönliche Notiz ist nicht der Song.** Persönliche Notizen sind
   kein Bestandteil des geteilten Band-Songs. Änderungen am Band-Song
   überschreiben sie nicht fachlich; die Notiz ist ein eigenes Objekt.

9. **Keine automatische Notiz-Sichtbarkeit.** Andere Mitglieder derselben
   Band sehen eine persönliche Notiz nicht automatisch.

10. **Keine automatische Notiz-Mitnahme.** Beim Kopieren eines Songs in
    eine andere Band werden persönliche Notizen nicht automatisch
    mitkopiert.

11. **Offline-Nutzung bleibt gültig.** Songs, Setlists und persönliche
    Notizen müssen ohne Netzverbindung fachlich nutzbar bleiben. Fehlende
    Synchronisation darf die lokale Nutzung nicht verhindern.

12. **Keine stille Vernichtung gemeinsamer Arbeit.** Bei späteren
    Abgleichen gemeinsam bearbeiteter Banddaten dürfen Änderungen nicht
    still verloren gehen.

13. **Genau ein OWNER.** Jede Band hat vom ersten Moment an genau einen
    OWNER. Eine Ownership-Übertragung darf nicht dazu führen, dass eine
    Band keinen oder mehrere OWNER hat, auch nicht vorübergehend.

14. **Eine Rolle je Membership.** Eine Membership hat genau eine Rolle:
    OWNER, ADMIN, MEMBER oder GUEST.

15. **Song- und Setlist-Rechte.** OWNER, ADMIN und MEMBER dürfen Songs
    und Setlists anlegen und bearbeiten. Löschen dürfen nur OWNER und
    ADMIN. GUEST darf geteilte Banddaten nicht verändern.

16. **Persönliche Notizen unabhängig von der Bandrolle.** Persönliche
    Song-Notizen darf jede Membership-Rolle pflegen, einschließlich GUEST.

17. **Gemeinsames Bearbeiten ist erwartet.** Mehrere MEMBER und ADMIN
    dürfen denselben Song bearbeiten. Gleichzeitige Änderungen sind ein
    erwartetes fachliches Szenario.

18. **Band anlegen.** Jeder authentifizierte User darf eine Band anlegen.
    Dabei entsteht automatisch eine OWNER-Membership für den anlegenden
    User. Es gibt keine fachliche Obergrenze für die Zahl der Bands, die
    ein User anlegen darf.

19. **Aktive Membership durch Annahme.** Eine Einladung erzeugt keine
    aktive Membership. Die Membership wird erst aktiv, wenn der
    eingeladene User die Einladung annimmt. OWNER entsteht nicht durch
    Einladung, sondern durch Anlegen der Band oder durch
    Ownership-Übertragung.

20. **OWNER bleibt, bis Ownership übertragen ist.** OWNER darf die Band
    nicht verlassen und die OWNER-Membership darf nicht entfernt werden,
    solange das Ownership nicht übertragen wurde.

21. **Entfernen ohne OWNER.** OWNER darf ADMIN, MEMBER und GUEST
    entfernen. ADMIN darf andere ADMINs, MEMBERs und GUESTs entfernen.
    ADMIN darf den OWNER nicht entfernen. ADMIN, MEMBER und GUEST dürfen
    die Band freiwillig verlassen.

22. **Ownership-Übertragung.** Nur der aktuelle OWNER darf Ownership
    übertragen, und nur auf ein bestehendes Mitglied mit der Rolle ADMIN
    oder MEMBER. Der neue User wird OWNER, der bisherige OWNER wird
    ADMIN.

23. **Persönliche Notizen überdauern das Membership-Ende.** Persönliche
    Song-Notizen gehören dem globalen User. Endet eine Membership, werden
    sie nicht automatisch gelöscht. Der User verliert den Zugang zu den
    Songs der Band; Notizen zu diesen Songs sind dann nicht über den
    normalen Song-Kontext verfügbar. Andere Bands und deren Notizen
    bleiben unberührt. Erhält der User später wieder Zugang zu derselben
    Band und demselben Song, können bestehende persönliche Notizen wieder
    verfügbar werden.

`OPEN QUESTION`: Wer Songs oder Setlists von einer Band in eine andere
kopieren darf. Die Rechte zum Anlegen in der Ziel-Band sind festgelegt;
ob Kopieren eine eigene fachliche Aktion mit eigenen Grenzen ist, ist
offen.

`OPEN QUESTION`: Welche Nutzung ein User ohne Membership außer dem
Anlegen einer Band hat. Songs und Setlists gehören in diesem Modell
immer zu einer Band.

---

## 5. Ownership und Sichtbarkeit

Ownership beschreibt, wem ein Objekt fachlich gehört.
Sichtbarkeit beschreibt, wer es sehen oder nutzen darf.

Diese beiden Fragen sind nicht dasselbe.

| Objekt | Gehört fachlich | Sichtbar / nutzbar |
|---|---|---|
| User-Identität | dem User | anwendungsweit als Identität, nicht als Banddaten |
| Band | der Band als Mandant | den Mitgliedern dieser Band |
| Membership | der Beziehung User–Band | ändern dürfen OWNER und ADMIN; `OPEN QUESTION`: wer Memberships einer Band sehen darf |
| Song | der Band | den Mitgliedern dieser Band |
| Setlist | der Band | den Mitgliedern dieser Band |
| Persönliche Song-Notiz | dem User | nur diesem User, bezogen auf den konkreten Song |
| Bandbezogene Einstellungen | der Band | ändern dürfen OWNER und ADMIN; sichtbar den Mitgliedern dieser Band, soweit Berechtigungen es erlauben |

### 5.1 Geteilte Banddaten

Songs, Setlists und bandbezogene Einstellungen sind **geteilte
Banddaten**. OWNER, ADMIN und MEMBER arbeiten daran gemeinsam. GUEST
darf geteilte Banddaten nur lesen und nutzen, nicht verändern.

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
- Eine Kopie des Songs in eine andere Band erzeugt einen neuen Song ohne
  die persönliche Notiz des Ursprungs-Users.

Persönliche Song-Notizen gehören dem globalen User, nicht der Membership
oder der Band.

Endet die Membership des Users zu der Band des Songs:

- die persönlichen Notizen werden nicht automatisch gelöscht
- der User verliert den Zugang zu den Songs der Band
- Notizen zu diesen Songs sind daher nicht über den normalen
  Song-Kontext verfügbar, solange der User keinen Zugang hat
- andere Bands und die Notizen zu deren Songs bleiben vollständig
  unberührt

Erhält der User später wieder Zugang zu derselben Band und demselben
Song, können bestehende persönliche Notizen wieder verfügbar werden.

Wie diese Notizen technisch persistiert oder abgeglichen werden, ist
nicht Teil dieses Modells.

`OPEN QUESTION`: Was mit persönlichen Notizen geschieht, wenn der Song
gelöscht wird.

### 5.3 User ohne Band

Ein User kann ohne Membership existieren. In diesem Modell besitzt er
dann keine Band-Songs und keine Band-Setlists. Er darf jedoch eine Band
anlegen und wird dadurch OWNER dieser Band.

`OPEN QUESTION`: Ob ein User ohne Band darüber hinaus fachlich relevante
Daten halten kann und welche weitere Nutzung dann vorgesehen ist.

---

## 6. Tenant-Grenzen

Die **Band ist der Mandant**. Alle geteilten Arbeitsdaten liegen innerhalb
genau einer Band.

### 6.1 Was innerhalb einer Band liegt

- Mitglieder über Memberships
- Songs
- Setlists
- bandbezogene Einstellungen
- sonstige geteilte Banddaten

Ein User sieht in einer Band nur die geteilten Daten dieser Band. Die
aktive Band bestimmt, in welchem Mandanten gerade gearbeitet wird.

### 6.2 Was die Band-Grenze überschreitet

Nur wenige Konzepte sind bewusst bandübergreifend:

- **User-Identität** — global, nicht Eigentum einer Band
- **Memberships** — verbinden einen User mit einzelnen Bands, ohne
  Banddaten zu vermischen
- **Persönliche Song-Notizen** — gehören dem globalen User, nicht der
  Membership oder der Band; sie verweisen auf einen Song einer Band,
  gehören aber nicht zu deren geteilten Daten
- **Bewusste Song-Kopie** — der einzige festgelegte Weg, Songinhalt von
  einer Band in eine andere zu übernehmen; danach sind beide Songs
  unabhängig

Alles andere bleibt innerhalb des Mandanten.

Ein späteres, ausdrücklich erlaubtes Teilen zwischen Bands ist kein
bestehender Bestandteil dieses Modells. Solange es nicht entschieden ist,
gilt Isolation.

### 6.3 Was Isolation konkret bedeutet

- Band A kann die Songs von Band B nicht sehen.
- Eine Setlist von Band A kann keinen Song von Band B enthalten.
- Rechte aus der Membership zu Band A gelten nicht in Band B.
- Das Ende einer Membership in Band A berührt Band B nicht.
- Eine Änderung an einem Song von Band A ändert keinen Song von Band B,
  auch wenn dieser durch Kopieren entstanden ist.
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

**Geteilte Banddaten** (Songs, Setlists, bandbezogene Einstellungen)
können von mehreren Mitgliedern, auf mehreren Geräten und zu
unterschiedlichen Zeiten geändert werden. Mehrere MEMBER und ADMIN
dürfen denselben Song bearbeiten; gleichzeitiges Bearbeiten ist deshalb
ein erwartetes fachliches Szenario. Ein späterer Abgleich muss damit
rechnen.

**Persönliche Song-Notizen** gehören zum User. Sie nehmen nicht am
gemeinsamen Bearbeiten des Band-Songs teil. Ein Abgleich persönlicher
Notizen darf den Band-Song anderer Mitglieder nicht verändern und die
Notiz nicht automatisch für andere sichtbar machen.

**Kopierte Songs** sind verschiedene Objekte in verschiedenen Mandanten.
Ein Abgleich in Band A hat fachlich keine Auswirkung auf Band B.

### 7.3 Identität und Unabhängigkeit

Damit Offline-Nutzung und späterer Abgleich fachlich sinnvoll bleiben,
brauchen Songs, Setlists, Memberships und persönliche Notizen eine
stabile eigene Identität.

Eine Song-Kopie braucht eine **neue** Identität. Würde dieselbe Identität
in zwei Bands weiterverwendet, entstünde implizit genau die
Sync-Beziehung, die dieses Modell ausschließt.

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
von Band, Membership und Ownership-Übertragung sind in Abschnitt 2.3
festgelegt und hier nicht erneut als offen geführt.

### Membership, Rollen und Lebenszyklus

- `OPEN QUESTION`: Was mit einer noch nicht angenommenen Einladung
  geschieht, wenn sie nicht angenommen wird (Rücknahme, Ablehnung oder
  zeitliches Verfallen).
- `OPEN QUESTION`: Wer Memberships einer Band sehen darf.
- `OPEN QUESTION`: Wer Songs oder Setlists von einer Band in eine andere
  kopieren darf.

### User ohne Band

- `OPEN QUESTION`: Welche Nutzung ein User ohne Membership außer dem
  Anlegen einer Band hat.

### Song-Metadaten und Notizen

- `OPEN QUESTION`: Welche Song-Metadaten bandgeteilt und strukturiert
  sind und welche persönlich bleiben.
- `OPEN QUESTION`: Ob es bandgeteilte Song-Anmerkungen zusätzlich zu
  persönlichen Notizen gibt.
- `OPEN QUESTION`: Eine oder mehrere persönliche Notizen je User und
  Song.
- `OPEN QUESTION`: Lebenszyklus persönlicher Notizen bei Song-Löschung.

### Kopieren zwischen Bands

- `OPEN QUESTION`: Ob eine Herkunftsinformation ohne Sync-Beziehung
  festgehalten wird.
- `OPEN QUESTION`: Welche Song-Bestandteile beim Kopieren übernommen
  werden.
- `OPEN QUESTION`: Ob Setlists analog in eine andere Band kopiert
  werden können.

### Setlist

- `OPEN QUESTION`: Ob derselbe Song in einer Setlist mehrfach vorkommen
  darf.
- `OPEN QUESTION`: Verhalten der Setlist, wenn ein referenzierter Song
  gelöscht wird.

### Band und Arbeitskontext

- `OPEN QUESTION`: Inhalt und Umfang bandbezogener Einstellungen.
- `OPEN QUESTION`: Ob die aktive Band nur Nutzungskontext oder eine
  festgehaltene Voreinstellung ist.

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
