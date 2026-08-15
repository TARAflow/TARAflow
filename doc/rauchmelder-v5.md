# TARAflow Referenzbeispiel
## Sigrist Rauchmelder — Industrieller Brandmelder v5

*Vollständige TARAflow-Projektdokumentation*

> Dieses Dokument enthält alle Elemente, Assets, Beziehungen und Bewertungen
> zur direkten Eingabe in TARAflow.
> **v3 — ergänzt um fehlende technische Kommunikationspfade, Prozessumbenennungen
> und optionale Prozesse gemäss Threat-Model Review (sigrist_rauchmelder_threat_model_review_final)**

---

## 1  Systembeschreibung

Der Sigrist Rauchmelder ist ein industrieller Brandmelder auf Basis optischer
Streulichtmessung. Er erkennt Rauchpartikel durch Vorwärts- und Seitenstreuung
eines LED-Lichtstrahls, verarbeitet die Messung lokal und übermittelt
Alarmsignale an eine Brandmeldezentrale via RS485. Konfiguration und
Firmware-Updates erfolgen via WLAN.

**Sicherheitskritische Besonderheit:** Availability und Integrity der
Rauchdetektionsfunktion sind Safety-kritisch — ein ausbleibender Alarm bei
Rauchentwicklung gefährdet Menschenleben.

---

## 2  Grenzen (Boundaries)

### 2.1  Physical Boundary *(neu)*

**PB-1 — Gerätegehäuse (IP67)**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | device_enclosure | Werkzeugzugang zum Öffnen erforderlich |
| physicalExposureLevel | PEL2 | Eine Barriere (Gehäuse + Schrauben) |
| physicalMobility | fixed | Wandmontage, fest installiert |
| accessibility | controlled | In Gebäude installiert — Zutritt eingeschränkt |
| physicalAccessControl | none | Kein Schloss am Gerät selbst |
| tamperProtection | none | ⚠ IP67 ist kein Tamper-Schutz — keine Öffnungsspuren |
| monitoringType | none | ⚠ Kein Kamera/Alarm am Gerät → Repudiation-Threat |
| debugInterfaceAccessible | false | Debug nur nach Gehäuseöffnung zugänglich |
| removableMediaAccessible | false | Kein USB/SD von aussen |
| safetyRelevant | true | ⚠ Safety-kritisches Gerät — physischer Zugang = Safety-Risiko |

> **Gap:** Ohne PhysicalBoundary fehlen alle T-PB-*, E-PB-*, R-PB-* Threats im TARA.
> Das physische Angriffsszenario „Gehäuse öffnen → Debug anschliessen → Firmware lesen"
> ist ohne PB nicht modellierbar.

---

### 2.2  Trust Boundaries

> **v5 — vereinfachte TB-Struktur:** TB-1 und TB-2 umschliessen je eine MCU-Zone vollständig.
> TB-3 (WLAN), TB-4 (Debug) und der frühere SPI-Crossing-TB wurden entfernt.
>
> **Begründung:**
> - Die Trust-Grenze zwischen CB-1 und CB-2 ist durch die zwei separaten ChipBoundaries modelliert — ein zusätzlicher TB-Streifen an der SPI-Grenze bringt keinen Threat-Modelling-Gewinn.
> - Debug-Interfaces (IF-5, IF-6) liegen innerhalb ihrer jeweiligen MCU-Zone — TB-4 würde sie geometrisch herausreissen. Debug-Schutz wird über `operationalState` und `debugProtection` auf den Interface-Properties modelliert.
> - WLAN-Perimeter ist durch PB-1 + externe Positionierung von EE-2/EE-3 + IF-3 ausreichend modelliert.

| ID | Name | Umfang |
|----|------|--------|
| TB-1 | Sensor MCU Zone | CB-1 komplett: P-1, P-2, P-10, P-11, DS-1, DS-2, IF-5 |
| TB-2 | Controller MCU Zone | CB-2 komplett: P-3..P-9, DS-3..DS-5, IF-4, IF-6 |

**TB-1 — Sensor MCU Zone**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | peripheral | Hardware-Chip-Grenze |
| defaultExposureLevel | EL1 | Physischer Zugang erfordert Gehäuseöffnung |
| boundaryControlTypes | [] | ⚠ Keine Protokoll-Auth auf SPI — Trust basiert auf physischer Isolation |
| monitoringEnabled | false | Empfehlung: SPI-Verbindungsabbruch-Alarm implementieren |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | Safety-kritische Zone: Kalibrierparameter und Messwerte |

**TB-2 — Controller MCU Zone**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | peripheral | Hardware-Chip-Grenze |
| defaultExposureLevel | EL1 | Physischer Zugang erfordert Gehäuseöffnung |
| boundaryControlTypes | ["authentication_gateway"] | WPA2/WPA3 für WLAN-Zugang; RS485 ohne Auth (Gap) |
| monitoringEnabled | false | Empfehlung: Verbindungsabbruch-Alarm auf RS485 und WLAN |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | Alarmlogik, Firmware-Update, Auth — höchste Kritikalität |

---

### 2.3  Chip Boundaries

**CB-1 — Sensor MCU (internes Optical Engine)**

| Property | Wert | Hinweis |
|----------|------|---------|
| chipType | mcu | |
| defaultExposureLevel | EL1 | |
| secureBootEnabled | unbekannt | ⚠ Kritisch für CRA — klären ob implementiert |
| debugInterfaceLocked | unbekannt | ⚠ In Produktion muss Debug gesperrt sein |
| firmwareProtection | unbekannt | Empfehlung: rdp_level1 |
| tamperProtection | basic | IP67-Gehäuse, Kunststoffgehäuse |
| supplyChainTrust | verified (angenommen) | |
| authenticatorStorage | software_only | ⚠ Keys im Flash — kein Secure Element vorhanden |
| cryptoStandard | not_assessed | ⚠ Welche Algorithmen? AES-128? SHA-256? Klären |

**CB-2 — Controller MCU (Alarm & Communication)**

| Property | Wert | Hinweis |
|----------|------|---------|
| chipType | mcu | |
| defaultExposureLevel | EL1 | |
| secureBootEnabled | unbekannt | ⚠ Kritisch für CRA — klären ob implementiert |
| debugInterfaceLocked | unbekannt | ⚠ In Produktion muss Debug gesperrt sein |
| firmwareProtection | unbekannt | Empfehlung: rdp_level2 |
| tamperProtection | basic | IP67-Gehäuse, Kunststoffgehäuse |
| supplyChainTrust | verified (angenommen) | |
| authenticatorStorage | software_only | ⚠ TLS-Key, Code-Signing-Key wo gespeichert? |
| cryptoStandard | not_assessed | ⚠ CRA §1(3) RE1 — Algorithmen-Inventar erforderlich |
| updateMechanism | signed_ota | SOLL: signierte OTA-Updates. IST: unbekannt |
| backupMechanism | none | ⚠ Nach Config-Wipe kein automatisches Recovery |

---

## 3  Externe Entitäten

**EE-1 — Brandmeldezentrale (Fire Control Panel)**

| Property | Wert | Hinweis |
|----------|------|---------|
| entityType | service | Automatisiertes System im Gebäude-Brandmeldenetz |
| trustLevel | medium | Im OT-Netz als vertrauenswürdig angenommen |
| authenticationMethod | none | ⚠ RS485/Standard-Brandmeldeprotokoll ohne Auth |
| ownership | external | Gebäudebetreiber — nicht Sigrist-kontrolliert |
| threatProfile.category | adjacent_wireless | Lokales Brandmeldenetz — physische Nähe erforderlich |
| threatProfile.baseFeasibility | low | Zugang zum Brandmeldenetz erfordert physischen Zutritt |

**EE-2 — Wartungstechniker**

| Property | Wert | Hinweis |
|----------|------|---------|
| entityType | contractor | Sigrist-Techniker oder autorisierter Servicepartner |
| trustLevel | medium | Auth erforderlich. Shared Credentials riskant |
| authenticationMethod | password | Passwortschutz via WLAN/App. MFA nicht erwähnt |
| ownership | external | Wartungsdienstleister |
| threatProfile.category | adjacent_wireless | WLAN-Zugang erfordert physische Nähe (<50m) |
| threatProfile.baseFeasibility | low | Physische Nähe + Auth erforderlich |

**EE-3 — Sigrist Update Server**

| Property | Wert | Hinweis |
|----------|------|---------|
| entityType | service | Sigrist-Backend für Firmware-Updates |
| trustLevel | high | Vertrauenswürdiger Hersteller. Supply-Chain-Angriff möglich |
| authenticationMethod | certificate (angenommen) | TLS + Code-Signing (sollte so sein) |
| ownership | external | Sigrist AG — technisch extern |
| threatProfile.category | supply_chain | Hoher Aufwand, aber hohe Wirkung (alle Geräte betroffen) |
| threatProfile.baseFeasibility | very_low | Sehr hoher Aufwand für Angreifer |

---

## 4  Prozesse

### 4.1  Sensor MCU (CB-1)

**P-1 — Optical Detection Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | bare_metal | LED-Ansteuerung, ADC-Auslese, Streulichtalgorithmus |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | high | Erzeugt primäre sicherheitskritische Messwerte |
| authenticationRequired | no | Interne Funktion, kein externer Zugriff |
| inputValidation | basic | ADC-Bereichsvalidierung empfohlen |
| securityControls | Selbsttest beim Start | |
| failSafeOutputState | not_defined | ⚠ CR 3.6: Bei SPI-Ausfall was passiert mit Output? Klären |
| malwareProtection | none | Bare-Metal, kein AV möglich — explizit dokumentiert |
| nonRepudiation | none | Interne Funktion, kein Audit-Bedarf |

**P-2 — Sensor Diagnostic Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | bare_metal | Interne Temperatur- und Feuchteüberwachung, LED-Alterungskontrolle |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | medium | |
| authenticationRequired | no | |
| inputValidation | basic | |
| securityControls | Feuchte/Temp-Monitoring | Manipulation könnte Fehlerzustand verbergen |
| failSafeOutputState | not_defined | Bei Diagnoseausfall: weiter messen oder Alarm? |
| malwareProtection | none | Bare-Metal |
| nonRepudiation | none | |

### 4.2  Controller MCU (CB-2)

**P-3 — Alarm Processing Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | rtos_task | Alarm-Entscheidungslogik: Messwert vs. Schwellwert, Verzögerungslogik |
| processSemantic | security_boundary | ⚠ Safety-kritischer Prozess — Alarmauslösung ist Safety-Funktion |
| runsAs | system | |
| privilegeLevel | high | Steuert Alarm-Relay direkt (via IF-4) |
| authenticationRequired | no | Intern. Schwellwerte kommen via P-6 (nach Auth) |
| inputValidation | strict | Messwerte: Bereichsvalidierung. Schwellwerte: Plausibilitätsprüfung |
| securityControls | Watchdog-Timer, Fail-Safe: Alarm bei Ausfall | |
| failSafeOutputState | fixed_value | ⚠ CR 3.6 PFLICHT: Alarm=false bei Ausfall (kein Fehlalarm) ODER Alarm=true (fail-safe). Beide haben Safety-Implikationen — explizit entscheiden |
| malwareProtection | code_signing | SOLL: nur signierte Firmware ausführen (via Secure Boot CB-2) |
| nonRepudiation | none | ⚠ A-9 hat N=critical — Audit-Log für Alarmauslösung fehlt (CR 2.12) |
| accountManagement | local_only | Schwellwerte via P-6 konfigurierbar, kein zentrales IAM |

**P-4 — Fire Panel Communication Service** *(enthält RS485-Kommunikationsstack; austauschbar für 868MHz Wireless oder andere OT-Protokolle)*

> **Review-Änderung:** Präziserer Name mit explizitem OT-/Fire-Panel-Bezug.
> Verbessert Lesbarkeit und Threat-Modelling-Qualität (weniger generisch,
> klarere Zuordnung bei Threat-Analysen).

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | protocol_stack | RS485 Brandmeldeprotokoll. Heartbeat, Statusmeldung, Alarmmeldung |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | medium | |
| authenticationRequired | no | ⚠ RS485-Protokoll ohne Auth |
| inputValidation | basic | Protokoll-Frame-Validierung |
| securityControls | keine bekannten | |
| failSafeOutputState | not_defined | Bei Kommunikationsausfall: Heartbeat-Timeout erkennbar durch Zentrale |
| malwareProtection | none | |
| nonRepudiation | none | ⚠ Alarmmeldung ohne Audit-Log (CR 2.12) |

**P-5 — Firmware Update Manager** *(vereint vormals P-5 + P-9 Firmware Update Service)*

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | daemon | Download, Validierung, Flash von Firmware-Updates via WLAN |
| processSemantic | execution_unit | ⚠ Kritischster Prozess: kompromittiert = vollständige Geräteübernahme |
| runsAs | system | |
| privilegeLevel | root | Flash-Schreibzugriff erforderlich |
| authenticationRequired | certificate (SOLL) | ⚠ Firmware-Signatur vor Flash prüfen? Kritische Frage |
| inputValidation | strict (SOLL) | Firmware-Signatur, Rollback-Schutz, Fallback-Image |
| securityControls | unbekannt | ⚠ Signed Firmware? TLS zur Update-URL? Rollback-Image? |
| failSafeOutputState | not_defined | Bei Update-Fehler: Rollback auf vorherige Version? |
| malwareProtection | code_signing | SOLL: nur signierte Images flashen |
| updateMechanism | signed_ota | SOLL — IST unbekannt |
| accountManagement | local_only | Update-Trigger via WLAN-App, kein zentrales IAM |
| authenticatorStorage | software_only | ⚠ TLS-Client-Zertifikat/Key im Flash |

**P-6 — Maintenance Authentication Service** *(umbenannt von „Auth")*

> **Review-Änderung:** Klarerer Scope, bessere Abgrenzung zu WLAN-/WPA-Authentifizierung,
> realistischer Servicename, besser verständlich in Audits.

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | functional_block | Authentifizierung für WLAN-Konfigurationszugang |
| processSemantic | security_boundary | Expliziter Security-Enforcement-Point |
| runsAs | system | |
| privilegeLevel | high | Verwaltet Credentials, Sitzungstokens |
| authenticationRequired | yes (self) | |
| inputValidation | strict | Brute-Force-Schutz, Lockout nach N Versuchen |
| securityControls | Passwortschutz | ⚠ Passwort-Hashing? Keine Default-Passwörter (CRA §1(1)) |
| failSafeOutputState | not_defined | Bei Auth-Ausfall: Zugang gesperrt oder offen? |
| malwareProtection | none | |
| nonRepudiation | none | Auth-Events geloggt? Failed Logins? |
| accountManagement | local_only | ⚠ Shared Credentials riskant — kein zentrales IAM (CR 1.3) |
| authenticatorStorage | software_only | ⚠ Passwort-Hash wo gespeichert? bcrypt/PBKDF2? (CR 1.5 RE1) |

**P-7 — WLAN Manager**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | driver | IEEE 802.11 b/g/n — Station-Modus für Update-Server, AP-Modus für Wartung |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | high | Verwaltet WLAN-Credentials |
| authenticationRequired | yes (WPA2) | ⚠ WPA2 oder WPA3? WLAN-Passwort gespeichert als Hash? |
| inputValidation | basic | |
| securityControls | WPA2 (angenommen) | |
| failSafeOutputState | not_defined | Bei WLAN-Ausfall: Gerät arbeitet weiter (Alarm via RS485) |
| malwareProtection | none | |
| authenticatorStorage | software_only | ⚠ WPA2-PSK im Flash |

> *P-8 (RS485 Communication Stack) ist in P-4 integriert.*

**P-8 — Secure Boot & Firmware Validation** *(vormals P-10)*

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | protocol_stack | Proprietärer RS485-Kommunikationsstack für Alarm- und Statusmeldungen |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | medium | Zugriff auf externe Buskommunikation |
| authenticationRequired | no | ⚠ Keine Authentisierung auf RS485-Protokollebene |
| authorizationModel | none | |
| inputValidation | basic | CRC-/Frame-Prüfung vorhanden |
| errorHandling | sanitized | Fehlerhafte Frames werden verworfen |
| securityControls | CRC frame validation | Keine kryptographische Integrität |
| exposedToInternet | false | |
| malwareProtection | none | Bare-metal / kein Whitelisting |
| failSafeOutputState | hold_last_value | Letzter bekannter Zustand bleibt aktiv |
| authenticatorStorage | software_only | Falls Bus-Keys existieren: im Flash gespeichert |
| notes | RS485 dient als primärer Alarm-Kommunikationspfad zu externen Panels oder Gebäudeleittechnik |

> *P-9 (Firmware Update Service) ist in P-5 integriert.*

**P-9 — Audit & Event Logging Service** *(vormals P-11)*

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | bootloader | Verantwortlich für Firmware-Update und Flashing |
| processSemantic | security_boundary | Vertrauensanker für Firmware-Integrität |
| runsAs | system | |
| privilegeLevel | high | Direkter Schreibzugriff auf Flash/Firmware |
| authenticationRequired | optional | ⚠ Wartungsmodus eventuell ohne Auth |
| authorizationModel | custom | Proprietärer Update-Mechanismus |
| inputValidation | strict | Firmware Header + CRC/Signaturprüfung |
| errorHandling | sanitized | Fehlerhafte Images werden verworfen |
| securityControls | firmware integrity validation | ⚠ Secure Boot vorhanden? |
| exposedToInternet | false | Updates nur lokal via WLAN/Wartung |
| malwareProtection | code_signing | Falls Signaturprüfung implementiert |
| failSafeOutputState | fixed_value | Gerät startet letzte gültige Firmware |
| authenticatorStorage | software_only | Öffentliche Prüfschlüssel im Flash |
| notes | Kritischer Prozess für Secure Firmware Lifecycle und OTA-/Wartungsupdates |

### 4.3  OPTIONAL — Zusätzliche Prozesse *(neu in v3)*

> Die folgenden Prozesse sind **optional**. Die Architektur funktioniert ohne sie.
> Sie erhöhen jedoch die Realitätsnähe für ein industrielles Embedded-/IoT-/Fire-Detection-System
> und decken fehlende Aspekte für CRA, IEC 62443 und EN 54 Security Extensions ab.

> *P-10 ist umnummeriert zu P-8.*

> **Review-Ergänzung:** Dieser Prozess fehlt aktuell vollständig.
> Relevant für: Secure Boot, Firmware Signature Validation, Rollback Protection,
> Root of Trust, Firmware Integrity, Supply-Chain Protection.
> Besonders relevant für CRA, IEC 62443, EN 54 Security Extensions.

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | bootloader | Bootzeit-Validierung der Firmware-Signatur vor Ausführung |
| processSemantic | security_boundary | Root of Trust — Vertrauensanker für gesamten Boot-Prozess |
| runsAs | system | |
| privilegeLevel | root | Bootzeit-Kontext, vor OS/RTOS |
| authenticationRequired | certificate | Firmware-Signaturprüfung via Public Key |
| inputValidation | strict | Firmware Header, Signatur, Rollback-Counter |
| securityControls | Firmware Signature Validation, Rollback Counter, Secure Key Storage | |
| failSafeOutputState | fixed_value | Bei Signaturprüfung fehlgeschlagen: Boot verweigert |
| malwareProtection | code_signing | Ist selbst der Durchsetzungspunkt für Code Signing |
| nonRepudiation | none | ⚠ Boot-Events nicht geloggt — Audit-Gap |
| authenticatorStorage | software_only | ⚠ SOLL: Secure Element oder OTP-gesicherter Key |
| notes | OPTIONAL — nur relevant wenn Secure Boot implementiert oder geplant wird |

> *P-11 ist umnummeriert zu P-9.*

> **Review-Ergänzung:** Aktuell fehlt ein echtes Logging-/Audit-System.
> Relevant für: Non-Repudiation, Forensik, CRA Compliance, Incident Response.
> Alarmereignisse, Login-Versuche, Firmware-Updates und Tamper-Events
> müssen nachvollziehbar sein.

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | daemon | Persistentes Logging sicherheitsrelevanter Events |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | medium | Nur Schreibzugriff auf Log-Speicher |
| authenticationRequired | no | Interne Funktion, kein direkter externer Zugriff |
| inputValidation | basic | Event-Typ und Timestamp-Validierung |
| securityControls | Append-Only Log, Tamper-Evident Storage | ⚠ Log-Manipulation muss erkennbar sein |
| failSafeOutputState | hold_last_value | Bei Speicherfehler: weiter loggen in RAM-Buffer |
| malwareProtection | none | |
| nonRepudiation | audit_log | ⚠ Dies IST der Non-Repudiation-Mechanismus für andere Prozesse |
| notes | OPTIONAL — besonders relevant für A-9 (N=critical) und CRA CR 2.12 Compliance |

---

## 5  Datenspeicher

**DS-1 — Flash: Kalibrierparameter (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Optische Kalibrierkoeffizienten, Sensor-Seriennummer, Werkskalibrierung |
| dataClassification | confidential | ⚠ Manipulation = systematisch falsche Messungen, undetektiert |
| encryptionAtRest | none (angenommen) | ⚠ Klartext im Flash? Manipulationsschutz? |
| accessControlMechanism | process_enforced | Nur P-1 und P-3 via Kalibrierkommandos |
| integrityProtection | none | ⚠ Hochrisiko: kein HMAC auf Kalibrierparameter |
| deletionMechanism | none | Kalibrierung ist permanent |
| cryptoStandard | not_assessed | |

**DS-2 — Flash: Sensor Firmware (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Firmware-Image des Sensor MCU |
| dataClassification | restricted | |
| encryptionAtRest | unbekannt | |
| accessControlMechanism | process_enforced | Nur via Bootloader |
| integrityProtection | signature (SOLL) | ⚠ Wird Signatur geprüft? Update-Mechanismus klären |
| deletionMechanism | overwrite | Via Firmware-Update-Prozess |
| cryptoStandard | not_assessed | |

**DS-3 — Flash: Alarm-Konfiguration (Controller MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Rauchschwellwerte, Voralarm-Schwelle, Alarmverzögerungen, Zoneninfo |
| dataClassification | confidential | ⚠ Schwellwert manipuliert = kein Alarm oder Daueralarm |
| encryptionAtRest | none | |
| accessControlMechanism | process_enforced | Nur via P-6 (nach Auth). Nicht direkt via RS485 änderbar |
| integrityProtection | none | ⚠ Kein HMAC auf Schwellwerte |
| deletionMechanism | factory_reset | Factory Reset setzt Standardkonfiguration |
| cryptoStandard | not_assessed | |

**DS-4 — Flash: Controller Firmware**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Firmware-Image Controller MCU — Security-Anker des Systems |
| dataClassification | restricted | |
| encryptionAtRest | unbekannt | ⚠ Firmware verschlüsselt gespeichert? |
| accessControlMechanism | process_enforced | Nur P-5 (Firmware Update Manager) + Bootloader |
| integrityProtection | signature (SOLL) | ⚠ Secure Boot muss Firmware-Signatur prüfen |
| deletionMechanism | overwrite | Via P-5. Rollback-Image vorhanden? |
| cryptoStandard | not_assessed | ⚠ Signaturalgorithmus? RSA-2048? Ed25519? |

**DS-5 — Flash: Device Config / Credentials**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | WLAN-Credentials, Gerätekennwort, Netzwerkeinstellungen, Zertifikate |
| dataClassification | confidential | ⚠ Credentials im Klartext? |
| encryptionAtRest | none (angenommen) | ⚠ Passwörter gehasht? CRA §1(3) |
| accessControlMechanism | process_enforced | Nur P-6 (Auth) nach erfolgreicher Authentifizierung |
| integrityProtection | none | ⚠ Config-Manipulation via Debug möglich |
| deletionMechanism | factory_reset | Factory Reset löscht Credentials und Netzwerkconfig |
| cryptoStandard | not_assessed | ⚠ Passwort-Hash-Algorithmus: SHA-256? bcrypt? |

---

## 6  Schnittstellen (Interfaces)

**IF-1 — SPI: CB-1 ↔ CB-2 (intern)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | custom | SPI-Bus intern. Sensor MCU ↔ Controller MCU |
| exposureLevel | EL0 | Vollständig intern, Chip-zu-Chip |
| accessControl | none | Interner Bus, kein logischer Schutz |
| location | on_board | PCB-Leiterbahn, physisch nicht zugänglich ohne Gehäuse öffnen |
| operationalState | enabled | Immer aktiv |
| implementedControls.logicalAccessControl | none | Interner Bus ohne Protokoll-Auth |
| implementedControls.physicalAccessProtection | inside_enclosure | PCB geschützt durch PB-1 |
| implementedControls.signalProtection | none | SPI unverschlüsselt |

**IF-2 — RS485: Controller ↔ Brandmeldezentrale**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | RS485, Standard-Brandmeldeprotokoll |
| exposureLevel | EL2 | Lokales Brandmeldenetz |
| accessControl | none | ⚠ Kein logischer Zugriffsschutz |
| location | field_cable | Externes Kabel im Gebäude — physisch zugänglich (Abziehen = DoS) |
| operationalState | enabled | Immer aktiv |
| implementedControls.logicalAccessControl | none | ⚠ RS485 ohne Protokoll-Auth |
| implementedControls.physicalAccessProtection | none | ⚠ Externer Klemmanschluss ungeschützt |
| implementedControls.signalProtection | none | ⚠ RS485 differential aber kein Crypto |
| implementedControls.abuseProtection | none | Kein Rate-Limiting auf Feldbus |

**IF-3 — WLAN 802.11: Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | wifi | AP-Modus (Wartung) + Station-Modus (Update-Server) |
| exposureLevel | EL3 | Lokales WLAN, physische Nähe erforderlich |
| accessControl | credentials | WPA2-PSK |
| location | wireless_local | ⚠ RF-Jamming / 802.11 Deauth ohne Netzwerkzugang möglich |
| operationalState | enabled | Immer aktiv — auch wenn keine Wartung läuft |
| implementedControls.logicalAccessControl | password | WPA2-PSK |
| implementedControls.physicalAccessProtection | none | Wireless, keine Barriere |
| implementedControls.signalProtection | none | WPA2 schützt nur Auth, nicht RF-Jamming |
| implementedControls.abuseProtection | none | ⚠ Kein Deauth-Schutz, kein Rate-Limiting auf WPA2-Auth |

**IF-4 — Alarm Relay Output**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | gpio | Digitaler Ausgang — Alarm-Relais schaltet Sirene/Sprinkler |
| exposureLevel | EL1 | Physisch zugänglich aber kein Protokoll-Angriff möglich |
| accessControl | none | Elektrisches Signal, kein digitaler Schutz |
| location | in_enclosure | Intern im Gerät bis zum Klemmanschluss |
| operationalState | enabled | |
| implementedControls.logicalAccessControl | none | GPIO-Pin, kein Protokoll |
| implementedControls.physicalAccessProtection | inside_enclosure | Intern bis Klemme |

**IF-5 — Debug UART: CB-1 (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | Physische Debug-Schnittstelle Sensor MCU |
| exposureLevel | EL1 | Physischer Zugang, Gehäuse öffnen erforderlich |
| accessControl | none (angenommen) | ⚠ Debug in Produktion deaktiviert? |
| location | on_board | Intern, Leiterplatte |
| operationalState | enabled | ⚠ IST: aktiv. SOLL: permanent_disabled in Produktion |
| implementedControls.logicalAccessControl | none | ⚠ Keine Auth auf UART |
| implementedControls.debugProtection | none | ⚠ Kein RDP, kein Fuse — Firmware auslesbar |
| implementedControls.physicalAccessProtection | inside_enclosure | Gehäuse schützt, aber nach Öffnung frei zugänglich |

**IF-6 — Debug UART: CB-2 (Controller MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | Physische Debug-Schnittstelle Controller MCU |
| exposureLevel | EL1 | |
| accessControl | none (angenommen) | ⚠ Debug in Produktion deaktiviert? |
| location | on_board | Intern, Leiterplatte |
| operationalState | enabled | ⚠ IST: aktiv. SOLL: permanent_disabled in Produktion |
| implementedControls.logicalAccessControl | none | ⚠ Keine Auth auf UART |
| implementedControls.debugProtection | none | ⚠ Kein RDP Level 2 — Firmware + Credentials auslesbar |
| implementedControls.physicalAccessProtection | inside_enclosure | |
| implementedControls.abuseProtection | none | Kein Lockout auf UART |

---

## 7  Datenflüsse (Data Flows)

**DF-1 — Rauchsensordaten: CB-1 → CB-2 (P-1 → P-3)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | SPI-Bus intern, proprietäres Datenformat |
| direction | unidirectional | Sensor → Controller (Poll durch Controller) |
| frequency | continuous | Kontinuierlich, ~10 Hz |
| encryptionInTransit | none | Interne SPI — kein Encryption |
| integrityProtection | crc | ⚠ Kein kryptographischer Schutz |
| location | on_board | PCB-intern, kein externer Zugriff ohne Gehäuse öffnen |
| redundancy | none | ⚠ Single Point of Failure: Ausfall SPI = Controller blind |
| assumedTrusted | true | Gerechtfertigt durch physische Isolation (IP67) |
| safetyFunction | none | Der Flow selbst ist kein Safety-Actuator |
| physicalPathProtection | inside_enclosure | PCB-Leiterbahn innerhalb PB-1 |
| accessMode | read_only | Controller liest Sensor — keine Schreibbefehle auf diesem Flow |

**DF-2 — Kalibrierkommandos: CB-2 → CB-1 (P-3 → P-1)**

> **Review-Hinweis:** DF-2 ist bidirektional. Für sauberes Threat Modelling in TARAflow
> als DF-2a (Kommandos) und DF-2b (Bestätigung) separat geführt — siehe Beziehungen Abschnitt 9.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | SPI-Bus intern, Kalibrierparameter-Schreibzugriff |
| direction | bidirectional | Kommandos + Bestätigung |
| frequency | ondemand | Nur bei Wartung/Kalibrierung |
| encryptionInTransit | none | ⚠ Kalibrierparameter ungeschützt übertragen |
| integrityProtection | none | ⚠ Manipulierte Kalibrierkommandos undetektiert möglich |
| location | on_board | |
| safetyFunction | none | |
| physicalPathProtection | inside_enclosure | PCB-intern |
| accessMode | read_write | ⚠ Schreibzugriff auf Kalibrierparameter (DS-1) |

**DF-3 — Alarmmeldung: P-4 → EE-1 (RS485)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Brandmeldeprotokoll (EN 54-kompatibel) |
| direction | unidirectional | Controller → Brandmeldezentrale |
| frequency | ondemand | Nur bei Alarm / Voralarm |
| encryptionInTransit | none | ⚠ Brandmeldeprotokolle ohne Encryption |
| integrityProtection | none | |
| endpointAuthentication | none | ⚠ Kein Auth auf Protokollebene |
| location | field_cable | RS485-Kabel im Gebäude — Abziehen = Alarm-DoS |
| redundancy | none | ⚠ Kritisch: Kabel weg = Alarm erreicht Zentrale nicht |
| safetyFunction | emergency_stop | ⚠ KRITISCH: Alarm-Signal ist Safety-Funktion (EN 54) |
| physicalPathProtection | none | ⚠ Kabel ungeschützt — Abziehen in 2 Sekunden möglich |

**DF-4 — Heartbeat/Status: P-4 → EE-1 (RS485)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Periodische Statusmeldung, Geräte-Alive-Signal |
| direction | unidirectional | |
| frequency | periodic | Typisch alle 60s |
| encryptionInTransit | none | |
| integrityProtection | none | |
| location | field_cable | |
| redundancy | none | Heartbeat-Ausfall = Zentrale erkennt Geräteausfall |
| safetyFunction | none | Überwachungsfunktion, kein direkter Safety-Actuator |
| physicalPathProtection | none | Gleiches Kabel wie DF-3 |

**DF-5 — Konfiguration: EE-2 → P-6/P-3 (WLAN/HTTPS)**

> **Review-Hinweis:** DF-5 ist bidirektional. Als DF-5a (Schreiben) und DF-5b (Lesen)
> separat geführt — siehe Beziehungen Abschnitt 9.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https | WLAN, Browser-basiert oder Wartungs-App |
| direction | bidirectional | Konfiguration lesen und schreiben |
| frequency | ondemand | Nur bei Wartung |
| encryptionInTransit | tls (angenommen) | ⚠ Selbst-signiertes Zertifikat? Validierung? |
| integrityProtection | hmac | TLS-Verbindung bietet HMAC-basierte Integrität |
| endpointAuthentication | token | Passwort-Auth. Brute-Force-Schutz? |
| location | wireless_local | ⚠ Deauth-Attack möglich → Wartung unterbrochen |
| redundancy | degraded | Gerät funktioniert weiter, nur Konfigurationszugang weg |
| safetyFunction | none | Konfigurationsflow, kein Safety-Actuator |
| physicalPathProtection | none | Wireless — kein physischer Pfad schützbar |
| accessMode | read_write | Konfigurationsschreibzugriff nach Auth |

**DF-6 — Firmware Update: EE-3 → P-5 (WLAN)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https | Download vom Sigrist Update Server |
| direction | unidirectional | Pull (Gerät initiiert) oder Push? |
| frequency | ondemand | |
| encryptionInTransit | tls (angenommen) | ⚠ Zertifikat-Pinning? |
| integrityProtection | signature (SOLL) | ⚠ KRITISCH: Firmware-Signatur vor Flash prüfen? |
| endpointAuthentication | certificate (angenommen) | ⚠ Update-Server authentifiziert? |
| location | internet | Update-Server ist extern — höchste Expositionsstufe |
| redundancy | none | Fehlgeschlagenes Update: Fallback-Image vorhanden? |
| safetyFunction | none | Update-Flow ist kein direkter Safety-Actuator |
| physicalPathProtection | none | Internet-Verbindung, kein physischer Pfad |
| accessMode | read_only | Gerät empfängt nur — kein Schreibzugriff auf Server |

### 7.1  Neue Datenflüsse *(ergänzt in v3)*

**DF-7 — Credential Validation: P-6 ↔ DS-5**

> **Review-Ergänzung:** Ohne diesen Flow ist die Authentifizierung technisch nicht vollständig
> modelliert. P-6 liest Passwort-Hashes aus DS-5 und schreibt Session-/Token-Daten zurück.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Interner Speicherzugriff, kein Netzwerkprotokoll |
| direction | bidirectional | Lesen (Hash-Prüfung) + Schreiben (Session-Token) |
| frequency | ondemand | Nur bei Authentifizierungsversuch |
| encryptionInTransit | none | Interne Flash-Zugriff |
| integrityProtection | none | ⚠ Flash-Inhalt ungeschützt |
| location | on_board | Interner Speicherzugriff, PCB-intern |
| accessMode | read_write | P-6 liest Hashes, schreibt Session-State |
| safetyFunction | none | |
| physicalPathProtection | inside_enclosure | |
| messageType | credentials | |
| notes | Threat-Relevanz: Credential Theft, Offline Password Extraction, Session Manipulation, Replay, Tampering |

**DF-8 — Firmware Flash Write: P-5 → DS-4**

> **Review-Ergänzung:** Dies ist der eigentliche kritische Update-Vorgang. Ohne diesen Flow
> existiert kein modellierter Schreibzugriff auf die Firmware — der kritischste Einzelpfad
> im System ist damit unsichtbar für das Threat Modelling.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Flash-Erase + Flash-Write, interner Speicherzugriff |
| direction | unidirectional | P-5 → DS-4 (Schreiben neuer Firmware) |
| frequency | ondemand | Nur bei Firmware-Update |
| encryptionInTransit | none | Interner Speicherzugriff |
| integrityProtection | signature (SOLL) | ⚠ KRITISCH: Signaturprüfung VOR dem Schreiben |
| location | on_board | Interner Flash-Controller |
| accessMode | write_only | Nur Schreibzugriff — kein Read-Back auf diesem Flow |
| safetyFunction | none | |
| physicalPathProtection | inside_enclosure | |
| messageType | firmware | |
| notes | Threat-Relevanz: Malicious Firmware, Firmware Corruption, Rollback Attacks, Persistence, Arbitrary Code Execution |

**DF-8b — Firmware Verification Readback: DS-4 → P-5** *(OPTIONAL)*

> **Review-Ergänzung (optional):** Post-Flash-Integritätsprüfung.
> P-5 liest die geflashte Firmware zurück und vergleicht Hash/Signatur.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Flash-Read, interner Speicherzugriff |
| direction | unidirectional | DS-4 → P-5 (Readback-Verifikation) |
| frequency | ondemand | Einmalig nach jedem Flash-Vorgang |
| encryptionInTransit | none | |
| integrityProtection | signature (SOLL) | Hash-Prüfung des gelesenen Images |
| location | on_board | |
| accessMode | read_only | |
| safetyFunction | none | |
| notes | OPTIONAL — nur relevant wenn Post-Flash-Verification implementiert ist |

**DF-9 — Calibration Read: DS-1 → P-1**

> **Review-Ergänzung:** Die Kalibrierungsdaten sind ein kritisches Asset (A-2).
> Aktuell existiert nur die Asset-Referenz, aber kein technischer Datenfluss der
> modelliert, wie P-1 auf die Kalibrierparameter zugreift.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Interner Flash-Lesezugriff, proprietäres Format |
| direction | unidirectional | DS-1 → P-1 (beim Start und bei Neukalibrierung) |
| frequency | ondemand | Boot-Zeit + bei Kalibrierungsänderung |
| encryptionInTransit | none | Interner Speicherzugriff |
| integrityProtection | none | ⚠ Kalibrierparameter ohne kryptographische Integritätsprüfung |
| location | on_board | |
| accessMode | read_only | P-1 liest nur |
| safetyFunction | none | Indirekt safety-relevant über A-2 → A-1 → A-8 |
| physicalPathProtection | inside_enclosure | |
| messageType | calibration | |
| notes | Threat-Relevanz: Manipulation von Alarmgrenzen, False Negative, False Positive, Safety-Ausfall |

**DF-10 — Calibration Update: P-2 → DS-1**

> **Review-Ergänzung:** Selbstkalibrierung und Diagnosekorrekturen durch P-2.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Interner Flash-Schreibzugriff |
| direction | unidirectional | P-2 → DS-1 (Drift-Kompensation) |
| frequency | ondemand | Periodisch oder bei Diagnoseereignis |
| encryptionInTransit | none | |
| integrityProtection | none | ⚠ Kein Schutz auf Schreibpfad |
| location | on_board | |
| accessMode | write_only | |
| safetyFunction | none | |
| physicalPathProtection | inside_enclosure | |
| messageType | calibration | |

**DF-11 — Alarm Relay Signal: P-3 → IF-4**

> **Review-Ergänzung:** Das Alarm Relay (IF-4) existiert aktuell isoliert ohne
> modellierten Steuerungspfad. Ohne diesen Flow endet die Safety-Kette logisch
> im Controller — die eigentliche physische Alarmauslösung ist unsichtbar.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | GPIO-Steuerung, digitales Signal |
| direction | unidirectional | P-3 → IF-4 (Relay-Schalten) |
| frequency | event_based | Nur bei Alarm-Trigger |
| encryptionInTransit | none | Elektrisches GPIO-Signal |
| integrityProtection | none | Physisches Signal, kein kryptographischer Schutz |
| location | in_enclosure | GPIO-Leitung intern im Gerät |
| accessMode | write_only | |
| safetyFunction | fire_gas | ⚠ KRITISCH: Dieser Flow ist die physische Alarmauslösung (EN 54) |
| crossesSafetyBoundary | true | P-3 (software) → IF-4 (physical output) |
| physicalPathProtection | inside_enclosure | |
| messageType | alarm_event | |
| notes | Threat-Relevanz: Alarm Suppression, Relay Manipulation, Safety Failure, Denial of Alarm |

**DF-12 — WLAN Transport for Updates: P-7 → P-5**

> **Review-Ergänzung:** Aktuell lädt der Update Manager Firmware indirekt „magisch"
> aus dem Netzwerk. Der technische Transportpfad via WLAN Manager fehlt.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https | TLS-Transport, OTA-Download |
| direction | unidirectional | P-7 → P-5 (WLAN-Modul liefert Daten an Update Manager) |
| frequency | ondemand | Nur bei Update-Vorgang |
| encryptionInTransit | tls | TLS durch P-7 terminiert |
| integrityProtection | signature (SOLL) | Firmware-Signatur wird von P-5 nach Empfang geprüft |
| endpointAuthentication | certificate (angenommen) | |
| location | wireless_local | |
| redundancy | none | |
| safetyFunction | none | |
| accessMode | read_only | |
| messageType | firmware | |
| notes | Threat-Relevanz: MITM, TLS Downgrade, Update Hijacking, Network Injection |

**DF-13 — Authenticated Maintenance Session: P-7 ↔ P-6**

> **Review-Ergänzung:** TLS-geschützte Wartungssession zwischen WLAN-Stack (P-7)
> und Authentication Service (P-6). Login-Transport und Credential-Übertragung.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https | HTTPS-Session für Wartungszugang |
| direction | bidirectional | Login-Request + Session-Token |
| frequency | ondemand | Nur bei Wartungszugang |
| encryptionInTransit | tls | |
| integrityProtection | hmac | TLS-Integrität |
| endpointAuthentication | token | Passwort → Session-Token |
| location | wireless_local | |
| accessMode | read_write | |
| messageType | credentials | |
| notes | Threat-Relevanz: Credential Interception, Session Hijacking, Replay, MITM |

**DF-14 — Sensor Firmware Update: P-5 → DS-2** *(OPTIONAL)*

> **Review-Ergänzung (optional):** Der Text deutet bereits an, dass vollständige
> Geräteupdates möglich sind. In realen Embedded-Systemen mit Sensor MCU + Controller MCU
> ist ein separater Update-Pfad für die Sensor-MCU sehr wahrscheinlich.

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | Interner SPI/UART-basierter Update-Pfad zur Sensor MCU |
| direction | unidirectional | P-5 → DS-2 |
| frequency | ondemand | |
| encryptionInTransit | none | Interner Bus-Transport |
| integrityProtection | signature (SOLL) | ⚠ Sensor-Firmware-Signatur prüfen? |
| location | on_board | |
| accessMode | write_only | |
| safetyFunction | none | |
| messageType | firmware | |
| notes | OPTIONAL — nur relevant wenn Sensor MCU separat updatebar ist |


### 7.2  Neue Datenflüsse *(ergänzt in v4)*

**DF-2c — Diagnosestatus: P-2 → P-3**
P-2 meldet Sensor-Health-Events (Feuchte, Temperatur, LED-Alterung) an P-3.
Ohne diesen Flow wäre ein Sensor-Ausfall für den Alarm Controller unsichtbar.

| Property | Wert |
|----------|------|
| protocol | spi |
| direction | unidirectional |
| frequency | event_based |
| location | on_board |

**DF-3b — Alarm intern: P-3 → P-4**
Interner Weiterleitungspfad von Alarm-Entscheidungslogik zu RS485-Kommunikationsstack.

**DF-5c — Konfiguration nach Auth: P-6 → P-3**
Nach erfolgreicher Authentifizierung schreibt P-6 Schwellwerte in P-3/DS-3.
Ohne diesen Flow wäre unklar wie Konfiguration nach Auth den Alarm Controller erreicht.

**DF-7b — Credential Hash Readback: DS-5 → P-6**
P-6 liest Passwort-Hashes und Session-State aus DS-5.

**DF-12/12b — WLAN Eingang/Ausgang: IF-3 ↔ P-7**
Bidirektionaler WLAN-Datenfluss. IF-3 ist jetzt korrekt mit P-7 verdrahtet.

**DF-13b — Auth-Session Transport: P-7 → P-6**
TLS-Transport der Maintenance-Session vom WLAN-Stack zur Authentifizierung.

**DF-int1b — Alarm-Konfiguration Readback: DS-3 → P-3**
P-3 liest Schwellwerte beim Start und nach Konfigurationsänderung.

**DF-sb1..sb3 — Secure Boot Flows: DS-4/DS-2 → P-8, P-8 → P-3**
P-8 liest Firmware-Images zur Signaturverifikation. Boot-Freigabe geht an P-3.

**DF-log1..log5 — Audit Logging: P-3/P-5/P-6/P-8 → P-9 → DS-3**
Alle sicherheitsrelevanten Events werden in P-9 geloggt und in DS-3 persistiert.


---

## 8  Assets

*Impact-Faktoren: Safety (S) · Operational (O) · Financial (F) · Regulatory (R) · Recoverability (Rec)*
*Skala: L = Low · M = Medium · H = High · C = Critical*

### 8.1  Data Assets

**A-1 — Rauchsensormessung** *(Data)*

Aktueller Messwert des optischen Sensors. Ephemer — direkte Basis der Alarm-Entscheidung.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | none | **critical** | **critical** | medium | low |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | H | **C** | L | **C** |

> Rec=L da neuer Messwert in Sekunden — Safety und Operational trotzdem Critical wegen Alarm-Abhängigkeit.

---

**A-2 — Kalibrierparameter (Sensor)** *(Data)* 🔴 High Value Asset

Optische Kalibrierkoeffizienten, Empfindlichkeitsfaktoren, Referenzwerte. Manipulation führt zu systematisch falschen Messungen — **undetektiert bis zur nächsten Kalibrierprüfung.**

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | high | **critical** | low | high | **critical** |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | H | **C** | H | **C** |

> Das kritischste Asset: der Angriff ist still, der Schaden ist systematisch und dauerhaft.

---

**A-3 — Alarm-Konfiguration / Schwellwerte** *(Data)* 🔴 High Value Asset

Rauchschwellwerte, Alarmverzögerungen, Zonenidentifikation.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | low | **critical** | **critical** | high | **critical** |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | H | **C** | M | **C** |

---

**A-4 — Controller Firmware** *(Data)* 🔴 High Value Asset

Firmware-Image des Controller MCU. Enthält Alarmlogik, Protokoll-Stacks, Auth, WLAN.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | medium | **critical** | high | low | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | H | H | **C** | **C** |

---

**A-5 — Sensor Firmware** *(Data)*

Firmware des Sensor MCU.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | low | **critical** | medium | low | medium |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | H | H | M | H | H | **H** |

---

**A-6 — Auth Credentials / Passwörter** *(Data)*

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | **critical** | **critical** | medium | medium | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | M | H | M | H | M | **H** |

---

**A-7 — Device Config / Netzwerkeinstellungen** *(Data)*

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | medium | medium | medium | low | low |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | L | M | L | L | M | **M** |

---

### 8.2  Function Assets

**A-8 — Rauchdetektionsfunktion** *(Function)* 🔴 High Value Asset

| CIANAAA | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|-------|-------|-----|
| | **critical** | **critical** | high | medium | high | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | **C** | **C** | H | **C** |

---

**A-9 — Alarmauslösefunktion** *(Function)* 🔴 High Value Asset

| CIANAAA | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|-------|-------|-----|
| | **critical** | **critical** | **critical** | high | **critical** | **critical** |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | **C** | **C** | **C** | H | **C** |

> N=critical: Beweisführung nach Brandereignis (Haftung, Versicherung, Strafverfolgung).

---

### 8.3  Process & Service Assets

**A-10 — Firmware-Update-Prozess** *(Process)*

| CIANAAA | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|-------|-------|-----|
| | **critical** | medium | high | **critical** | **critical** | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | H | H | M | H | H | **H** |

---

**A-11 — Sigrist Update Server** *(Service)* 🔴 High Value Asset

| CIANAAA | C | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|---|-------|-------|-----|
| | medium | **critical** | high | medium | **critical** | **critical** | medium |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------| 
| | **C** | H | H | H | **C** | **C** |

---

## 8.4  Human Assets *(neu)*

**A-12 — Gebäudebewohner / Schutzpersonen** *(Human)*

Personen im Gebäude die durch ausbleibenden Alarm bei Brandereignis gefährdet werden. Primäres Schutzsubjekt der Safety-Analyse.

| Property | Wert |
|----------|------|
| isProtectionTarget | true |
| safetyImpact | fatality |
| physicalHazardPotential | high |
| rationale | Ausbleibender Brandalarm = Menschenleben gefährdet (EN 54) |

---

## 9  Beziehungen

> **Hinweise zur Modellierung:**
> - DataFlows dürfen **nur** `transports` → Data Asset verwenden (kein `creates`, `reads`, `stores`)
> - DataStores nutzen `is_an` für die Identitätsbeziehung zum gespeicherten Asset
> - `executes` ist kein definierter Verb — ersetzt durch `implements` (statische Architektur) oder `invokes` (Laufzeit)
> - Bidirektionale DataFlows werden als zwei separate unidirektionale Flows modelliert
> - Richtung bei Asset→Asset: Daten *fliessen* zum Konsumenten — z.B. `A-3 configures A-8`, nicht `A-8 depends_on A-3`

### 9.1  Element → Asset

**Legende:** `is_an` = Element ist Instanz des Assets · `creates` = erzeugt · `modifies` = verändert · `implements` = realisiert statisch · `invokes` = ruft zur Laufzeit auf · `transports` = DataFlow transportiert

| Von | Beziehung | Nach | Asset-Name | Begründung |
|-----|-----------|------|------------|------------|
| P-1 | creates | A-1 | Rauchsensormessung | Optical Detection Controller erzeugt primären Messwert |
| DS-1 | is_an | A-2 | Kalibrierparameter | Sensor-Flash *ist* der Speicher der Kalibrierkoeffizienten |
| P-2 | reads | A-2 | Kalibrierparameter | Diagnostic Controller liest Kalibrierdaten zur Drift-Überwachung |
| P-3 | reads | A-1 | Rauchsensormessung | Alarm Processing liest Messwert als Input für Entscheidungslogik |
| P-3 | reads | A-3 | Alarm-Konfiguration | Alarm Processing liest Schwellwerte |
| DS-3 | is_an | A-3 | Alarm-Konfiguration | Controller-Flash *ist* der Speicher der Schwellwerte |
| P-3 | implements | A-8 | Rauchdetektionsfunktion | Alarm Controller realisiert die Detektionsfunktion statisch |
| P-3 | implements | A-9 | Alarmauslösefunktion | Alarm Controller realisiert die Alarmauslösefunktion statisch |
| DS-4 | is_an | A-4 | Controller Firmware | Controller-Flash *ist* der Speicher des Firmware-Images |
| DS-2 | is_an | A-5 | Sensor Firmware | Sensor-Flash *ist* der Speicher der Sensor-Firmware |
| DS-5 | is_an | A-6 | Auth Credentials | Device Config Flash *ist* der Speicher der Credentials |
| DS-5 | is_an | A-7 | Device Config | Device Config Flash *ist* der Speicher der Netzwerkeinstellungen |
| P-5 | implements | A-10 | Firmware-Update-Prozess | Firmware Update Manager realisiert den Update-Prozess statisch |
| P-5 | modifies | A-4 | Controller Firmware | Update Manager überschreibt das Firmware-Image (A-4, nicht DS-4) |
| EE-3 | is_an | A-11 | Sigrist Update Server | EE-3 *ist* der Update Server — Identitätsbeziehung |
| DF-1 | transports | A-1 | Rauchsensormessung | SPI-Bus überträgt Messwert von CB-1 zu CB-2 |
| DF-2a | transports | A-2 | Kalibrierparameter | SPI-Bus: Kalibrierkommandos CB-2 → CB-1 (schreibend) |
| DF-2b | transports | A-2 | Kalibrierparameter | SPI-Bus: Bestätigung CB-1 → CB-2 (Rückrichtung) |
| DF-3 | transports | A-9 | Alarmauslösefunktion | RS485: Alarm-Signal enthält Alarmauslöse-Nachricht |
| DF-4 | transports | A-1 | Rauchsensormessung | RS485: Heartbeat enthält aktuellen Gerätestatus / Messwert |
| DF-5a | transports | A-3 | Alarm-Konfiguration | WLAN: Wartungstechniker schreibt Schwellwerte (EE-2 → P-6) |
| DF-5a | transports | A-6 | Auth Credentials | WLAN: Credentials werden im Konfigurationsflow übertragen |
| DF-5a | transports | A-7 | Device Config | WLAN: Netzwerkeinstellungen werden übertragen |
| DF-5b | transports | A-3 | Alarm-Konfiguration | WLAN: Wartungstechniker liest Konfiguration (P-6 → EE-2) |
| DF-6 | transports | A-4 | Controller Firmware | WLAN: Firmware-Image wird vom Update Server geladen |
| DF-7 | transports | A-6 | Auth Credentials | Interner Zugriff: P-6 liest/schreibt Credentials in DS-5 |
| DF-8 | transports | A-4 | Controller Firmware | Flash-Write: P-5 schreibt neues Firmware-Image nach DS-4 |
| DF-9 | transports | A-2 | Kalibrierparameter | Flash-Read: DS-1 liefert Kalibrierparameter an P-1 beim Start |
| DF-10 | transports | A-2 | Kalibrierparameter | Flash-Write: P-2 schreibt Drift-Korrekturen nach DS-1 |
| DF-11 | transports | A-9 | Alarmauslösefunktion | GPIO: P-3 steuert Alarm-Relay (IF-4) — physische Alarmauslösung |
| DF-12 | transports | A-4 | Controller Firmware | WLAN-Transport: P-7 liefert Firmware-Daten an P-5 |
| DF-13 | transports | A-6 | Auth Credentials | HTTPS-Session: Credentials-Transport P-7 ↔ P-6 |

> **DF-2 aufgeteilt:** DF-2 ist bidirektional (Kalibrierkommandos + Bestätigung). TARAflow modelliert bidirektionale Kommunikation als zwei separate unidirektionale Flows (DF-2a, DF-2b).
> **DF-5 aufgeteilt:** DF-5 ist bidirektional (Konfiguration schreiben + lesen). Aufgeteilt in DF-5a (EE-2→P-6) und DF-5b (P-6→EE-2).
> **Neue Flows v3:** DF-7 bis DF-13 ergänzen fehlende technische Kommunikationspfade.

---

### 9.2  Asset → Asset

**Legende:** [KERN] = empfohlene Kernbeziehung · Safety = Safety Override Rule greift bei fatality/irreversible_injury

| Von | Beziehung | Nach | STRIDE | Begründung / Threat-Implikation |
|-----|-----------|------|--------|--------------------------------|
| A-1 | derives_from | A-2 | T | Messwert basiert auf Kalibrierung — falsche Kalibrierung = systematisch falscher Messwert |
| A-3 | configures | A-8 | T [KERN] | Schwellwerte konfigurieren Detektionsfunktion — manipulierter Schwellwert = falsche Alarmgrenze |
| A-3 | configures | A-9 | T [KERN] | Schwellwerte konfigurieren Alarmauslösung — direkter Safety-Impact bei Manipulation |
| A-4 | required_by | A-8 | T, D [KERN] | Controller Firmware wird von Detektionsfunktion benötigt — kompromittierte FW = Funktion kompromittiert |
| A-4 | required_by | A-9 | T, D [KERN] | Controller Firmware wird von Alarmauslösefunktion benötigt |
| A-8 | depends_on | A-9 | D | Alarmauslösung benötigt korrekte Detektion — A-8 Ausfall = kein Alarm |
| A-8 | affects_safety | A-12 | T, D [KERN] ⚠️ Safety | Rauchdetektionsfunktion schützt Gebäudebewohner direkt — Safety Override → CRITICAL |
| A-9 | affects_safety | A-12 | T, D [KERN] ⚠️ Safety | Alarmauslösefunktion schützt Gebäudebewohner direkt — Safety Override → CRITICAL |
| A-10 | depends_on | A-11 | D | Update-Prozess benötigt vertrauenswürdigen Update Server als Trust Anchor |
| A-5 | depends_on | A-11 | T | Sensor-Firmware-Integrität hängt an Update-Server-Trust-Anchor (Supply Chain) |
| A-4 | depends_on | A-11 | T | Controller-Firmware-Integrität hängt an Update-Server-Trust-Anchor — kompromittierter Server = Geräteübernahme |
| A-11 | exposes | A-4 | I | Update Server exponiert Controller-Firmware — Information Disclosure / IP-Diebstahl |
| A-11 | exposes | A-5 | I | Update Server exponiert Sensor-Firmware |

> **Entfernte Beziehungen (v1 → v2):**
> `A-8 depends_on A-1` → ersetzt durch `A-1 derives_from A-2` + `A-3 configures A-8` (präzisere Kausalkette)
> `A-9 depends_on A-3` → ersetzt durch `A-3 configures A-9` [KERN] (korrekte Richtung: Daten konfigurieren Function)
> `A-8 depends_on A-4` → ersetzt durch `A-4 required_by A-8` [KERN] (korrekte Richtung: Data fliessen zur Function)

---

### 9.3  Safety-Propagationskette (abgeleitet)

```
Einstiegspunkt: Tampering auf DS-1 (Kalibrierparameter) via IF-5/IF-6 Debug

DS-1 is_an A-2 (Kalibrierparameter)
  └─ A-2 ←derives_from── A-1 (Rauchsensormessung)
       └─ A-3 configures ──▶ A-8 (Rauchdetektionsfunktion)
              └─ A-8 affects_safety ──▶ A-12 (Gebäudebewohner)

Ergebnis: Tampering auf Kalibrierparameter → Safety Override → CRITICAL
Pfadlänge: 4 Hops — undetektiert bis zur nächsten Kalibrierprüfung
```

```
Einstiegspunkt: DoS auf DF-3 (RS485 Kabel abziehen)

DF-3 transports A-9 (Alarmauslösefunktion)
  └─ A-9 affects_safety ──▶ A-12 (Gebäudebewohner)

Ergebnis: DoS auf RS485-Kabel → Safety Override → CRITICAL
Angriffskomplexität: kein Werkzeug, kein Netzwerkzugang, 2 Sekunden physischer Zugang
```

```
Einstiegspunkt: Spoofing auf A-11 (Update Server kompromittiert)

A-11 exposes A-4 (Controller Firmware)
  └─ A-4 required_by A-8 (Detektionsfunktion)
  └─ A-4 required_by A-9 (Alarmauslösefunktion)
       └─ A-9 affects_safety ──▶ A-12 (Gebäudebewohner)

Ergebnis: Supply-Chain-Angriff auf Update Server → alle Geräte betroffen → CRITICAL
```

```
Einstiegspunkt: Tampering auf DF-8 (Firmware Flash Write) — NEU in v3

DF-8 transportiert A-4 (Controller Firmware) von P-5 nach DS-4
  └─ A-4 required_by A-9 (Alarmauslösefunktion)
       └─ A-9 affects_safety ──▶ A-12 (Gebäudebewohner)

Ergebnis: Manipulierter Flash-Write = kompromittierte Firmware = Safety Failure
Ohne DF-8 war dieser Angriffspfad im Threat Model unsichtbar.
```

```
Einstiegspunkt: Suppression via DF-11 (Alarm Relay Signal) — NEU in v3

DF-11 steuert IF-4 (Alarm Relay) als GPIO-Signal (safetyFunction=fire_gas)
  └─ IF-4 ist physische Alarmauslösung → Sirene/Sprinkler
       └─ A-9 affects_safety ──▶ A-12 (Gebäudebewohner)

Ergebnis: GPIO-Unterdrückung oder Relay-Manipulation = kein physischer Alarm
Ohne DF-11 endete die Safety-Kette im Controller — das Relay war unsichtbar.
```

---

## 10  Key Findings & Workshop-Aha-Moments

### 🔴 Kalibrierparameter — stiller Angriff
A-2 hat I=critical, aber Rec=low auf Messwertebene. Ein Angreifer der DS-1 via
TB-4 (Debug) manipuliert, verändert die Rauchsensitivität dauerhaft und
undetektiert. Kein Alarm, kein Fehlerzustand — der Rauchmelder **scheint zu
funktionieren**.

### 🔴 PhysicalBoundary fehlt — physische Angriffsvektoren blind
Ohne PB-1 generiert TARAflow keine physischen Threats (T-PB-*, E-PB-*, R-PB-*).
Das Angriffsszenario „Gehäuse öffnen → IF-5/IF-6 UART anschliessen → Firmware
auslesen / Kalibrierung manipulieren" ist im TARA unsichtbar.

### 🔴 Alarmauslösefunktion — N=critical
A-9 ist der einzige Asset mit Non-Repudiation=critical. Nach einem Brandereignis
muss beweisbar sein dass der Alarm ausgelöst wurde (Haftung, Versicherung,
Strafverfolgung). Fehlendes Audit-Log = kritischer Compliance-Befund (CR 2.12).

### 🔴 Firmware Flash Write unsichtbar — DF-8 fehlte *(neu in v3)*
Ohne DF-8 existierte kein modellierter Schreibzugriff auf DS-4 (Controller Firmware).
Der kritischste Einzelpfad im System — Update Manager schreibt Firmware in Flash —
war im Threat Model nicht vorhanden. Alle Firmware-Tampering-Threats auf
den eigentlichen Schreibvorgang (Malicious Firmware, Rollback Attack, Persistence)
waren damit unsichtbar.

### 🔴 Alarm Relay ohne Steuerungspfad — DF-11 fehlte *(neu in v3)*
IF-4 (Alarm Relay) existierte isoliert ohne modellierten Steuerungspfad von P-3.
Die Safety-Kette endete logisch im Controller — die physische Alarmauslösung
(Sirene, Sprinkler) war im TARA nicht sichtbar. Ohne DF-11 konnten
Alarm Suppression und Relay Manipulation Threats nicht generiert werden.

### 🟠 RS485 field_cable — DoS ohne Netzwerkzugang
DF-3 hat location=field_cable + redundancy=none + safetyFunction=emergency_stop.
Kabel abziehen = Alarm erreicht Brandmeldezentrale nicht. Kein Werkzeug,
kein Netzwerkzugang, 2 Sekunden physischer Zugang.
**Dieser DoS-Vektor wird durch reine Software-Analyse nicht sichtbar.**

### 🟠 Debug Interfaces offen — IF-5, IF-6
operationalState=enabled auf IF-5 und IF-6. Im SOLL müssen beide
`permanent_disabled` sein → shouldEliminateThreat() eliminiert dann T/I/E-Threats.
IST: alle 12 Debug-Threats bleiben aktiv.

### 🟠 Update Server Trust Anchor — Supply Chain
A-11 hat Rec=critical: ein kompromittierter Update Server betrifft alle im Feld
befindlichen Geräte gleichzeitig. Kleinste Angriffs-Investition, grösste Wirkung.

### 🟠 Authentifizierung ohne Credential-Flow — DF-7 fehlte *(neu in v3)*
P-6 (Maintenance Authentication Service) hatte keinen modellierten Zugriff auf DS-5
(Device Config / Credentials). Die Authentifizierung war technisch nicht vollständig
modelliert — Credential Theft und Offline Password Extraction Threats auf den
eigentlichen Speicherpfad fehlten.

### 🟠 WLAN-Transport für Updates fehlte — DF-12, DF-13 *(neu in v3)*
P-5 lud Firmware „magisch" aus dem Netzwerk ohne modellierten Transport-Pfad.
P-7 (WLAN Manager) und P-6 (Auth Service) waren nicht verbunden.
MITM, TLS Downgrade und Session Hijacking Threats auf den WLAN-Pfad fehlten.

### 🟡 failSafeOutputState P-3 — Safety-Entscheidung offen
P-3 muss eine explizite Entscheidung treffen: Alarm=false bei Ausfall
(verhindert Fehlalarm) oder Alarm=true (fail-safe, verhindert ausbleibenden
Alarm). Beide Optionen haben Safety-Implikationen — diese Entscheidung fehlt
im aktuellen Dokument.

### 🟡 WLAN Deauth — Wartungs-DoS
DF-5 hat location=wireless_local. Ein 802.11 Deauth-Frame (30 CHF Tool, keine
Auth) unterbricht den Wartungszugang des Technikers. Gerät funktioniert weiter,
aber Fernkonfiguration unmöglich.

---

## 11  Property-Gap-Übersicht (TARAflow Overhaul v2 + v3)

| Element | Property | IST | SOLL | TARAflow-Effekt |
|---------|----------|-----|------|----------------|
| PB-1 | *fehlt komplett* | — | device_enclosure, PEL2 | T/E/R-PB-001..* fehlen |
| P-3 | failSafeOutputState | not_defined | fixed_value | T-P-FSAFE-001 aktiv |
| P-3 | nonRepudiation | none | audit_log | R-P-NONREP-001 aktiv |
| P-3, P-5 | malwareProtection | none | code_signing | E-P-EMB-001 aktiv |
| P-6 | accountManagement | local_only | — | S-P-ACCT-001 aktiv |
| P-6, CB-1, CB-2 | authenticatorStorage | software_only | secure_element | I-P-AUTH-001 aktiv |
| CB-2 | updateMechanism | unknown | signed_ota | T-SYS-UPDATE-001 aktiv |
| CB-2 | backupMechanism | none | — | D-SYS-BACKUP-001 aktiv |
| CB-1, CB-2, DS-1..DS-5 | cryptoStandard | not_assessed | — | T-CB-CRYPTO-001 aktiv |
| IF-5, IF-6 | operationalState | enabled | permanent_disabled | T/I/E-Debug-Threats aktiv |
| IF-5, IF-6 | implementedControls.debugProtection | none | fused_off | I/E-CB-INT-001 aktiv |
| DF-3 | safetyFunction | — | emergency_stop | T/D-DF-SAFETY-001 aktiv |
| DF-3, DF-4 | physicalPathProtection | — | none | T/D-DF-PHYSICAL-001 aktiv |
| DF-2 | accessMode | — | read_write | T-DF-ACCESS-001 aktiv |
| DS-1..DS-3, DS-5 | integrityProtection | none | hmac | T-DS-EMB-001 aktiv |
| DF-7 | *fehlte in v2* | — | bidirectional, credentials | S/T/R-AUTH-CRED-001 aktiv |
| DF-8 | *fehlte in v2* | — | write_only, firmware, signature | T-FW-FLASH-001 aktiv |
| DF-9, DF-10 | *fehlten in v2* | — | calibration read/write | T-CAL-ACCESS-001 aktiv |
| DF-11 | *fehlte in v2* | — | fire_gas, GPIO | T/D-RELAY-001 aktiv |
| DF-12, DF-13 | *fehlten in v2* | — | WLAN transport paths | T-WLAN-UPDATE-001 aktiv |

---

## 12  Änderungsübersicht v2 → v3

> Diese Tabelle ermöglicht einen strukturierten Diff zwischen v2 und v3.

| Typ | ID | Änderung | Begründung |
|-----|----|----------|------------|
| Umbenennung | P-4 | „Communication Controller" → „Fire Panel Communication Service" | Klarerer OT-Bezug, weniger generisch |
| Umbenennung | P-6 | „Auth" → „Maintenance Authentication Service" | Klarer Scope, besser für Audits |
| Neu (optional) | P-10 | Secure Boot & Firmware Validation | Fehlender Prozess für Root of Trust |
| Neu (optional) | P-11 | Audit & Event Logging Service | Non-Repudiation für A-9, CRA CR 2.12 |
| Neu | DF-7 | Credential Validation: P-6 ↔ DS-5 | Authentifizierungspfad vervollständigt |
| Neu | DF-8 | Firmware Flash Write: P-5 → DS-4 | Kritischster fehlender Schreibpfad |
| Neu (optional) | DF-8b | Firmware Verification Readback: DS-4 → P-5 | Post-Flash-Integritätsprüfung |
| Neu | DF-9 | Calibration Read: DS-1 → P-1 | Fehlender Kalibrierlesepfad |
| Neu | DF-10 | Calibration Update: P-2 → DS-1 | Fehlender Kalibrierungsschreibpfad |
| Neu | DF-11 | Alarm Relay Signal: P-3 → IF-4 | Safety-Kette physisch vervollständigt |
| Neu | DF-12 | WLAN Transport for Updates: P-7 → P-5 | Fehlender WLAN-Transport-Pfad |
| Neu | DF-13 | Authenticated Maintenance Session: P-7 ↔ P-6 | Fehlender Auth-Transport-Pfad |
| Neu (optional) | DF-14 | Sensor Firmware Update: P-5 → DS-2 | Multi-MCU Update-Pfad |
| Ergänzt | Abschnitt 9.1 | 8 neue Element→Asset Beziehungen | Neue Flows in Relationship-Matrix |
| Ergänzt | Abschnitt 9.3 | 2 neue Safety-Propagationsketten | DF-8 und DF-11 Angriffspfade |
| Ergänzt | Abschnitt 10 | 4 neue Key Findings (🔴/🟠) | DF-7, DF-8, DF-11, DF-12/13 |
| Ergänzt | Abschnitt 11 | 5 neue Property-Gap-Einträge | Neue Flows in Gap-Übersicht |
| Entfernt | TB-3, TB-4 | WLAN- und Debug-TB entfernt | Redundant mit PB-1 + EE-Positionierung + Interface-Properties |
| Umbenannt | TB-1 | "Sensor ↔ Controller" → "Sensor MCU Zone" | Umfasst jetzt CB-1 vollständig |
| Umbenannt | TB-2 | "Controller ↔ Brandmeldenetz" → "Controller MCU Zone" | Umfasst jetzt CB-2 vollständig |
| Neu | P-10 | Sensor Communication Controller | SPI-Protokoll CB-1-Seite |
| Neu | P-11 | Sensor FW Update Handler | Empfängt FW von P-5, schreibt DS-2 |
| Neu | DF-1a, DF-2a2, DF-2b2 | CB-1-interne Flows | P-1/P-2 ↔ P-10 verdrahtet |
| Neu | DF-15, DF-14, DF-14b | Sensor FW Update Pfad | P-5 → P-11 → DS-2 |

---

*TARAflow Referenzbeispiel — Sigrist Rauchmelder v5*
*Vertraulich — nur für Workshop-Nutzung*
