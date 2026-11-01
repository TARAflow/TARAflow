// ==================== REQUIREMENT TEXTS ====================
// What each IEC 62443-4-2 requirement is about — for the tooltip in the
// Compliance tab and the summary column of the report (D-27). Per stable
// RequirementId: the short title (the standard's identifier, as cited
// everywhere) and a SHORT SUMMARY IN OUR OWN WORDS, English and German.
//
// Licence rule (D-27): never the normative text — no "shall" sentences,
// rationale or acceptance criteria. TARAflow is public; the standard is
// licensed. The UI always adds "summary — the standard is authoritative".
// A test keeps every summary short.
//
// checklistDe: German versions of the type B checklists of the evidence
// rules (same order).

import type { RequirementId } from "../models/compliance-types";

export interface RequirementText {
  title: string;
  en: string;
  de: string;
  checklistDe?: readonly string[];
}

export const REQUIREMENT_TEXTS: Readonly<Record<RequirementId, RequirementText>> = {
  // ── FR 1 — Identification and authentication control ──────────────────
  "cr-1.1": {
    title: "Human user identification and authentication",
    en: "Every interface people can use identifies and authenticates them — by the component itself or a supporting system.",
    de: "Jede Schnittstelle, die Menschen nutzen, identifiziert und authentisiert sie — durch die Komponente selbst oder ein unterstützendes System.",
    checklistDe: ["jede externe Schnittstelle mit menschlichem Zugriff identifiziert und authentisiert den Benutzer"],
  },
  "cr-1.1-re1": {
    title: "Unique identification and authentication",
    en: "Each person has an identity of their own — no shared accounts.",
    de: "Jede Person hat eine eigene Identität — keine geteilten Konten.",
  },
  "cr-1.1-re2": {
    title: "Multifactor authentication for all interfaces",
    en: "People log in with more than one factor.",
    de: "Menschen melden sich mit mehr als einem Faktor an.",
  },
  "cr-1.2": {
    title: "Software process and device identification and authentication",
    en: "Other devices and software that connect are identified and authenticated, and the component authenticates itself towards them.",
    de: "Andere Geräte und Software, die sich verbinden, werden identifiziert und authentisiert, und die Komponente authentisiert sich ihnen gegenüber.",
  },
  "cr-1.2-re1": {
    title: "Unique identification and authentication",
    en: "Each device or process has an identity of its own.",
    de: "Jedes Gerät bzw. jeder Prozess hat eine eigene Identität.",
    checklistDe: ["jedes Gerät hat eine eigene Identität (kein gemeinsamer Schlüssel)"],
  },
  "cr-1.3": {
    title: "Account management",
    en: "Accounts can be created, changed and removed — locally or by a central system.",
    de: "Konten können angelegt, geändert und entfernt werden — lokal oder über ein zentrales System.",
  },
  "cr-1.4": {
    title: "Identifier management",
    en: "User and device identifiers are managed: unique and not reused.",
    de: "Benutzer- und Gerätekennungen werden verwaltet: eindeutig und nicht wiederverwendet.",
    checklistDe: ["Kennungen werden verwaltet (eindeutig, nicht wiederverwendet)"],
  },
  "cr-1.5": {
    title: "Authenticator management",
    en: "Passwords, keys and certificates can be set initially, changed and refreshed; defaults are noticed; authenticators are protected.",
    de: "Passwörter, Schlüssel und Zertifikate lassen sich erstmals setzen, ändern und erneuern; Standardwerte werden erkannt; Authentisierungsmerkmale sind geschützt.",
    checklistDe: [
      "erstmalige Authentisierungsmerkmale können vergeben werden",
      "unveränderte Standard-Authentisierungsmerkmale werden erkannt",
      "Authentisierungsmerkmale können geändert oder erneuert werden",
    ],
  },
  "cr-1.5-re1": {
    title: "Hardware security for authenticators",
    en: "Authenticators are kept in protected hardware (TPM, secure element, HSM).",
    de: "Authentisierungsmerkmale liegen in geschützter Hardware (TPM, Secure Element, HSM).",
  },
  "cr-1.6": {
    title: "Wireless access management",
    en: "Everyone who communicates wirelessly with the component is identified and authenticated.",
    de: "Wer drahtlos mit der Komponente kommuniziert, wird identifiziert und authentisiert.",
  },
  "cr-1.6-re1": {
    title: "Unique identification and authentication",
    en: "Each wireless participant has an identity of their own.",
    de: "Jeder drahtlose Teilnehmer hat eine eigene Identität.",
    checklistDe: ["jeder drahtlose Benutzer hat eine eigene Identität"],
  },
  "cr-1.7": {
    title: "Strength of password-based authentication",
    en: "Password rules are configurable and follow recognised guidelines.",
    de: "Passwortregeln sind konfigurierbar und folgen anerkannten Richtlinien.",
  },
  "cr-1.7-re1-human": {
    title: "Password generation and lifetime restrictions for human users",
    en: "Rules for re-using passwords and for their lifetime apply to people.",
    de: "Für Menschen gelten Regeln zur Wiederverwendung und Gültigkeitsdauer von Passwörtern.",
  },
  "cr-1.7-re2-all-users": {
    title: "Password lifetime restrictions for all users",
    en: "Minimum and maximum password lifetimes apply to every user.",
    de: "Für alle Benutzer gelten minimale und maximale Gültigkeitsdauern von Passwörtern.",
  },
  "cr-1.7-re2-machines": {
    title: "Password lifetime restrictions for software processes and devices",
    en: "Minimum and maximum password lifetimes apply to machine accounts.",
    de: "Für Maschinenkonten gelten minimale und maximale Gültigkeitsdauern von Passwörtern.",
  },
  "cr-1.8": {
    title: "Public key infrastructure certificates",
    en: "Where a PKI is used, it is operated according to common best practice.",
    de: "Wird eine PKI genutzt, wird sie nach gängiger Praxis betrieben.",
  },
  "cr-1.9": {
    title: "Strength of public key-based authentication",
    en: "Certificate-based authentication checks signatures, validity and possession of the private key.",
    de: "Zertifikatsbasierte Authentisierung prüft Signaturen, Gültigkeit und den Besitz des privaten Schlüssels.",
    checklistDe: ["Signaturen und Zertifikatsdaten werden geprüft", "Nachweis des Besitzes des privaten Schlüssels"],
  },
  "cr-1.9-re1": {
    title: "Hardware security for public key-based authentication",
    en: "Long-lived private keys are kept in protected hardware.",
    de: "Langlebige private Schlüssel liegen in geschützter Hardware.",
  },
  "cr-1.10": {
    title: "Authenticator feedback",
    en: "Entered passwords or PINs are not shown in clear.",
    de: "Eingegebene Passwörter oder PINs werden nicht im Klartext angezeigt.",
  },
  "cr-1.11": {
    title: "Unsuccessful login attempts",
    en: "After a number of failed logins, access is blocked for a while or until an administrator unlocks it.",
    de: "Nach mehreren Fehlversuchen wird der Zugang für eine Zeit oder bis zur Freigabe durch einen Administrator gesperrt.",
  },
  "cr-1.12": {
    title: "System use notification",
    en: "A configurable notice is shown before a person logs in locally.",
    de: "Vor der lokalen Anmeldung wird ein konfigurierbarer Hinweis angezeigt.",
  },
  "cr-1.13": {
    title: "Access via untrusted networks",
    en: "Access from untrusted networks (remote access, internet) is monitored and controlled.",
    de: "Zugriffe aus nicht vertrauenswürdigen Netzen (Fernzugriff, Internet) werden überwacht und kontrolliert.",
    checklistDe: ["alle Zugriffswege über nicht vertrauenswürdige Netze werden überwacht und kontrolliert"],
  },
  "cr-1.13-re1": {
    title: "Explicit access request approval",
    en: "Access from untrusted networks needs the approval of an assigned role.",
    de: "Zugriffe aus nicht vertrauenswürdigen Netzen brauchen die Freigabe einer zuständigen Rolle.",
  },
  "cr-1.14": {
    title: "Strength of symmetric key-based authentication",
    en: "Shared-secret authentication establishes mutual trust, keeps the secret protected and uses strong algorithms.",
    de: "Authentisierung mit gemeinsamem Geheimnis stellt gegenseitiges Vertrauen her, schützt das Geheimnis und nutzt starke Algorithmen.",
    checklistDe: [
      "gegenseitiges Vertrauen über den symmetrischen Schlüssel",
      "der Zugriff auf das gemeinsame Geheimnis ist eingeschränkt",
      "Algorithmus und Schlüssellänge nach anerkannter Praxis",
    ],
  },
  "cr-1.14-re1": {
    title: "Hardware security for symmetric key-based authentication",
    en: "Long-lived shared secrets are kept in protected hardware.",
    de: "Langlebige gemeinsame Geheimnisse liegen in geschützter Hardware.",
  },

  // ── FR 2 — Use control ────────────────────────────────────────────────
  "cr-2.1": {
    title: "Authorization enforcement",
    en: "Authenticated users can only do what their role allows.",
    de: "Authentisierte Benutzer dürfen nur, was ihre Rolle erlaubt.",
  },
  "cr-2.1-re1": {
    title: "Authorization enforcement for all users",
    en: "Authorization with least privilege applies to people, software and devices.",
    de: "Autorisierung nach dem Prinzip der geringsten Rechte gilt für Menschen, Software und Geräte.",
    checklistDe: ["Autorisierung für alle Benutzer inkl. Software-Prozesse und Geräte, geringste Rechte"],
  },
  "cr-2.1-re2": {
    title: "Permission mapping to roles",
    en: "An authorized role can define which permissions each role has.",
    de: "Eine berechtigte Rolle kann festlegen, welche Rechte jede Rolle hat.",
  },
  "cr-2.1-re3": {
    title: "Supervisor override",
    en: "A supervisor can override controls for a limited time.",
    de: "Ein Vorgesetzter kann Kontrollen für eine begrenzte Zeit übersteuern.",
  },
  "cr-2.1-re4": {
    title: "Dual approval",
    en: "Actions with serious impact need a second person's approval.",
    de: "Aktionen mit schwerwiegenden Folgen brauchen die Freigabe einer zweiten Person.",
  },
  "cr-2.2": {
    title: "Wireless use control",
    en: "Use of wireless connections is authorized, monitored and restricted.",
    de: "Die Nutzung drahtloser Verbindungen wird autorisiert, überwacht und eingeschränkt.",
    checklistDe: ["drahtlose Nutzung wird autorisiert, überwacht und eingeschränkt"],
  },
  "cr-2.4": {
    title: "Mobile code",
    en: "Where mobile code (scripts, plug-ins) is used, a policy controls what may run and who may load it.",
    de: "Wird Mobile Code (Skripte, Plug-ins) genutzt, regelt eine Richtlinie, was laufen darf und wer ihn laden darf.",
  },
  "cr-2.4-re1": {
    title: "Mobile code authenticity check",
    en: "Mobile code runs only after its authenticity was checked.",
    de: "Mobile Code läuft erst nach geprüfter Echtheit.",
  },
  "cr-2.5": {
    title: "Session lock",
    en: "A session locks after inactivity or on request, until the user authenticates again.",
    de: "Eine Sitzung sperrt nach Inaktivität oder auf Wunsch, bis sich der Benutzer erneut authentisiert.",
  },
  "cr-2.6": {
    title: "Remote session termination",
    en: "Remote sessions end after inactivity or can be ended by an authorized user.",
    de: "Fernsitzungen enden nach Inaktivität oder können von einem Berechtigten beendet werden.",
  },
  "cr-2.7": {
    title: "Concurrent session control",
    en: "The number of simultaneous sessions per user and interface can be limited.",
    de: "Die Zahl gleichzeitiger Sitzungen pro Benutzer und Schnittstelle lässt sich begrenzen.",
  },
  "cr-2.8": {
    title: "Auditable events",
    en: "Security-relevant events are recorded: logins, account changes, data access, configuration changes and more.",
    de: "Sicherheitsrelevante Ereignisse werden protokolliert: Anmeldungen, Kontoänderungen, Datenzugriffe, Konfigurationsänderungen und mehr.",
    checklistDe: [
      "alle Kategorien sicherheitsrelevanter Ereignisse werden protokolliert (Authentisierung, Kontoänderungen, Datenzugriffe, Wechselmedien, unberechtigter Zugriff, Konfiguration)",
    ],
  },
  "cr-2.8-re1": {
    title: "Opt-out mechanism for authorized users",
    en: "An authorized user can switch off security logging, fully or in parts.",
    de: "Ein Berechtigter kann die Sicherheitsprotokollierung ganz oder teilweise abschalten.",
  },
  "cr-2.9": {
    title: "Audit storage capacity",
    en: "Enough log storage is reserved, and a full log does not stop essential functions.",
    de: "Es ist genug Protokollspeicher reserviert, und ein volles Protokoll stoppt keine wesentlichen Funktionen.",
  },
  "cr-2.9-re1": {
    title: "Warn when audit record storage capacity threshold reached",
    en: "A warning is raised when the log storage reaches a set threshold.",
    de: "Beim Erreichen einer eingestellten Schwelle des Protokollspeichers wird gewarnt.",
  },
  "cr-2.10": {
    title: "Response to audit processing failures",
    en: "Logging failures do not stop essential functions and lead to a defined reaction.",
    de: "Fehler der Protokollierung stoppen keine wesentlichen Funktionen und führen zu einer festgelegten Reaktion.",
  },
  "cr-2.11": {
    title: "Timestamps",
    en: "Log entries carry date and time.",
    de: "Protokolleinträge tragen Datum und Uhrzeit.",
  },
  "cr-2.11-re1": {
    title: "Time synchronization",
    en: "The clock is synchronised with an external time source.",
    de: "Die Uhr wird mit einer externen Zeitquelle synchronisiert.",
  },
  "cr-2.11-re2": {
    title: "Protection of time source integrity",
    en: "Tampering with the time source is detected and logged.",
    de: "Manipulationen der Zeitquelle werden erkannt und protokolliert.",
  },
  "cr-2.12": {
    title: "Non-repudiation",
    en: "It can be shown which person performed an action.",
    de: "Es lässt sich nachweisen, welche Person eine Aktion ausgeführt hat.",
  },
  "cr-2.12-re1": {
    title: "Non-repudiation for all users",
    en: "This also holds for software processes and devices.",
    de: "Das gilt auch für Software-Prozesse und Geräte.",
  },
  "cr-2.13": {
    title: "Use of physical diagnostic and test interfaces",
    en: "Factory debug and test interfaces (e.g. JTAG) are protected against unauthorized use.",
    de: "Werkseitige Debug- und Testschnittstellen (z. B. JTAG) sind gegen unberechtigte Nutzung geschützt.",
  },
  "cr-2.13-re1": {
    title: "Active monitoring",
    en: "Access attempts on debug interfaces are detected and logged.",
    de: "Zugriffsversuche auf Debug-Schnittstellen werden erkannt und protokolliert.",
  },

  // ── FR 3 — System integrity ───────────────────────────────────────────
  "cr-3.1": {
    title: "Communication integrity",
    en: "Transmitted data is protected against undetected change.",
    de: "Übertragene Daten sind gegen unbemerkte Veränderung geschützt.",
  },
  "cr-3.1-re1": {
    title: "Communication authentication",
    en: "The origin of received data is verified.",
    de: "Die Herkunft empfangener Daten wird geprüft.",
  },
  "cr-3.2": {
    title: "Protection from malicious code",
    en: "Installing or running malicious code is prevented and detected — directly or by supporting measures.",
    de: "Installation oder Ausführung von Schadcode wird verhindert und erkannt — direkt oder durch unterstützende Massnahmen.",
  },
  "cr-3.2-re1": {
    title: "Report version of code protection",
    en: "Mechanisms detect and prevent the installation of malicious code.",
    de: "Mechanismen erkennen und verhindern die Installation von Schadcode.",
    checklistDe: ["die Installation von Schadcode wird erkannt und verhindert"],
  },
  "sar-3.2-qualify": {
    title: "Protection from malicious code (software application)",
    en: "The supplier names which anti-malware products work with the application and how to configure them.",
    de: "Der Hersteller nennt, welche Schutzprodukte gegen Schadcode mit der Anwendung funktionieren und wie sie zu konfigurieren sind.",
  },
  "edr-3.2-unauthorized-software": {
    title: "Protection from malicious code (embedded device)",
    en: "The device runs only authorized software.",
    de: "Das Gerät führt nur autorisierte Software aus.",
  },
  "hdr-3.2-re1-report-version": {
    title: "Report version of code protection (host device)",
    en: "The host reports which version of its malware protection is in use.",
    de: "Der Host meldet, welche Version seines Schadcode-Schutzes im Einsatz ist.",
  },
  "cr-3.3": {
    title: "Security functionality verification",
    en: "The security functions can be checked for correct operation.",
    de: "Die Sicherheitsfunktionen lassen sich auf korrekte Funktion prüfen.",
  },
  "cr-3.3-re1": {
    title: "Security functionality verification during normal operation",
    en: "These checks are possible during normal operation.",
    de: "Diese Prüfungen sind auch im Normalbetrieb möglich.",
  },
  "cr-3.4": {
    title: "Software and information integrity",
    en: "Software and configuration are checked for integrity; the results are recorded and reported.",
    de: "Software und Konfiguration werden auf Integrität geprüft; die Ergebnisse werden festgehalten und gemeldet.",
    checklistDe: ["die Ergebnisse der Integritätsprüfungen werden festgehalten und gemeldet"],
  },
  "cr-3.4-re1": {
    title: "Authenticity of software and information",
    en: "Software and configuration are also checked for authenticity.",
    de: "Software und Konfiguration werden zusätzlich auf Echtheit geprüft.",
  },
  "cr-3.4-re2": {
    title: "Automated notification of integrity violations",
    en: "An unauthorized change attempt is reported automatically.",
    de: "Ein unberechtigter Änderungsversuch wird automatisch gemeldet.",
  },
  "cr-3.5": {
    title: "Input validation",
    en: "Security-relevant input from external interfaces is validated.",
    de: "Sicherheitsrelevante Eingaben über externe Schnittstellen werden geprüft.",
  },
  "cr-3.6": {
    title: "Deterministic output",
    en: "Outputs go to a defined state when normal operation cannot be kept under attack.",
    de: "Ausgänge gehen in einen definierten Zustand, wenn der Normalbetrieb unter Angriff nicht zu halten ist.",
  },
  "cr-3.7": {
    title: "Error handling",
    en: "Errors are handled without giving attackers useful information.",
    de: "Fehler werden behandelt, ohne Angreifern nützliche Informationen zu liefern.",
  },
  "cr-3.8": {
    title: "Session integrity",
    en: "Session IDs are random and unique and become invalid at logout.",
    de: "Sitzungskennungen sind zufällig und eindeutig und werden beim Abmelden ungültig.",
  },
  "cr-3.9": {
    title: "Protection of audit information",
    en: "Log records are protected against unauthorized reading, change and deletion.",
    de: "Protokolldaten sind gegen unberechtigtes Lesen, Ändern und Löschen geschützt.",
    checklistDe: ["die Protokolldaten sind gegen unberechtigten Zugriff, Änderung und Löschung geschützt"],
  },
  "cr-3.9-re1": {
    title: "Audit records on write-once media",
    en: "Logs can be stored on hardware write-once media.",
    de: "Protokolle lassen sich auf hardwareseitig nur einmal beschreibbaren Medien speichern.",
  },
  "cr-3.10": {
    title: "Support for updates",
    en: "The component can be updated and upgraded.",
    de: "Die Komponente lässt sich aktualisieren und aufrüsten.",
  },
  "cr-3.10-re1": {
    title: "Update authenticity and integrity",
    en: "Updates are checked for authenticity and integrity before installation.",
    de: "Updates werden vor der Installation auf Echtheit und Integrität geprüft.",
  },
  "cr-3.10-re2": {
    title: "Automatic updates",
    en: "Updates can be loaded automatically, announced or scheduled; a fallback to the previous version is recommended.",
    de: "Updates können automatisch geladen, angekündigt oder geplant werden; ein Rückfall auf die vorige Version wird empfohlen.",
    checklistDe: ["automatisches Laden, Benachrichtigung oder geplantes Aktualisieren", "Rückfall auf eine frühere Version bei Fehler (empfohlen)"],
  },
  "cr-3.11": {
    title: "Physical tamper resistance and detection",
    en: "The inside of the device is protected against and monitored for physical tampering.",
    de: "Das Innere des Geräts ist gegen physische Manipulation geschützt und überwacht.",
  },
  "cr-3.11-re1": {
    title: "Notification of a tampering attempt",
    en: "A tampering attempt is reported.",
    de: "Ein Manipulationsversuch wird gemeldet.",
  },
  "cr-3.12": {
    title: "Provisioning product supplier roots of trust",
    en: "The supplier's trust anchors (keys, data) are provisioned at manufacture and protected.",
    de: "Die Vertrauensanker des Herstellers (Schlüssel, Daten) werden bei der Herstellung eingebracht und geschützt.",
    checklistDe: ["die Vertrauensanker des Herstellers werden bei der Herstellung eingebracht und geschützt"],
  },
  "cr-3.13": {
    title: "Provisioning asset owner roots of trust",
    en: "The operator can provision and protect own trust anchors, without depending on systems outside the zone.",
    de: "Der Betreiber kann eigene Vertrauensanker einbringen und schützen, ohne von Systemen ausserhalb der Zone abzuhängen.",
  },
  "cr-3.14": {
    title: "Integrity of the boot process",
    en: "Firmware, software and configuration are checked for integrity before they are used at boot.",
    de: "Firmware, Software und Konfiguration werden vor der Verwendung beim Start auf Integrität geprüft.",
  },
  "cr-3.14-re1": {
    title: "Authenticity of the boot process",
    en: "The boot also checks authenticity with the supplier's trust anchor.",
    de: "Der Start prüft zusätzlich die Echtheit mit dem Vertrauensanker des Herstellers.",
    checklistDe: ["der Start prüft die Echtheit mit dem Vertrauensanker des Herstellers, nicht nur die Integrität"],
  },

  // ── FR 4 — Data confidentiality ───────────────────────────────────────
  "cr-4.1-transit": {
    title: "Information confidentiality",
    en: "Sensitive data sent over external interfaces is kept confidential.",
    de: "Sensible Daten, die über externe Schnittstellen gehen, bleiben vertraulich.",
  },
  "cr-4.1-rest": {
    title: "Confidentiality of information at rest",
    en: "Sensitive data stored or processed in the component is kept confidential.",
    de: "Sensible Daten, die in der Komponente gespeichert oder verarbeitet werden, bleiben vertraulich.",
  },
  "cr-4.2": {
    title: "Information persistence",
    en: "Sensitive data in non-volatile memory can be erased reliably (e.g. before decommissioning).",
    de: "Sensible Daten im nichtflüchtigen Speicher lassen sich zuverlässig löschen (z. B. vor der Ausserbetriebnahme).",
  },
  "cr-4.2-re1": {
    title: "Erase of shared memory resources",
    en: "Sensitive data in volatile memory is erased as well.",
    de: "Auch sensible Daten im flüchtigen Speicher werden gelöscht.",
  },
  "cr-4.2-re2": {
    title: "Erase verification",
    en: "It can be verified that the erasure happened.",
    de: "Es lässt sich prüfen, dass das Löschen stattgefunden hat.",
  },
  "cr-4.3": {
    title: "Use of cryptography",
    en: "Cryptography follows recognised practice (algorithms, key lengths).",
    de: "Kryptografie folgt anerkannter Praxis (Algorithmen, Schlüssellängen).",
  },

  // ── FR 5 — Restricted data flow ───────────────────────────────────────
  "cr-5.1": {
    title: "Network segmentation",
    en: "The component supports segmented networks; there are no undocumented connections between networks.",
    de: "Die Komponente unterstützt segmentierte Netze; es gibt keine undokumentierten Verbindungen zwischen Netzen.",
    checklistDe: ["keine unbeabsichtigten oder undokumentierten Verbindungen zwischen Netzen"],
  },
  "cr-5.2": {
    title: "Zone boundary protection",
    en: "A component at a zone boundary monitors and controls the traffic across it.",
    de: "Eine Komponente an einer Zonengrenze überwacht und kontrolliert den Verkehr über die Grenze.",
  },
  "cr-5.2-re1": {
    title: "Deny all, permit by exception",
    en: "Traffic is blocked unless explicitly allowed.",
    de: "Verkehr ist gesperrt, solange er nicht ausdrücklich erlaubt ist.",
  },
  "cr-5.2-re2": {
    title: "Island mode",
    en: "All traffic across the boundary can be cut off.",
    de: "Der gesamte Verkehr über die Grenze lässt sich abschalten.",
  },
  "cr-5.2-re3": {
    title: "Fail close",
    en: "If the boundary protection fails, traffic is blocked.",
    de: "Fällt der Grenzschutz aus, wird der Verkehr gesperrt.",
  },
  "ndr-5.3": {
    title: "General purpose person-to-person communication restrictions",
    en: "Messages such as e-mail or chat from outside are blocked at the zone boundary.",
    de: "Nachrichten wie E-Mail oder Chat von aussen werden an der Zonengrenze blockiert.",
  },

  // ── FR 6 — Timely response to events ──────────────────────────────────
  "cr-6.1": {
    title: "Audit log accessibility",
    en: "Authorized people and tools can read the logs (read-only).",
    de: "Berechtigte Personen und Werkzeuge können die Protokolle lesen (nur lesend).",
  },
  "cr-6.1-re1": {
    title: "Programmatic access to audit logs",
    en: "Logs are available through an API or are forwarded to an external system.",
    de: "Protokolle sind über eine Schnittstelle abrufbar oder werden an ein externes System weitergeleitet.",
    checklistDe: ["Protokolldaten sind über eine API erreichbar oder werden an ein externes System weitergeleitet"],
  },
  "cr-6.2": {
    title: "Continuous monitoring",
    en: "Detected security issues are reported for continuous monitoring.",
    de: "Erkannte Sicherheitsprobleme werden für eine kontinuierliche Überwachung gemeldet.",
    checklistDe: ["erkannte Sicherheitsprobleme werden für die kontinuierliche Überwachung gemeldet"],
  },

  // ── FR 7 — Resource availability ──────────────────────────────────────
  "cr-7.1": {
    title: "Denial of service protection",
    en: "Essential functions keep working in a degraded mode during a denial-of-service event.",
    de: "Wesentliche Funktionen laufen bei einem Denial-of-Service-Ereignis eingeschränkt weiter.",
    checklistDe: ["wesentliche Funktionen laufen bei einem DoS-Ereignis eingeschränkt weiter"],
  },
  "cr-7.1-re1": {
    title: "Manage communication load from component",
    en: "Flooding with messages is limited (e.g. rate limiting).",
    de: "Überflutung mit Nachrichten wird begrenzt (z. B. Rate Limiting).",
  },
  "cr-7.2": {
    title: "Resource management",
    en: "Security functions cannot exhaust the component's resources.",
    de: "Sicherheitsfunktionen können die Ressourcen der Komponente nicht erschöpfen.",
  },
  "cr-7.3": {
    title: "Control system backup",
    en: "A backup is possible — directly or by a supporting system — without disturbing operation.",
    de: "Eine Sicherung ist möglich — direkt oder über ein unterstützendes System — ohne den Betrieb zu stören.",
  },
  "cr-7.3-re1": {
    title: "Backup integrity verification",
    en: "A backup is checked for integrity before it is restored.",
    de: "Eine Sicherung wird vor dem Zurückspielen auf Integrität geprüft.",
  },
  "cr-7.4": {
    title: "Control system recovery and reconstitution",
    en: "After a disruption the component can be brought back to a known secure state.",
    de: "Nach einer Störung lässt sich die Komponente in einen bekannten sicheren Zustand zurückversetzen.",
    checklistDe: ["die Komponente kehrt nach Störung oder Ausfall in einen bekannten sicheren Zustand zurück"],
  },
  "cr-7.6": {
    title: "Network and security configuration settings",
    en: "The component can be set to secure default settings, and the current settings can be read.",
    de: "Die Komponente lässt sich auf sichere Standardeinstellungen setzen, und die aktuellen Einstellungen sind abrufbar.",
  },
  "cr-7.6-re1": {
    title: "Machine-readable reporting of current security settings",
    en: "The current security settings can be exported in a machine-readable form.",
    de: "Die aktuellen Sicherheitseinstellungen lassen sich maschinenlesbar ausgeben.",
  },
  "cr-7.7": {
    title: "Least functionality",
    en: "Unneeded interfaces, ports, protocols and services can be disabled.",
    de: "Nicht benötigte Schnittstellen, Ports, Protokolle und Dienste lassen sich abschalten.",
    checklistDe: ["jede Schnittstelle, jeder Port, jedes Protokoll und jeder Dienst, der für den Einsatzzweck nicht nötig ist, ist eingeschränkt"],
  },
  "cr-7.8": {
    title: "Control system component inventory",
    en: "The component provides its identity and versions for an inventory.",
    de: "Die Komponente liefert ihre Identität und Versionen für ein Inventar.",
  },
  "cr-7.9": {
    title: "Component reset",
    en: "The component can be reset to a state defined by the supplier.",
    de: "Die Komponente lässt sich auf einen vom Hersteller festgelegten Zustand zurücksetzen.",
    checklistDe: ["die Komponente lässt sich auf den vom Hersteller festgelegten Zustand zurücksetzen"],
  },
};
