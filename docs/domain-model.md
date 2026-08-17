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
Zusammenarbeit innerhalb einer Band — in Probe und Auftritt auch ohne
Netzverbindung, indem lokal verfügbare Songs, Setlists und persönliche
Notizen gelesen und genutzt werden.

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

- Offline-Verfügbarkeit für Probe und Auftritt (Lesen und Nutzen, kein
  Bearbeiten)
- Multi-Tenancy mit der Band als Mandant
- sichere Anmeldung mit geringer Reibung und eine verlässliche globale
  User-Identität
- fortgesetzte Offline-Nutzung in Probe und Auftritt nach vorheriger
  Authentifizierung
- Nutzung auf der Bühne
- eine UI in der Sprache von Musikern

---

## 2. Zentrale Domain Entities

### 2.1 User

Ein **User** ist die globale Identität einer Person in My Songbook.

Die User-Identität ist anwendungsweit und nicht band-spezifisch. Dieselbe
User-Identität gilt für alle Bands und alle Memberships dieses Users.
Ein User braucht kein gesondertes Konto und keine gesonderte Identität
je Band. Es gibt keine band-spezifischen User-Identitäten.

Ein User kann Mitglied in keiner, einer oder mehreren Bands sein.
Ein globaler User darf ohne aktive Band-Membership existieren.

Der User ist Träger von:

- der eigenen Identität
- den Memberships zu Bands, sofern vorhanden
- den persönlichen Song-Notizen, sofern eine aktive Membership besteht

Ein User hat keine anwendungsweite Rolle OWNER, ADMIN, MEMBER oder GUEST.
Rollen hängen ausschließlich an den Memberships zu einzelnen Bands, nicht
an der globalen User-Identität.

Account-Lebenszyklus und Membership-Lebenszyklus sind getrennte fachliche
Konzepte. Das Beenden oder Entfernen einer Membership löscht oder
deaktiviert den globalen User nicht.

Die globale Kontolöschung ist nicht Teil dieses Modells. Sie hat
weiterreichende Folgen für Memberships, OWNER-Verantwortlichkeiten und
user-eigene Daten und bleibt eine gesonderte spätere Entscheidung.
Spekulative Lebenszyklusregeln dafür werden hier nicht eingeführt.

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

Anmeldung muss sicher und mit geringer Reibung sein. Auf einem
persönlichen Gerät bleibt der User in der Regel angemeldet und muss
sich nicht bei jeder Nutzung der Anwendung erneut authentifizieren.

Nachdem der User sich zuvor authentifiziert hat und die benötigten
lokalen Daten vorliegen, darf fehlende Netzverbindung die Offline-
Nutzung in Probe und Auftritt nicht verhindern. Lokal verfügbare
Band-Songs, Setlists und persönliche Song-Notizen bleiben lesbar und
nutzbar. Offline ist kein Bearbeitungsmodus.

Das konkrete Anmeldeverfahren ist nicht Teil dieses Modells. Es bleibt
eine Architekturentscheidung für die Zielarchitektur bzw. ein ADR.
Insbesondere schreibt dieses Modell nicht vor:

- Benutzername und Passwort
- E-Mail und Passwort
- Passkeys
- Magic Links
- Anmeldung über Google, Microsoft, Apple oder einen anderen
  Identitätsanbieter

Fachlich gefordert ist nur:

- sichere Authentifizierung
- geringe Reibung
- eine verlässliche globale User-Identität
- fortgesetzte Offline-Nutzung in Probe und Auftritt nach vorheriger
  Authentifizierung

Token-Laufzeiten, Sitzungsimplementierung, Refresh-Verhalten und die
Speicherung von Anmeldedaten sind nicht Teil dieses Modells.

Die Identität muss so einfach und verlässlich sein, dass Zusammenarbeit
in der Band möglich ist, ohne dass die Anwendung wie ein
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

OWNER und ADMIN dürfen eine Einladung erzeugen. Bei der Einladung gibt
es keine Rollenauswahl. Es entsteht keine zusätzliche Membership-Rolle
und kein einladungsspezifisches Recht.

##### Einmaliger Einladungslink

Eine Band-Einladung wird als einmaliger Einladungslink übermittelt.
Das ist der einzige Einladungsweg.

OWNER oder ADMIN erzeugen den Link und teilen ihn selbst über einen
beliebigen Kommunikationskanal, zum Beispiel WhatsApp, Signal, einen
anderen Messenger oder E-Mail. My Songbook versendet selbst keine
Einladungs-E-Mails.

Der Einladende muss nicht wissen, ob die empfangende Person bereits ein
My Songbook-Konto hat, und muss vor dem Erzeugen keinen bestehenden
User identifizieren oder auswählen. Die Identität der empfangenden
Person wird erst relevant, wenn ein authentifizierter User die
Einladung annimmt.

Ein Einladungslink steht für genau eine Einladung. Der Link ist
einmalig. Er ist kein wiederverwendbarer öffentlicher Beitrittslink
der Band.

Weil beim Erzeugen kein User ausgewählt wird, darf eine Band mehrere
ausstehende Einladungen gleichzeitig haben. Jede ist ein eigener
einmaliger Link.

Es gibt kein durchsuchbares Verzeichnis von My Songbook-Usern.
Insbesondere nicht erforderlich sind:

- User-Suche zum Einladen
- Suche nach Usern über E-Mail-Adressen
- ein öffentliches User-Verzeichnis
- das Entdecken von My Songbook-Konten anhand einer E-Mail-Adresse
- Anbindung an Kontakte oder Adressbücher

Derzeit nicht erforderlich sind außerdem:

- automatischer E-Mail-Versand von Einladungen
- ein E-Mail-Versanddienst
- QR-Code-Einladungen
- Einladungscodes neben dem Einladungslink
- mehrere parallele Einladungswege

Ein QR-Code darf später dieselbe Einladungs-URL darstellen, wenn eine
konkrete Produktanforderung entsteht. Ebenso darf automatischer
E-Mail-Versand später hinzukommen, wenn ein konkreter Bedarf besteht.
Beides ist keine aktuelle Produktanforderung.

Wie der Einladungskontext über Login oder Registrierung erhalten bleibt,
ist nicht Teil dieses Modells. Token-Formate, URL-Signierung,
Sitzungsdesign und das konkrete Anmeldeverfahren bleiben
Architekturentscheidungen.

##### Öffnen eines Einladungslinks

Derselbe Einladungslink gilt für alle empfangenden Personen.

**Bereits authentifizierter User.** Der User öffnet den Link.
My Songbook zeigt, zu welcher Band die Einladung gehört. Der User darf
die Einladung annehmen oder ablehnen. Die Annahme erzeugt eine
Membership mit der Rolle GUEST.

**Bestehender User, der nicht authentifiziert ist.** Der User öffnet
den Link und wird zur Authentifizierung aufgefordert. Der
Einladungskontext bleibt über den Authentifizierungsvorgang hinweg
erhalten. Nach erfolgreicher Authentifizierung sieht der User die
Einladung und darf sie annehmen oder ablehnen. Die Annahme erzeugt eine
Membership mit der Rolle GUEST.

**Person ohne My Songbook-Konto.** Die Person öffnet den Link und wird
durch die Kontoerstellung geführt. Der Einladungskontext bleibt über
Registrierung und Authentifizierung hinweg erhalten. Danach sieht der
neue User die Einladung und darf sie annehmen oder ablehnen. Die
Annahme erzeugt eine Membership mit der Rolle GUEST.

##### Annahme, Rolle und Zugehörigkeit

Eine ausstehende Einladung erzeugt keine aktive Membership. Die
Membership wird erst aktiv, wenn ein authentifizierter User die
Einladung annimmt. Jede angenommene Einladung erzeugt eine neue
Membership mit der Rolle GUEST.

ADMIN entsteht nicht durch eine Einladung. OWNER entsteht nicht durch
eine Einladung. OWNER entsteht nur durch Anlegen der Band oder durch
Ownership-Übertragung.

Nachdem die Membership existiert, dürfen OWNER oder ADMIN die Rolle
nach den bestehenden Regeln zur Rollenverwaltung ändern. Ein neu
eingeladener User beginnt deshalb als GUEST und kann später zum MEMBER
und anschließend zum ADMIN befördert werden.

Ein User, der in einer Band bereits eine aktive Membership hat, kann
eine Einladung zu dieser Band nicht annehmen. Es entsteht keine weitere
Membership. Rollenänderungen bestehender Mitglieder erfolgen an der
bestehenden Membership, nicht über Einladungen.

Für denselben User in derselben Band darf gleichzeitig höchstens eine
ausstehende Einladung existieren. Diese Regel wird nicht durch Auswahl
eines Users beim Erzeugen durchgesetzt. Sie gilt, sobald ein
authentifizierter User die Einladung annehmen kann: derselbe User kann
in derselben Band nicht durch mehrere Links zusätzliche Memberships
erhalten.

##### Ausgänge einer Einladung

Eine ausstehende Einladung endet auf einem der folgenden Wege.

**Angenommen.** Ein authentifizierter User nimmt die Einladung an.

Dann gilt:

- es entsteht eine aktive Membership mit der Rolle GUEST
- die Einladung ist verbraucht und nicht mehr ausstehend
- der Link kann nicht erneut angenommen werden
- eine wiederholte Nutzung erzeugt keine weitere Membership

**Abgelehnt.** Der authentifizierte User darf die Einladung ablehnen.

Dann gilt:

- es entsteht keine Membership
- die Einladung ist verbraucht und nicht mehr verwendbar
- der Link kann anschließend nicht angenommen werden
- OWNER oder ADMIN dürfen bei Bedarf eine neue Einladung erzeugen

**Zurückgezogen.** OWNER oder ADMIN dürfen eine noch ausstehende
Einladung zurückziehen.

Dann gilt:

- es entsteht keine Membership
- die Einladung gilt als abgeschlossen
- der Link kann nicht mehr angenommen werden
- OWNER oder ADMIN dürfen bei Bedarf eine neue Einladung erzeugen

**Abgelaufen.** Eine Einladung läuft 14 Tage nach ihrer Erzeugung ab.
Die 14-tägige Lebensdauer ist derzeit eine feste Produktregel.

Dann gilt:

- der Einladungslink kann nicht mehr angenommen werden
- es entsteht keine Membership
- OWNER oder ADMIN dürfen bei Bedarf eine neue Einladung erzeugen

Es gibt keine konfigurierbare Ablaufzeit, keine bandbezogenen
Ablauf-Einstellungen, keine globale Einstellung der Lebensdauer und
keine Verlängerung oder Erneuerung einer bestehenden Einladung. Soll
später eine andere Lebensdauer gelten, kann die Produktregel dann
geändert werden.

##### Erneute Einladung

Nachdem eine Einladung abgelehnt, zurückgezogen oder abgelaufen ist,
dürfen OWNER oder ADMIN eine neue Einladung erzeugen.

Frühere abgelehnte, zurückgezogene oder abgelaufene Einladungen sind
kein dauerhaftes Hindernis. Ob die empfangende Person die neue
Einladung annehmen kann, entscheidet sich bei der Annahme: ein User mit
aktiver Membership in dieser Band kann sie nicht annehmen. Für
denselben User in derselben Band darf gleichzeitig höchstens eine
ausstehende Einladung existieren.

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

- Einladungslinks erzeugen
- ausstehende Einladungen zurückziehen
- andere ADMINs, MEMBERs und GUESTs entfernen
- Membership-Rollen verwalten, ausgenommen das Zuweisen oder Übertragen
  von OWNER
- Songs anlegen, bearbeiten und löschen
- Setlists anlegen, bearbeiten und löschen
- alle Band-Songs und Setlists lesen und nutzen
- die eigenen persönlichen Song-Notizen pflegen (online)
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
- die eigenen persönlichen Song-Notizen pflegen (online)
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
- die eigenen persönlichen Song-Notizen pflegen (online)
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
dürfen auch GUEST-Nutzer sie online anlegen und bearbeiten. Offline sind
persönliche Song-Notizen nur lesbar.

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

Der Schutz vor gleichzeitigen Online-Änderungen ist eine spätere
technische bzw. Architekturfrage. Dieses Modell legt dafür keinen
fachlichen Konflikt-Workflow fest.

#### Übersicht der Band-Rollen

| Aktion | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|
| Band löschen | ja | nein | nein | nein |
| Ownership übertragen | ja | nein | nein | nein |
| Einladungslink erzeugen | ja | ja | nein | nein |
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
| Persönliche Song-Notizen pflegen (online) | ja | ja | ja | ja |

### 2.4 Song

Ein **Song** ist das zentrale musikalische Arbeitsobjekt einer Band.

Ein Song gehört immer **genau zu einer Band**. Es gibt keinen globalen
Song-Pool und kein persönliches bandübergreifendes Song-Repository.
Songs werden nicht zwischen Bands geteilt, direkt kopiert oder
automatisch synchronisiert.

My Songbook erleichtert die Zusammenarbeit innerhalb einer Band, nicht
die Verteilung von Songinhalt zwischen Bands. Ein User, der Mitglied in
mehreren Bands ist, sieht die Songsammlung jeder Band als unabhängig.

Fachlich umfasst ein Song derzeit:

- eine eigene Identität
- die Zugehörigkeit zu genau einer Band
- einen Titel
- einen Interpreten bzw. Artist
- den Songinhalt im ChordPro-Format

ChordPro ist die kanonische inhaltliche Darstellung eines Songs. Andere
Eingabeformen (zum Beispiel importierter Rohtext) werden fachlich in
ChordPro überführt, bevor ein Song als Band-Song existiert.

Der geteilte Songinhalt ist der ChordPro-Inhalt. Es gibt derzeit kein
gesondertes Konzept für bandweite Song-Anmerkungen und keine Entity
wie BandSongNote. Entsteht später eine konkrete Anforderung für
geteilte Anmerkungen, darf sie dann modelliert werden.

Strukturierte Zusatzangaben wie Tonart, Capo, Tempo, Dauer, Genre,
Tags oder Arrangement-Metadaten sind derzeit keine Produktanforderung.
Soweit solche Informationen sinnvoll im ChordPro-Inhalt stehen können,
bleiben sie dort. Zusätzliche strukturierte Metadaten dürfen später
eingeführt werden, wenn ein konkreter Bedarf besteht. Sie sind nicht
ausgeschlossen. Ein spekulatives Metadatenmodell wird heute nicht
eingeführt.

Wird ein Song gelöscht, gilt:

- der Song wird gelöscht
- alle persönlichen Song-Notizen, die sich auf diesen Song beziehen,
  werden gelöscht
- alle Setlist-Einträge, die auf diesen Song verweisen, werden
  entfernt, auch wenn der Song in einer oder mehreren Setlists
  mehrfach vorkommt
- die Setlists selbst bleiben bestehen

Es gibt keine verwaisten persönlichen Notizen und keine Platzhalter-
Einträge für gelöschte Songs. Die Löschung eines Songs
wird nicht allein deshalb verhindert, weil der Song in einer Setlist
verwendet wird. Das konkrete Bestätigungsverhalten in der Oberfläche
ist nicht Teil dieses Modells.

### 2.5 Setlist

Eine **Setlist** ist eine benannte, geordnete Zusammenstellung von Songs
für Probe oder Auftritt.

Eine Setlist gehört immer **genau zu einer Band**. Sie darf nur Songs
**derselben** Band referenzieren. Das Kopieren einer Setlist in eine
andere Band ist keine unterstützte Komfortfunktion, weil es eine
Verteilung von Songinhalt zwischen Bands erfordern würde.

Fachlich umfasst eine Setlist derzeit:

- eine eigene Identität
- die Zugehörigkeit zu genau einer Band
- einen Namen
- eine geordnete Folge von Setlist-Einträgen

Jeder Setlist-Eintrag verweist auf einen Song derselben Band. Derselbe
Song darf in derselben Setlist mehrfach vorkommen, etwa als Reprise
oder Zugabe. Eine Eindeutigkeit der Song-Verweise innerhalb einer
Setlist ist nicht erforderlich.

Die Reihenfolge ist fachlich bedeutsam: auf der Bühne muss der Wechsel
zwischen Songs vorhersagbar und schnell sein.

Wird ein referenzierter Song gelöscht, werden alle Setlist-Einträge
entfernt, die auf ihn verweisen. Die Setlist selbst bleibt. Es gibt
keine Platzhalter-Einträge für gelöschte Songs.

### 2.6 Persönliche Song-Notiz

Eine **persönliche Song-Notiz** gehört einem User und bezieht sich auf
genau einen konkreten Song.

Je Kombination aus User und Song gibt es höchstens eine persönliche
Song-Notiz: (User, Song) → 0..1. Die Notiz selbst darf beliebigen
bzw. langen Text enthalten. Mehrere Notiz-Entities je User und Song
sind nicht erforderlich.

Sie ist privates Eigentum des Users und nicht Bestandteil des geteilten
Band-Songs. Andere Bandmitglieder sehen sie nicht.

OWNER, ADMIN, MEMBER und GUEST dürfen die eigenen persönlichen
Song-Notizen pflegen. Das Anlegen, Bearbeiten und Löschen erfordert eine
Online-Verbindung. Offline sind persönliche Song-Notizen nur lesbar.

Eine persönliche Song-Notiz darf nur existieren, solange der User eine
aktive Membership zu der Band hat, der der referenzierte Song gehört,
und solange der referenzierte Song existiert. Wird der Song gelöscht,
werden alle persönlichen Notizen zu diesem Song gelöscht.

Typische Inhalte können sein:

- Spielhinweise
- Akkord-Erinnerungen
- Capo-Position
- Arrangement-Notizen
- Auftritts-Cues

Diese Beispiele beschreiben den fachlichen Zweck der persönlichen
Notiz. Geteilter Songinhalt liegt im ChordPro-Inhalt des Band-Songs,
nicht in einer gesonderten bandweiten Anmerkungs-Entity.

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
           (höchstens eine je User und Song)
```

### 3.1 User und Band

- Ein User hat null, eine oder viele Memberships.
- Die User-Identität ist anwendungsweit und nicht band-spezifisch.
  Dieselbe Identität gilt für alle Bands und alle Memberships dieses
  Users. Ein User braucht kein gesondertes Konto je Band. Es gibt keine
  band-spezifischen User-Identitäten. Memberships verweisen auf diese
  globale User-Identität.
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
- Eine Einladung gehört zu genau einer Band und wird als einmaliger
  Einladungslink übermittelt. Der Einladende wählt dabei keinen User
  aus. Die Einladung legt keine Membership-Rolle fest. Bei Annahme
  durch einen authentifizierten User entsteht stets eine Membership
  mit der Rolle GUEST.
- Eine Band darf mehrere ausstehende Einladungen gleichzeitig haben.
  Für denselben User in derselben Band darf gleichzeitig höchstens
  eine ausstehende Einladung existieren. Ein User mit aktiver
  Membership in einer Band kann eine Einladung zu dieser Band nicht
  annehmen.
- Das Ende einer Membership betrifft nur diese Bandbeziehung. Der globale
  User und Memberships in anderen Bands bleiben unberührt. Persönliche
  Song-Notizen zu Songs dieser Band werden gelöscht; Notizen zu anderen
  Bands bleiben unberührt.

### 3.2 Band, Song und Setlist

- Eine Band besitzt viele Songs.
- Eine Band besitzt viele Setlists.
- Ein Song gehört zu genau einer Band.
- Eine Setlist gehört zu genau einer Band.
- Eine Setlist verweist über Setlist-Einträge auf null oder viele Songs.
- Jeder Verweis in einer Setlist muss auf einen Song derselben Band
  zeigen.
- Derselbe Song darf in derselben Setlist mehrfach vorkommen.
  Eindeutigkeit der Song-Verweise ist nicht erforderlich.
- Wird ein Song gelöscht, werden alle Setlist-Einträge entfernt, die
  auf ihn verweisen. Die Setlists selbst bleiben.

### 3.3 User, Song und persönliche Notiz

- Eine persönliche Notiz gehört zu genau einem User.
- Eine persönliche Notiz bezieht sich auf genau einen Song.
- Je User und Song gibt es höchstens eine persönliche Notiz.
- Der Song bleibt Eigentum der Band; die Notiz bleibt Eigentum des Users.
- Die Notiz ist nicht Bestandteil der geteilten Banddaten.
- Die Notiz erzeugt keine Teilhabe anderer Mitglieder am Inhalt der Notiz.
- Eine persönliche Notiz darf nur existieren, solange der User eine
  aktive Membership zu der Band hat, der der referenzierte Song gehört,
  und solange der Song existiert.
- Endet die Membership, werden alle persönlichen Notizen dieses Users
  zu Songs dieser Band gelöscht. Notizen zu anderen Bands bleiben
  unberührt.
- Wird ein Song gelöscht, werden alle persönlichen Notizen zu diesem
  Song gelöscht. Es bleiben keine verwaisten Notizen.

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

3. **User ist global, Rechte sind lokal.** Die User-Identität ist
   anwendungsweit und nicht band-spezifisch. Dieselbe Identität gilt für
   alle Bands und Memberships dieses Users. Ein User braucht kein
   gesondertes Konto je Band. Es gibt keine band-spezifischen
   User-Identitäten. Mitgliedschaft, Rollen und Berechtigungen gelten nur
   innerhalb der jeweiligen Band über die Membership. Ein User hat keine
   anwendungsweite Rolle OWNER, ADMIN, MEMBER oder GUEST. Account-
   Lebenszyklus und Membership-Lebenszyklus sind getrennte Konzepte. Die
   globale Kontolöschung ist nicht Teil dieses Modells.

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

9. **Persönliche Notizen bleiben privat.** Andere Mitglieder derselben
   Band sehen eine persönliche Notiz nicht.

10. **Offline-Nutzung ist Lesen und Nutzen.** Offline-Fähigkeit dient
    Probe und Auftritt. Wenn die benötigten Daten zuvor lokal verfügbar
    gemacht wurden, muss ein authentifizierter User Songs, Setlists und
    persönliche Song-Notizen ohne Netzverbindung ansehen und nutzen
    können. Offline ist kein Bearbeitungsmodus. Schreibende und
    administrative Vorgänge erfordern eine Online-Verbindung.

11. **Keine Offline-Änderungen.** Domain-Daten werden offline nicht
    verändert. Es gibt keine Offline-Änderungswarteschlange und keine
    später nachgespielten Offline-Änderungen. Nach Wiederherstellung der
    Verbindung werden lokale Daten mit dem maßgeblichen Online-Stand
    aktualisiert. Wann und auf welchem technischen Weg das geschieht,
    ist nicht Teil dieses Modells. Konkurrierende Offline-Änderungen
    müssen nicht zusammengeführt werden.

12. **Genau ein OWNER.** Jede Band hat vom ersten Moment an genau einen
    OWNER. Eine Ownership-Übertragung darf nicht dazu führen, dass eine
    Band keinen oder mehrere OWNER hat, auch nicht vorübergehend.

13. **Eine Rolle je Membership.** Eine Membership hat genau eine Rolle:
    OWNER, ADMIN, MEMBER oder GUEST.

14. **Song- und Setlist-Rechte.** OWNER, ADMIN und MEMBER dürfen Songs
    und Setlists anlegen und bearbeiten. Löschen dürfen nur OWNER und
    ADMIN. GUEST darf geteilte Banddaten nicht verändern.

15. **Persönliche Notizen unabhängig von der Bandrolle.** OWNER, ADMIN,
    MEMBER und GUEST dürfen die eigenen persönlichen Song-Notizen
    pflegen. Das Schreiben erfordert eine Online-Verbindung. Offline
    sind persönliche Song-Notizen nur lesbar.

16. **Gemeinsames Bearbeiten.** Mehrere MEMBER und ADMIN dürfen denselben
    Song bearbeiten. Der Schutz vor gleichzeitigen Online-Änderungen ist
    eine spätere technische bzw. Architekturfrage, kein fachlicher
    Konflikt-Workflow dieses Modells.

17. **Band anlegen.** Jeder authentifizierte User darf eine Band anlegen.
    Dabei entsteht automatisch eine OWNER-Membership für den anlegenden
    User. Es gibt keine fachliche Obergrenze für die Zahl der Bands, die
    ein User anlegen darf.

18. **Aktive Membership durch Annahme.** Eine Einladung erzeugt keine
    aktive Membership. Die Membership wird erst aktiv, wenn ein
    authentifizierter User die Einladung annimmt. Die neue Membership
    hat stets die Rolle GUEST. Es gibt keine Rollenauswahl bei der
    Einladung. ADMIN entsteht nicht durch Einladung. OWNER entsteht
    nicht durch Einladung, sondern durch Anlegen der Band oder durch
    Ownership-Übertragung.

19. **Ausgänge einer Einladung.** Eine ausstehende Einladung endet durch
    Annahme, Ablehnung, Zurückziehen durch OWNER oder ADMIN oder durch
    Ablauf 14 Tage nach der Erzeugung. Die 14-tägige Lebensdauer ist
    eine feste Produktregel, nicht konfigurierbar und nicht
    verlängerbar. Nur die Annahme erzeugt eine Membership. Annahme und
    Ablehnung verbrauchen die Einladung; der Link kann danach nicht
    angenommen werden. Nach Ablehnung, Zurückziehen oder Ablauf dürfen
    OWNER oder ADMIN eine neue Einladung erzeugen; frühere solche
    Einladungen sind kein dauerhaftes Hindernis.

20. **Einmaliger Einladungslink.** Eine Einladung wird als einmaliger
    Link übermittelt. OWNER oder ADMIN erzeugen den Link und teilen ihn
    selbst; My Songbook versendet keine Einladungs-E-Mails. Der
    Einladende wählt keinen User aus. Derselbe Link gilt für bestehende
    und neue User; der Einladungskontext bleibt über Login oder
    Registrierung erhalten. Eine Band darf mehrere ausstehende
    Einladungen gleichzeitig haben. Für denselben User in derselben
    Band darf gleichzeitig höchstens eine ausstehende Einladung
    existieren. Ein User mit aktiver Membership in einer Band kann eine
    Einladung zu dieser Band nicht annehmen. Rollenänderungen
    bestehender Mitglieder erfolgen an der bestehenden Membership,
    nicht über Einladungen. Es gibt keine User-Suche und kein
    öffentliches User-Verzeichnis für Einladungen.

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

28. **Minimales strukturiertes Songmodell.** Ein Song hat derzeit als
    strukturierte Angaben nur Titel, Artist und ChordPro-Inhalt sowie
    Identität und Bandzugehörigkeit. Weitere strukturierte Metadaten
    wie Tonart, Capo, Tempo, Dauer, Genre, Tags oder Arrangement sind
    derzeit keine Produktanforderung. Soweit solche Informationen
    sinnvoll im ChordPro-Inhalt stehen können, bleiben sie dort.
    Zusätzliche strukturierte Metadaten dürfen später eingeführt
    werden, wenn ein konkreter Bedarf besteht.

29. **Kein gesondertes bandweites Anmerkungsobjekt.** Der geteilte
    Songinhalt ist der ChordPro-Inhalt. Es gibt derzeit keine
    BandSongNote oder vergleichbare Entity.

30. **Höchstens eine persönliche Notiz je User und Song.** Für jede
    Kombination aus User und Song gibt es höchstens eine persönliche
    Song-Notiz. Die Notiz darf beliebigen bzw. langen Text enthalten.
    Mehrere Notiz-Entities je User und Song sind nicht erforderlich.

31. **Song-Löschung ohne verwaiste Bezüge.** Wird ein Song gelöscht,
    werden alle persönlichen Notizen zu diesem Song gelöscht und alle
    Setlist-Einträge entfernt, die auf ihn verweisen. Die Setlists
    selbst bleiben. Es gibt keine Platzhalter-Einträge für gelöschte
    Songs. Die Löschung wird nicht allein deshalb verhindert, weil der
    Song in einer Setlist verwendet wird.

32. **Mehrfachvorkommen in der Setlist.** Derselbe Song darf in
    derselben Setlist mehrfach vorkommen. Eine Setlist ist eine
    geordnete Folge von Setlist-Einträgen; Eindeutigkeit der
    Song-Verweise ist nicht erforderlich.

33. **Anmeldung mit geringer Reibung.** Anmeldung muss sicher und mit
    geringer Reibung sein. Auf einem persönlichen Gerät bleibt der User
    in der Regel angemeldet und muss sich nicht bei jeder Nutzung erneut
    authentifizieren. Nach vorheriger Authentifizierung bleibt die
    Anwendung bei verfügbaren lokalen Daten in Probe und Auftritt offline
    nutzbar (Lesen und Nutzen, kein Bearbeiten). Das konkrete
    Anmeldeverfahren ist keine Domain-Entscheidung.

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
Der geteilte Songinhalt ist der ChordPro-Inhalt des Band-Songs. Es gibt
derzeit kein gesondertes Konzept für bandweite Song-Anmerkungen.
Persönliche Notizen bleiben privates Eigentum des Users.

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

Wird der Song gelöscht, werden alle persönlichen Song-Notizen, die sich
auf diesen Song beziehen, gelöscht. Es bleiben keine verwaisten Notizen.

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

- **User-Identität** — anwendungsweit, nicht band-spezifisch und nicht
  Eigentum einer Band; Memberships verweisen auf diese globale Identität
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

### 7.1 Offline dient Probe und Auftritt

Offline-Fähigkeit stellt sicher, dass My Songbook in Probe und Auftritt
nutzbar bleibt, wenn keine Netzverbindung besteht.

Offline ist ein Lese- und Nutzungsmodus, kein Bearbeitungsmodus. Er
sichert die Kontinuität von Probe und Auftritt. Er bietet keinen
vollständigen Offline-Bearbeitungsworkflow.

Wenn die benötigten Daten zuvor lokal verfügbar gemacht wurden, muss ein
authentifizierter User die Anwendung ohne Netzverbindung nutzen können.

Offline darf der User:

- lokal verfügbare Songs ansehen
- lokal verfügbare Setlists ansehen und nutzen
- zwischen Songs einer Setlist wechseln
- die eigenen lokal verfügbaren persönlichen Song-Notizen ansehen
- die Anwendung in Probe und Auftritt verwenden

Diese Vorgänge dürfen keine Netzverbindung erfordern.

Das setzt voraus, dass der User sich zuvor authentifiziert hat und die
benötigten lokalen Daten vorliegen. Eine unterbrochene Netzverbindung
darf diese Offline-Nutzung nicht verhindern. Wie Authentifizierung
technisch fortbesteht, ist nicht Teil dieses Modells.

### 7.2 Schreiben und Verwaltung erfordern Verbindung

Schreibende und administrative Vorgänge erfordern eine Online-Verbindung.

Offline darf der User nicht:

- Songs anlegen, bearbeiten oder löschen
- Setlists anlegen, bearbeiten, umordnen oder löschen
- persönliche Song-Notizen anlegen, bearbeiten oder löschen
- Memberships oder Rollen verwalten
- Einladungen anlegen oder verwalten
- sonstige Bandverwaltung vornehmen

Es gibt keine Offline-Änderungswarteschlange. Offline vorgenommene
Änderungen werden nicht gespeichert, um sie später nachzuspielen.
Es gibt keine fachliche Behandlung von Schreibkonflikten aus Offline-
Bearbeitung, weil Domain-Daten offline nicht verändert werden.

### 7.3 Folge für den Abgleich

Weil Domain-Daten offline nicht verändert werden, müssen beim
Wiederherstellen der Verbindung keine konkurrierenden Offline-Änderungen
zusammengeführt werden.

Nach Wiederherstellung der Verbindung werden lokale Daten mit dem
maßgeblichen Online-Stand aktualisiert. Damit kehren die lokal
verfügbaren, offline nur lesbaren Daten zum aktuellen maßgeblichen
Online-Stand zurück. Wann genau das geschieht und auf welchem
technischen Weg, ist nicht Teil dieses Modells.

Persönliche Song-Notizen gehören zum User und sind keine geteilten
Banddaten. Ein Aktualisieren persönlicher Notizen darf den Band-Song
anderer Mitglieder nicht verändern und die Notiz nicht automatisch für
andere sichtbar machen.

Songs verschiedener Bands bleiben verschiedene Objekte in verschiedenen
Mandanten. Ein Aktualisieren in Band A hat fachlich keine Auswirkung auf
Band B. Auch manuell nachgebildeter oder importierter Inhalt begründet
keine Synchronisationsbeziehung.

Der Schutz vor gleichzeitigen Online-Änderungen ist eine spätere
technische bzw. Architekturfrage. Dieses Modell legt dafür keinen
fachlichen Konflikt-Workflow fest.

### 7.4 Identität und Unabhängigkeit

Songs, Setlists, Memberships und persönliche Notizen brauchen eine
stabile eigene Identität innerhalb ihres Mandanten.

Ein Song gehört zu genau einer Band. Dieselbe Song-Identität darf nicht
in zwei Bands verwendet werden; das würde implizit eine
Synchronisationsbeziehung zwischen Mandanten erzeugen, die dieses Modell
ausschließt.

### 7.5 Bühne und unsichere Verbindung

Auf der Bühne zählt Verfügbarkeit vor Verwaltung. Fachlich heißt das:

- der benötigte Song und die benötigte Setlist müssen lokal vorliegen
- der Wechsel zwischen Songs einer Setlist muss ohne Netz funktionieren
- persönliche Notizen zum aktuellen Song müssen ohne Netz lesbar sein
- fehlende Netzverbindung darf den Auftritt nicht blockieren
- Bearbeiten und Verwalten erfordern eine Online-Verbindung und gehören
  nicht zur Offline-Nutzung auf der Bühne

---

## 8. Offene fachliche Fragen

Derzeit sind keine fachlichen Punkte als `OPEN QUESTION` markiert.

Spätere offene Punkte dürfen nicht aus der aktuellen Implementierung
oder aus technischen Nahelegungen abgeleitet werden.

Das Rollen- und Berechtigungsmodell der Membership sowie der Lebenszyklus
von Band, Membership, Einladung und Ownership-Übertragung sind in
Abschnitt 2.3 festgelegt und hier nicht erneut als offen geführt.
Jede angenommene Einladung erzeugt eine Membership mit der Rolle GUEST.
Eine Einladung wird als einmaliger Einladungslink übermittelt. OWNER
oder ADMIN teilen den Link selbst; My Songbook versendet keine
Einladungs-E-Mails. Der Einladende wählt keinen User aus. Derselbe Link
gilt für bestehende und neue User; der Einladungskontext bleibt über
Login oder Registrierung erhalten. Eine Einladung läuft 14 Tage nach
der Erzeugung ab. Annahme und Ablehnung verbrauchen die Einladung.
Für denselben User in derselben Band gibt es höchstens eine ausstehende
Einladung. Ein User mit aktiver Membership kann eine Einladung zu
dieser Band nicht annehmen. Es gibt keine User-Suche und kein
öffentliches User-Verzeichnis für Einladungen. Alle aktiven Mitglieder
dürfen die Mitgliederliste sehen.
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

Der Einladungsweg ist der einmalige Einladungslink. Automatischer
E-Mail-Versand, QR-Code-Einladungen, gesonderte Einladungscodes und
wiederverwendbare öffentliche Beitrittslinks sind derzeit nicht
erforderlich. Ein QR-Code darf später dieselbe Einladungs-URL
darstellen, wenn eine konkrete Produktanforderung entsteht.

Die Produktgrenze gegen die Verteilung von Songinhalt zwischen Bands
ist in Abschnitt 3.4 festgelegt. Es gibt keine offene Frage mehr zum
direkten Kopieren von Songs oder Setlists zwischen Bands, zur Herkunft
von Songinhalt oder zu automatisch gepflegten Beziehungen zwischen
Songs verschiedener Bands.

Ein Song hat derzeit als strukturierte Angaben Titel, Artist und
ChordPro-Inhalt. Der geteilte Songinhalt ist der ChordPro-Inhalt. Es
gibt derzeit keine BandSongNote oder vergleichbare bandweite
Anmerkungs-Entity. Zusätzliche strukturierte Metadaten sind derzeit
keine Produktanforderung und dürfen später eingeführt werden, wenn ein
konkreter Bedarf besteht.

Je User und Song gibt es höchstens eine persönliche Song-Notiz. Wird
ein Song gelöscht, werden alle persönlichen Notizen zu diesem Song
gelöscht und alle Setlist-Einträge entfernt, die auf ihn verweisen.
Die Setlists selbst bleiben.

Derselbe Song darf in derselben Setlist mehrfach vorkommen.

Die User-Identität ist anwendungsweit und nicht band-spezifisch. Dieselbe
Identität gilt für alle Bands und alle Memberships dieses Users. Ein User
braucht kein gesondertes Konto je Band. Rollen hängen ausschließlich an
Memberships. Es gibt keine band-spezifischen User-Identitäten.

Anmeldung muss sicher und mit geringer Reibung sein. Auf einem
persönlichen Gerät bleibt der User in der Regel angemeldet. Nach
vorheriger Authentifizierung und bei verfügbaren lokalen Daten bleibt
die Anwendung in Probe und Auftritt offline nutzbar (Lesen und Nutzen,
kein Bearbeiten). Das konkrete Anmeldeverfahren ist keine
Domain-Entscheidung und bleibt eine Architekturentscheidung. Die globale
Kontolöschung ist nicht Teil dieses Modells.

Offline-Fähigkeit dient Probe und Auftritt. Domain-Daten werden offline
nicht verändert. Es gibt keine Offline-Änderungswarteschlange und keine
fachliche Zusammenführung konkurrierender Offline-Änderungen. Nach
Wiederherstellung der Verbindung werden lokale Daten mit dem
maßgeblichen Online-Stand aktualisiert.

Die früheren Fragen zur Konflikteinheit und Konfliktauflösung nach
Offline-Bearbeitung entfallen deshalb. Der Schutz vor gleichzeitigen
Online-Änderungen ist eine spätere technische bzw. Architekturfrage und
hier nicht als offene Domain-Frage geführt.

Diese Liste ist der Ort für spätere Entscheidungen. Solange ein Punkt
als `OPEN QUESTION` markiert ist, darf er nicht als stillschweigend
beantwortet gelten.
