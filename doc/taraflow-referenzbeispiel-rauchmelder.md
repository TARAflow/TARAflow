# TARAflow Referenzbeispiel
## Sigrist Rauchmelder — Industrieller Brandmelder

*Vollständige TARAflow-Projektdokumentation*

> Dieses Dokument enthält alle Elemente, Assets, Beziehungen und Bewertungen
> zur direkten Eingabe in TARAflow.

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

### 2.1  Trust Boundaries

| ID | Name | Typ |
|----|------|-----|
| TB-1 | Sensor ↔ Controller | TrustBoundary |
| TB-2 | Controller ↔ Brandmeldenetz | TrustBoundary |
| TB-3 | Controller ↔ WLAN | TrustBoundary |
| TB-4 | Debug Interfaces | TrustBoundary |

**TB-1 — Sensor ↔ Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | peripheral | |
| defaultExposureLevel | EL1 | |
| boundaryControls | Keine | |
| monitoringEnabled | false | Empfehlung: Verbindungsabbruch-Alarm implementieren |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | |

**TB-2 — Controller ↔ Brandmeldenetz**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | network | |
| defaultExposureLevel | EL2 | |
| boundaryControls | Keine | |
| monitoringEnabled | false | Empfehlung: Verbindungsabbruch-Alarm implementieren |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | |

**TB-3 — Controller ↔ WLAN**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | network | |
| defaultExposureLevel | EL3 | |
| boundaryControls | WPA2/WPA3, HTTPS, Auth (Passwortschutz) | |
| monitoringEnabled | false | Empfehlung: Verbindungsabbruch-Alarm implementieren |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | |

**TB-4 — Debug Interfaces**

| Property | Wert | Hinweis |
|----------|------|---------|
| boundaryType | debug | |
| defaultExposureLevel | EL1 | |
| boundaryControls | IP67-Gehäuse. Debug-Status in Produktion klären. | |
| monitoringEnabled | false | Empfehlung: Verbindungsabbruch-Alarm implementieren |
| complianceRelevance | CRA Anhang I §1(3) — EN 54 | |

---

### 2.2  Chip Boundaries

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

### 4.2  Controller MCU (CB-2)

**P-3 — Alarm Processing Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | rtos_task | Alarm-Entscheidungslogik: Messwert vs. Schwellwert, Verzögerungslogik |
| processSemantic | security_boundary | ⚠ Safety-kritischer Prozess — Alarmauslösung ist Safety-Funktion |
| runsAs | system | |
| privilegeLevel | high | Steuert Alarm-Relay direkt |
| authenticationRequired | no | Intern. Schwellwerte kommen via P-6 (nach Auth) |
| inputValidation | strict | Messwerte: Bereichsvalidierung. Schwellwerte: Plausibilitätsprüfung |
| securityControls | Watchdog-Timer, Fail-Safe: Alarm bei Ausfall | |

**P-4 — Communication Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | protocol_stack | RS485 Brandmeldeprotokoll. Heartbeat, Statusmeldung, Alarmmeldung |
| processSemantic | functional_block | |
| runsAs | system | |
| privilegeLevel | medium | |
| authenticationRequired | no | ⚠ RS485-Protokoll ohne Auth |
| inputValidation | basic | Protokoll-Frame-Validierung |
| securityControls | keine bekannten | |

**P-5 — Firmware Update Manager**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | daemon | Download, Validierung, Flash von Firmware-Updates via WLAN |
| processSemantic | execution_unit | ⚠ Kritischster Prozess: kompromittiert = vollständige Geräteübernahme |
| runsAs | system | |
| privilegeLevel | root | Flash-Schreibzugriff erforderlich |
| authenticationRequired | certificate (SOLL) | ⚠ Firmware-Signatur vor Flash prüfen? Kritische Frage |
| inputValidation | strict (SOLL) | Firmware-Signatur, Rollback-Schutz, Fallback-Image |
| securityControls | unbekannt | ⚠ Signed Firmware? TLS zur Update-URL? Rollback-Image? |

**P-6 — Auth**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | functional_block | Authentifizierung für WLAN-Konfigurationszugang |
| processSemantic | security_boundary | Expliziter Security-Enforcement-Point |
| runsAs | system | |
| privilegeLevel | high | Verwaltet Credentials, Sitzungstokens |
| authenticationRequired | yes (self) | |
| inputValidation | strict | Brute-Force-Schutz, Lockout nach N Versuchen |
| securityControls | Passwortschutz | ⚠ Passwort-Hashing? Keine Default-Passwörter (CRA §1(1)) |

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

---

## 5  Datenspeicher

**DS-1 — Flash: Kalibrierparameter (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash / eeprom | Optische Kalibrierkoeffizienten, Sensor-Seriennummer, Werkskalibrierung |
| dataClassification | confidential | ⚠ Manipulation = systematisch falsche Messungen, undetektiert |
| encryptionAtRest | none (angenommen) | ⚠ Klartext im Flash? Manipulationsschutz? |
| accessControlMechanism | process_enforced | Nur P-1 und P-3 via Kalibrierkommandos |
| integrityProtection | none | ⚠ Hochrisiko: kein HMAC auf Kalibrierparameter |
| deletionMechanism | none | Kalibrierung ist permanent |

**DS-2 — Flash: Sensor Firmware (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Firmware-Image des Sensor MCU |
| dataClassification | restricted | |
| encryptionAtRest | unbekannt | |
| accessControlMechanism | unbekannt | ⚠ Kann Sensor-Firmware unabhängig geflasht werden? |
| integrityProtection | signature (SOLL) | ⚠ Wird Signatur geprüft? Update-Mechanismus klären |
| deletionMechanism | overwrite | Via Firmware-Update-Prozess |

**DS-3 — Flash: Alarm-Konfiguration (Controller MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Rauchschwellwerte, Voralarm-Schwelle, Alarmverzögerungen, Zoneninfo |
| dataClassification | confidential | ⚠ Schwellwert manipuliert = kein Alarm oder Daueralarm |
| encryptionAtRest | none | |
| accessControlMechanism | process_enforced | Nur via P-6 (nach Auth). Nicht direkt via RS485 änderbar |
| integrityProtection | none | ⚠ Kein HMAC auf Schwellwerte |
| deletionMechanism | factory_reset | Factory Reset setzt Standardkonfiguration |

**DS-4 — Flash: Controller Firmware**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | Firmware-Image Controller MCU — Security-Anker des Systems |
| dataClassification | restricted | |
| encryptionAtRest | none / encrypted? | ⚠ Firmware verschlüsselt gespeichert? |
| accessControlMechanism | process_enforced | Nur P-5 (Firmware Update Manager) + Bootloader |
| integrityProtection | signature (SOLL) | ⚠ Secure Boot muss Firmware-Signatur prüfen |
| deletionMechanism | overwrite | Via P-5. Rollback-Image vorhanden? |

**DS-5 — Flash: Device Config / Credentials**

| Property | Wert | Hinweis |
|----------|------|---------|
| technology | flash | WLAN-Credentials, Gerätekennwort, Netzwerkeinstellungen, Zertifikate |
| dataClassification | confidential | ⚠ Credentials im Klartext? |
| encryptionAtRest | none (angenommen) | ⚠ Passwörter gehasht? CRA §1(3) |
| accessControlMechanism | process_enforced | Nur P-6 (Auth) nach erfolgreicher Authentifizierung |
| integrityProtection | none | ⚠ Config-Manipulation via Debug möglich |
| deletionMechanism | factory_reset | Factory Reset löscht Credentials und Netzwerkconfig |

---

## 6  Schnittstellen (Interfaces)

**IF-1 — SPI: CB-1 ↔ CB-2 (intern)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | custom | SPI-Bus intern. Sensor MCU ↔ Controller MCU |
| exposureLevel | EL0 | Vollständig intern, Chip-zu-Chip |
| accessControl | none | Interner Bus, kein logischer Schutz |
| location | on_board | PCB-Leiterbahn, physisch nicht zugänglich ohne Gehäuse öffnen |

**IF-2 — RS485: Controller ↔ Brandmeldezentrale**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | RS485, Standard-Brandmeldeprotokoll |
| exposureLevel | EL2 | Lokales Brandmeldenetz |
| accessControl | none | ⚠ Kein logischer Zugriffsschutz |
| location | field_cable | Externes Kabel im Gebäude — physisch zugänglich (Abziehen = DoS) |

**IF-3 — WLAN 802.11: Controller**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | wifi | AP-Modus (Wartung) + Station-Modus (Update-Server) |
| exposureLevel | EL3 | Lokales WLAN, physische Nähe erforderlich |
| accessControl | credentials (WPA2) | ⚠ WPA2 oder WPA3? Passwort-Stärke? |
| location | wireless_local | ⚠ RF-Jamming / 802.11 Deauth ohne Netzwerkzugang möglich (DoS) |

**IF-4 — Alarm Relay Output**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | gpio | Digitaler Ausgang — Alarm-Relais schaltet Sirene/Sprinkler |
| exposureLevel | EL1 | Physisch zugänglich aber kein Protokoll-Angriff möglich |
| accessControl | none | Elektrisches Signal, kein digitaler Schutz |
| location | in_enclosure | Intern im Gerät bis zum Klemmanschluss |

**IF-5 — Debug UART: CB-1 (Sensor MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | Physische Debug-Schnittstelle Sensor MCU |
| exposureLevel | EL1 | Physischer Zugang, Gehäuse öffnen erforderlich |
| accessControl | none (angenommen) | ⚠ Debug in Produktion deaktiviert? |
| location | on_board | Intern, Leiterplatte |

**IF-6 — Debug UART: CB-2 (Controller MCU)**

| Property | Wert | Hinweis |
|----------|------|---------|
| type | serial | Physische Debug-Schnittstelle Controller MCU |
| exposureLevel | EL1 | |
| accessControl | none (angenommen) | ⚠ Debug in Produktion deaktiviert? |
| location | on_board | Intern, Leiterplatte |

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

**DF-2 — Kalibrierkommandos: CB-2 → CB-1 (P-3 → P-1)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | custom | SPI-Bus intern, Kalibrierparameter-Schreibzugriff |
| direction | bidirectional | Kommandos + Bestätigung |
| frequency | ondemand | Nur bei Wartung/Kalibrierung |
| encryptionInTransit | none | ⚠ Kalibrierparameter ungeschützt übertragen |
| integrityProtection | none | ⚠ Manipulierte Kalibrierkommandos undetektiert möglich |
| location | on_board | |

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

**DF-5 — Konfiguration: EE-2 → P-6/P-3 (WLAN/HTTPS)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https | WLAN, Browser-basiert oder Wartungs-App |
| direction | bidirectional | Konfiguration lesen und schreiben |
| frequency | ondemand | Nur bei Wartung |
| encryptionInTransit | tls (angenommen) | ⚠ Selbst-signiertes Zertifikat? Validierung? |
| integrityProtection | hmac | TLS-Verbindung bietet HMAC-basierte Integrität |
| endpointAuthentication | token / password | Passwort-Auth. Brute-Force-Schutz? |
| location | wireless_local | ⚠ Deauth-Attack möglich → Wartung unterbrochen |
| redundancy | degraded | Gerät funktioniert weiter, nur Konfigurationszugang weg |

**DF-6 — Firmware Update: EE-3 → P-5 (WLAN)**

| Property | Wert | Hinweis |
|----------|------|---------|
| protocol | https / custom | Download vom Sigrist Update Server |
| direction | unidirectional | Pull (Gerät initiiert) oder Push? |
| frequency | ondemand | |
| encryptionInTransit | tls (angenommen) | ⚠ Zertifikat-Pinning? |
| integrityProtection | signature (SOLL) | ⚠ KRITISCH: Firmware-Signatur vor Flash prüfen? |
| endpointAuthentication | certificate (angenommen) | ⚠ Update-Server authentifiziert? |
| location | internet | Update-Server ist extern — höchste Expositionsstufe |
| redundancy | none | Fehlgeschlagenes Update: Fallback-Image vorhanden? |

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

Rauchschwellwerte, Alarmverzögerungen, Zonenidentifikation. Falscher Schwellwert = kein Alarm bei Rauch oder Daueralarm ohne Rauch.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | low | **critical** | **critical** | high | **critical** |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | **C** | **C** | H | **C** | M | **C** |

---

**A-4 — Controller Firmware** *(Data)* 🔴 High Value Asset

Firmware-Image des Controller MCU. Enthält Alarmlogik, Protokoll-Stacks, Auth, WLAN. Kompromittierung = vollständige Geräteübernahme.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | medium | **critical** | high | low | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | **C** | **C** | H | H | **C** | **C** |

---

**A-5 — Sensor Firmware** *(Data)*

Firmware des Sensor MCU. Kompromittierung = falsche Messwerte ohne Alarm.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | low | **critical** | medium | low | medium |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | H | H | M | H | H | **H** |

---

**A-6 — Auth Credentials / Passwörter** *(Data)*

Wartungszugangskredentiale, WLAN-Passwort, Admin-Passwort. Kompromittierung ermöglicht unautorisierte Konfigurationsänderungen → Safety-Impact via A-3.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | **critical** | **critical** | medium | medium | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | M | H | M | H | M | **H** |

> Safety=M (indirekt): Credentials kompromittiert → A-3 manipulieren → Alarm fällt aus.

---

**A-7 — Device Config / Netzwerkeinstellungen** *(Data)*

WLAN-Konfiguration, IP-Einstellungen, Zonenname. Kein direkter Safety-Impact.

| CIANAAA | C | I | A | N | Acc |
|---------|---|---|---|---|-----|
| | medium | medium | medium | low | low |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | L | M | L | L | M | **M** |

---

### 8.2  Function Assets

**A-8 — Rauchdetektionsfunktion** *(Function)* 🔴 High Value Asset

Die Kernfähigkeit des Geräts: Rauchpartikel optisch erkennen und korrekt klassifizieren. 24/7 verfügbar, kein Ausfall tolerierbar.

| CIANAAA | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|-------|-------|-----|
| | **critical** | **critical** | high | medium | high | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | **C** | **C** | **C** | **C** | H | **C** |

---

**A-9 — Alarmauslösefunktion** *(Function)* 🔴 High Value Asset

Fähigkeit, bei erkanntem Rauch die Brandmeldezentrale zu alarmieren und das Alarm-Relay zu schalten. Non-Repudiation kritisch: Alarmauslösung muss nach Brandereignis beweisbar sein.

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

Ablauf des Firmware-Downloads, der Signaturprüfung und des Flash-Vorgangs. Kompromittierung ermöglicht dauerhafte Geräteübernahme via Malicious Firmware.

| CIANAAA | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|-------|-------|-----|
| | **critical** | medium | high | **critical** | **critical** | high |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | H | H | M | H | H | **H** |

---

**A-11 — Sigrist Update Server** *(Service)* 🔴 High Value Asset

Externer Dienst der authentische Firmware bereitstellt. Kompromittierung betrifft alle im Feld befindlichen Geräte (Supply-Chain-Angriff).

| CIANAAA | C | I | A | N | AuthN | AuthZ | Acc |
|---------|---|---|---|---|-------|-------|-----|
| | medium | **critical** | high | medium | **critical** | **critical** | medium |

| Impact | Safety | Operat. | Financ. | Regulat. | Recov. | **Max** |
|--------|--------|---------|---------|----------|--------|---------|
| | **C** | H | H | H | **C** | **C** |

> Rec=C: kompromittierter Update-Server betrifft alle Geräte gleichzeitig — systemischer Supply-Chain-Angriff.

---

## 9  Beziehungen

### 9.1  Element → Asset

| Von | Beziehung | Nach | Asset-Name | Begründung |
|-----|-----------|------|------------|------------|
| P-1 | creates | A-1 | Rauchsensormessung | Measurement Controller erzeugt den primären Messwert |
| DS-1 | stores | A-2 | Kalibrierparameter | Sensor-Flash speichert die Kalibrierkoeffizienten |
| P-2 | monitors | A-2 | Kalibrierparameter | Diagnostic Controller überwacht Sensor-Drift |
| P-3 | reads | A-1 | Rauchsensormessung | Alarm Processing liest Messwert für Entscheidung |
| DS-3 | stores | A-3 | Alarm-Konfiguration | Controller-Flash speichert Schwellwerte |
| P-3 | reads | A-3 | Alarm-Konfiguration | Alarm Processing liest Schwellwerte |
| P-3 | executes | A-8 | Rauchdetektionsfunktion | Alarm Controller führt die Detektionsfunktion aus |
| P-3 | executes | A-9 | Alarmauslösefunktion | Alarm Controller löst Alarm aus |
| DS-4 | stores | A-4 | Controller Firmware | Controller-Flash enthält das Firmware-Image |
| DS-2 | stores | A-5 | Sensor Firmware | Sensor-Flash enthält Sensor-Firmware |
| DS-5 | stores | A-6 | Auth Credentials | Device Config Flash speichert Zugangskredentiale |
| DS-5 | stores | A-7 | Device Config | Netzwerkeinstellungen und Gerätekonfiguration |
| P-5 | executes | A-10 | Firmware-Update-Prozess | Firmware Update Manager führt Update-Prozess aus |
| P-5 | modifies | DS-4 | Controller Firmware | Update Manager überschreibt Firmware-Flash |
| EE-3 | exposes | A-11 | Sigrist Update Server | Update Server exponiert Firmware-Artefakte |

### 9.2  Asset → Asset

| Von | Beziehung | Nach | Begründung / Threat-Implikation |
|-----|-----------|------|--------------------------------|
| A-8 | depends_on | A-1 | Rauchdetektionsfunktion braucht aktuellen Messwert — kein Messwert = blind |
| A-8 | depends_on | A-3 | Funktion braucht Schwellwerte — manipulierter Schwellwert = falsche Alarmgrenze |
| A-1 | derives_from | A-2 | Messwert basiert auf Kalibrierung — falsche Kalibrierung = falscher Messwert |
| A-9 | depends_on | A-8 | Alarmauslösung braucht korrekte Detektion — A-8 Ausfall = kein Alarm |
| A-9 | depends_on | A-3 | Alarmauslösung braucht Schwellwert — direkter Safety-Impact bei Manipulation |
| A-8 | depends_on | A-4 | Funktion läuft auf Controller Firmware — kompromittierte FW = Funktion kompromittiert |
| A-10 | depends_on | A-11 | Update-Prozess braucht Trust Anchor — kompromittierter Server = falsches Firmware |
| A-4 | depends_on | A-11 | Firmware-Integrität hängt am Update-Server-Trust-Anchor — Supply Chain Risiko |

---

## 10  Key Findings & Workshop-Aha-Moments

Diese Befunde eignen sich als Diskussionspunkte im Live-Durchlauf:

### 🔴 Kalibrierparameter — stiller Angriff
A-2 hat I=critical, aber Rec=low auf Messwertebene. Ein Angreifer der DS-1 via
TB-4 (Debug) manipuliert, verändert die Rauchsensitivität dauerhaft und
undetektiert. Kein Alarm, kein Fehlerzustand — der Rauchmelder **scheint zu
funktionieren**.

### 🔴 Alarmauslösefunktion — N=critical
A-9 ist der einzige Asset mit Non-Repudiation=critical. Nach einem Brandereignis
muss beweisbar sein dass der Alarm ausgelöst wurde (Haftung, Versicherung,
Strafverfolgung). Fehlendes Audit-Log = kritischer Compliance-Befund.

### 🟠 RS485 field_cable — DoS ohne Netzwerkzugang
DF-3 hat location=field_cable + redundancy=none. Kabel abziehen = Alarm
erreicht Brandmeldezentrale nicht. Kein Werkzeug, kein Netzwerkzugang,
2 Sekunden physischer Zugang. **Dieser DoS-Vektor wird durch reine
Software-Analyse nicht sichtbar.**

### 🟠 Update Server Trust Anchor — Supply Chain
A-11 hat Rec=critical: ein kompromittierter Update Server betrifft alle im Feld
befindlichen Geräte gleichzeitig. Kleinste Angriffs-Investition, grösste Wirkung.

### 🟡 WLAN Deauth — Wartungs-DoS
DF-5 hat location=wireless_local. Ein 802.11 Deauth-Frame (30 CHF Tool, keine
Auth) unterbricht den Wartungszugang des Technikers. Gerät funktioniert weiter,
aber Fernkonfiguration unmöglich.

---

*TARAflow Referenzbeispiel — Sigrist Rauchmelder*
*Vertraulich — nur für Workshop-Nutzung*
