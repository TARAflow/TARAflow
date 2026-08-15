# TARAflow — Element Properties Referenz

**Sigrist Photometer AG | TurBiScat PM 40 / SiDis AD 40**  
Vollständige Beschreibung aller Properties pro DFD-Elementtyp, inkl. zulässiger Werte und Beispiele.

---

## Globale Typen

### ExposureLevel

Gibt an, wie exponiert ein Element oder ein Datenfluss ist. Wird von Interfaces und DataFlows getragen und bestimmt die Angriffsfläche.

| Wert | Bedeutung | Typisches Beispiel |
|------|-----------|-------------------|
| `EL0` | **Internal** — vollständig isoliert, kein externer Zugang | Interne SPI-Bus-Verbindung zwischen zwei ICs |
| `EL1` | **Physical** — Zugang nur durch direkten physischen Kontakt | UART Debug-Pin auf der Leiterplatte, M12-Stecker am Gerät |
| `EL2` | **Local** — erreichbar über lokales OT/Produktionsnetzwerk | Profibus-Segment, Modbus TCP im Maschinennetzwerk |
| `EL3` | **Adjacent** — erreichbar über erweitertes Fabrik-/Unternehmensnetz | OT-IT-Übergangszone, WLAN im Werksgelände |
| `EL4` | **Public** — erreichbar über nicht-vertrauenswürdige externe Netze | Internet, Remote-Access, Cloud-Backend |

### PhysicalExposureLevel (PEL)

**Beschreibt physische Erreichbarkeit** — semantisch getrennt von ExposureLevel.
Verwendet auf `PhysicalBoundary`. Höher = stärker exponiert, analog zu EL.

| Wert | Label | Bedeutung | Beispiel |
|------|-------|-----------|---------|
| `PEL0` | Inaccessible | Zerstörung nötig — vergossen, verschweisst | Vergossenes HSM |
| `PEL1` | Deep Internal | Mehrere physische Barrieren | JTAG hinter 2 Gehäusen |
| `PEL2` | Internal | Eine Barriere (Gehäuse, Schloss, Schrauben) | LAN-Port hinter Gerätegehäuse |
| `PEL3` | Surface Accessible | Von aussen erreichbar, nicht direkt benutzbar | Serviceklappe, versenkte Buchse |
| `PEL4` | Directly Exposed | Keine Barriere — sofort benutzbar | Touchscreen, Outdoor-USB |

> **Faustregel:** Je höher der EL-Wert, desto grösser die Angriffsfläche → desto mehr Sicherheitsmassnahmen erforderlich.

---

## 1. Process Properties

Gilt für: alle funktionalen Blöcke innerhalb einer Chip Boundary (P-1 bis P-14).

### 1.1 `technology`
**Typ:** Auswahl  
**Zweck:** Implementierungstyp des Prozesses. Bestimmt die zutreffenden Threat-Templates.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `api` | REST/GraphQL API-Endpunkt | — |
| `batch` | Stapelverarbeitung | — |
| `ui` | Benutzeroberfläche | Display/Touch Controller (P-14) |
| `microservice` | Microservice-Architektur | — |
| `lambda` | Serverless-Funktion | — |
| `daemon` | Hintergrunddienst | Firmware Update Manager (P-8), Data Logger (P-5) |
| `websocket` | WebSocket-Verbindung | — |
| `event` | Event-getriebene Verarbeitung | — |
| `cli` | Kommandozeilenprogramm | — |
| `database` | Datenbankprozess | — |
| `cron` | Zeitgesteuerter Job | — |
| `iot` | IoT-Gerät/Prozess | — |
| `rtos_task` | RTOS-Task (FreeRTOS, Zephyr, ThreadX) | Limit Monitor (P-3), Web Server (P-7) |
| `bare_metal` | Bare-Metal Logikblock / Main-Loop | Measurement Controller (P-11) |
| `isr` | Interrupt Service Routine | — |
| `state_machine` | Sicherheitsrelevante FSM | — |
| `bootloader` | Bootloader — eigene Bedrohungsklasse (Firmware-Integrität) | — |
| `driver` | Hardware-Treiber — oft HW-nah, geringe Validierung | — |
| `protocol_stack` | Protokoll-Stack — eigene Angriffsfläche | Modbus RTU Master (P-1), Communication Controller (P-6) |

---

### 1.2 `processSemantic`
**Typ:** Auswahl  
**Zweck:** Semantische Rolle des Prozesses im Modell. Trennt Implementierungstyp von Modellierungsabsicht.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `execution_unit` | OS-Prozess, RTOS-Task, Thread — OS-erzwungene Isolation | Web Server / HMI (P-7) |
| `functional_block` | Logische Verantwortungseinheit — keine OS-Isolation (Bare-Metal, ISR) | Measurement Controller (P-11), Data Logger (P-5) |
| `security_boundary` | Expliziter Security-Enforcement-Point (HSM, Crypto Engine, Auth-Dienst) | Auth (P-9) |

---

### 1.3 `runsAs`
**Typ:** Auswahl  
**Zweck:** Unter welchem Sicherheitskontext / welcher Identität läuft der Prozess.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt / nicht analysiert |
| `user` | Normaler Benutzerkontext |
| `admin_user` | Administrativer Benutzer |
| `root` | Root-Kontext (höchste Privilegien) |
| `system` | System-Dienst (kein interaktiver Benutzer) |
| `service` | Dedizierter Service-Account |
| `guest` | Gastkontext (minimale Rechte) |
| `anonymous` | Anonym, nicht authentifiziert |
| `contractor` | Externer Dienstleister |

**Beispiel:** P-7 (Web Server) → `service`, P-8 (Firmware Update Manager) → `system`

---

### 1.4 `privilegeLevel`
**Typ:** Auswahl  
**Zweck:** Effektive Privilegienstufe des Prozesses — bestimmt Schadwirkung bei Kompromittierung.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt |
| `low` | Minimale Rechte, stark eingeschränkt |
| `medium` | Normale Benutzerrechte |
| `high` | Erweiterte Rechte (Schreibzugriff auf kritische Daten) |
| `root` | Voller Systemzugriff |

**Faustregeln:**  
- Prozesse mit `high` oder `root` sind bevorzugte Angriffsziele (Privilege Escalation).  
- P-8 (Firmware Update Manager): `root` — Flash-Schreibzugriff benötigt höchste Privilegien.

---

### 1.5 `authenticationRequired`
**Typ:** Auswahl  
**Zweck:** Welches Authentifizierungsverfahren muss ein Aufrufer vorweisen, bevor der Prozess Anfragen bearbeitet.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt |
| `no` | Keine Authentifizierung — jeder kann zugreifen |
| `yes` | Authentifizierung erforderlich (Verfahren unspezifiziert) |
| `optional` | Authentifizierung optional (reduzierte Funktionalität ohne Auth) |
| `oauth` | OAuth 2.0 Token |
| `saml` | SAML Assertion |
| `certificate` | Client-Zertifikat (X.509) |
| `apikey` | API-Key / Pre-shared Key |
| `jwt` | JSON Web Token |
| `mtls` | Mutual TLS — beidseitige Zertifikatauthentifizierung |

**Beispiel:** P-7 (Web Server) → `yes`, P-1 (Modbus RTU Master) → `no`

---

### 1.6 `authorizationModel`
**Typ:** Auswahl  
**Zweck:** Wie wird nach erfolgreicher Authentifizierung gesteuert, was ein Aufrufer darf.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt |
| `none` | Keine Autorisierung — nach Auth ist alles erlaubt |
| `rbac` | Role-Based Access Control |
| `abac` | Attribute-Based Access Control |
| `acl` | Access Control List |
| `custom` | Proprietäre Implementierung |

---

### 1.7 `inputValidation`
**Typ:** Auswahl  
**Zweck:** Wie strikt werden Eingabedaten validiert bevor sie verarbeitet werden. Beeinflusst Injection-Risiken.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt |
| `none` | Keine Validierung — alle Eingaben werden verarbeitet |
| `basic` | Basischecks (Länge, Typ, Nullwerte) |
| `strict` | Strikte Validierung (Whitelist, Bereichsgrenzen, Format) |
| `schema` | Schema-basierte Validierung (JSON Schema, XSD, Protobuf) |

**Sicherheitsrelevanz:** Fehlende Validierung auf Feldbus-Eingaben (P-6) kann Buffer Overflows ermöglichen.

---

### 1.8 `errorHandling`
**Typ:** Auswahl  
**Zweck:** Wie werden Fehler nach aussen kommuniziert — relevant für Information Disclosure.

| Wert | Bedeutung |
|------|-----------|
| `not_specified` | Nicht bekannt |
| `silent` | Fehler werden unterdrückt / nicht geloggt |
| `verbose` | Vollständige Fehlermeldungen inkl. Stack Traces (⚠ Information Disclosure) |
| `sanitized` | Fehler werden geloggt, aber nur generische Meldungen nach aussen |

**Best Practice:** `sanitized` — interne Details ins Log, generische Meldung an den Client.

---

### 1.9 `securityControls`
**Typ:** Freitext  
**Zweck:** Dokumentation bereits implementierter Sicherheitsmassnahmen auf diesem Prozess.  
**Beispiel:** `"Rate limiting: max 10 login attempts/min, account lockout after 5 failures"`

---

### 1.10 `exposedToInternet`
**Typ:** Boolean (`true` / `false`)  
**Zweck:** Ist der Prozess direkt über das Internet erreichbar?  
**Beispiel:** P-7 (Web Server via WLAN AP) → `true`

---

### 1.11 `owner`
**Typ:** Freitext  
**Zweck:** Verantwortlicher Entwickler / Team für diesen Prozess.  
**Beispiel:** `"Embedded Team — Sigrist Photometer AG"`

---

### 1.12 `notes`
**Typ:** Freitext  
**Zweck:** Freie Anmerkungen, Workshop-Beobachtungen, offene Fragen.

---

## 2. Trust Boundary Properties

Gilt für: TB-1 bis TB-4.

### 2.1 `boundaryId`
**Typ:** Freitext  
**Zweck:** Eindeutige ID der Grenze für Referenzierung in anderen Dokumenten.  
**Beispiel:** `"TB-1"`, `"TB-SENSOR-CTRL"`

---

### 2.2 `boundaryType`
**Typ:** Auswahl  
**Zweck:** Klassifizierung der Vertrauensgrenze nach Typ.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `network` | Netzwerkgrenze zwischen unterschiedlich vertrauenswürdigen Segmenten | TB-2 (OT-Netz), TB-3 (WLAN) |
| `privilege` | Privilegiengrenze (User → Admin, Userspace → Kernel) | — |
| `organization` | Grenze zwischen Organisationen | — |
| `cloud` | Grenze zu Cloud-Diensten | — |
| `physical` | Physische Zugangskontrollgrenze | — |
| `legal` | Rechtliche / vertragliche Grenze | — |
| `device` | Gerätegrenze (Embedded Device ↔ Host) | — |
| `peripheral` | MCU ↔ externer Chip (SPI, I2C, UART Sensor/EEPROM) | **TB-1** (SiDis ↔ TurBiScat via UART) |
| `boot` | Bootloader ↔ Application-Grenze | — |
| `debug` | Debug-/Programmier-Interface (SWD, JTAG, UART Console) | **TB-4** (Debug-Schnittstellen) |

---

### 2.3 `defaultExposureLevel`
**Typ:** ExposureLevel (`EL0`–`EL4`)  
**Zweck:** Standard-Expositionsniveau für alle Datenflüsse, die diese Grenze kreuzen.  
**Beispiel:** TB-1 → `EL1`, TB-3 → `EL3`

---

### 2.4 `securityAssumptions`
**Typ:** Freitext  
**Zweck:** Explizite Annahmen über den Schutzzustand dieser Grenze. Müssen begründet und auditierbar sein.  
**Beispiel:** `"Physisch geschlossenes Gehäuse (IP66). UART intern, kein externer Zugang ohne Öffnen."`

---

### 2.5 `boundaryControls`
**Typ:** Freitext  
**Zweck:** Welche Sicherheitsmassnahmen sind an dieser Grenze implementiert.  
**Beispiel:** `"WPA2-Authentifizierung, HTTPS, Passwortschutz"` (TB-3)  
**Gegenbeispiel:** `"keine"` (TB-1 — kritischer Befund!)

---

### 2.6 `monitoringEnabled`
**Typ:** Boolean (`true` / `false`)  
**Zweck:** Wird Verkehr über diese Grenze überwacht / geloggt?  
**Sicherheitsrelevanz:** Ohne Monitoring sind Angriffe auf diese Grenze undetektiert.

---

### 2.7 `complianceRelevance`
**Typ:** Freitext  
**Zweck:** Welche regulatorischen Anforderungen sind an dieser Grenze relevant.  
**Beispiel:** `"CRA Anhang I §1(3): Schutz vor unbefugtem Zugriff auf Kommunikationskanäle. NIS-2 Art. 21."`

---

### 2.8 `owner`
**Typ:** Freitext  
**Zweck:** Verantwortliche Person / Team für diese Grenze.

---

### 2.9 `notes`
**Typ:** Freitext

---

## 3. Chip Boundary Properties

Gilt für: CB-1 (EG_Core MCU, SiDis), CB-2 (Sensor MCU, TurBiScat).

### 3.1 `chipType`
**Typ:** Auswahl  
**Zweck:** Hardware-Typ des Chips. Bestimmt die generierten Bedrohungsklassen.

| Wert | Bedeutung | Generierte Bedrohungen |
|------|-----------|----------------------|
| `mcu` | Mikrocontroller (STM32, NXP, Renesas) | Firmware Tampering, JTAG Access, Secure Boot Bypass |
| `som` | System-on-Module (Toradex, RPi CM, Variscite) | Firmware Tampering, JTAG Access, Secure Boot Bypass |
| `fpga` | FPGA (Xilinx, Intel/Altera, Lattice) | Bitstream Tampering, Readback Attack, Partial Reconfiguration |
| `se` | Secure Element (ATECC608, SLB9670) | Key Extraction, Side Channel Attack, Physical Tampering |
| `hsm` | Hardware Security Module | Key Extraction, Side Channel Attack, Physical Tampering |
| `dsp` | Digital Signal Processor | Firmware Tampering, JTAG Access (wie MCU) |

**Beispiel:** CB-1, CB-2 → `mcu`

---

### 3.2 `defaultExposureLevel`
**Typ:** ExposureLevel (`EL0`–`EL4`)  
**Zweck:** Standard-Expositionsniveau für Interfaces auf dieser Chip Boundary.  
**Faustregel:** SE/HSM → `EL0`; MCU/SOM/FPGA → `EL1` (Disassemblierung erforderlich).

---

### 3.3 `debugInterfacePresent`
**Typ:** Auswahl  
**Zweck:** Welcher Debug-/Programmier-Interface-Typ ist auf dem Chip bestückt.

| Wert | Bedeutung | Capability |
|------|-----------|-----------|
| `none` | Kein Debug-Interface (oder vollständig deaktiviert) | — |
| `jtag` | Full JTAG | CPU halt, Memory access, Flash R/W |
| `jtag_trace` | JTAG + Trace Port (ETM) | Full debug + Instruction trace |
| `swd` | SWD (ARM Cortex) | Ähnliche Capabilities wie JTAG |
| `swd_swo` | SWD + SWO | Debug + leichtgewichtiger Software-Trace (ITM) |
| `custom` | Proprietäres Debug-Interface | — |

**⚠ Sicherheitsrelevanz:** JTAG/SWD = voller Zugriff auf Firmware, Speicher und Keys bei geöffnetem Gerät.

---

### 3.4 `debugInterfaceLocked`
**Typ:** Boolean (`true` / `false`)  
**Zweck:** Ist das Debug-Interface in Produktion gesperrt/deaktiviert?  

| Wert | Bedeutung |
|------|-----------|
| `true` | Gesperrt — z.B. STM32 RDP Level ≥ 1, FPGA JTAG-Fuse gebrannt |
| `false` | ⚠ Offen — Interface zugänglich, Firmware-Extraktion möglich |

**Regulatorisch:** CRA Anhang I §1(3) fordert Schutz vor unbefugtem Zugriff — offene Debug-Interfaces in Produktion sind ein Befund.

---

### 3.5 `secureBootEnabled`
**Typ:** Boolean (`true` / `false`)  
**Zweck:** Ist Secure Boot aktiv — d.h. wird die Boot-Chain kryptographisch verifiziert?  

| Wert | Bedeutung |
|------|-----------|
| `true` | Boot-Chain wird verifiziert (Root of Trust → Bootloader → Firmware) |
| `false` | ⚠ Kein Secure Boot — Bootloader Tampering Threat wird automatisch generiert |

**⚠ Wenn `false`:** Angreifer kann beliebige Firmware flashen. Ohne Secure Boot ist `firmwareProtection` die einzige Hürde.

---

### 3.6 `firmwareProtection`
**Typ:** Auswahl  
**Zweck:** Schutz der Firmware vor Readback und Manipulation. Spezifisch für MCU/SOM (nicht FPGA).

| Wert | Bedeutung |
|------|-----------|
| `none` | Kein Schutz — Firmware lesbar und ersetzbar |
| `rdp_level1` | STM32 RDP Level 1: Readback deaktiviert, Debug eingeschränkt |
| `rdp_level2` | STM32 RDP Level 2: JTAG vollständig deaktiviert, Mass Erase bei Tamper |
| `locked` | Generisch: Write-Protected, kein Debug |
| `encrypted` | Firmware-Image ist verschlüsselt gespeichert |

**Empfehlung für Produktion:** Mindestens `rdp_level1`, idealerweise `rdp_level2` + `secureBootEnabled: true`.

---

### 3.7 `bitstreamEncryption`
**Typ:** Boolean (`true` / `false`)  
**Zweck:** Nur relevant wenn `chipType = fpga`. FPGA-Bitstream verschlüsselt?  
**Wenn `false`:** Bitstream Readback / Reverse Engineering Threat wird generiert.

---

### 3.8 `tamperProtection`
**Typ:** Auswahl  
**Zweck:** Physischer Manipulationsschutz auf Chip- oder Modul-Ebene.

| Wert | Bedeutung |
|------|-----------|
| `none` | Kein Tamper-Schutz |
| `basic` | Gehäuseversiegelung, Tamper-evident-Label, Vergussmasse (Potting) |
| `active` | Aktive Tamper-Erkennung: Spannungsglitch, Temperatur, Mesh-Sensor |

**Beispiel:** CB-1, CB-2 → `basic` (IP66-Gehäuse, kein aktiver Sensor bekannt)

---

### 3.9 `supplyChainTrust`
**Typ:** Auswahl  
**Zweck:** Vertrauen in die Chip-Lieferkette. Relevant für Hardware Trojan Threat und SOM-Vendor-Vertrauen.

| Wert | Bedeutung |
|------|-----------|
| `verified` | Autorisierter Distributor, Rückverfolgbarkeit bestätigt |
| `unverified` | Unbekannte oder Graumarkt-Quelle |
| `unknown` | Nicht bewertet |

---

### 3.10 `safetyRelevant`
**Typ:** Boolean  
**Zweck:** Enthält oder unterstützt dieser Chip sicherheitsrelevante Hardware-Funktionen (im Sinne von Funktionaler Sicherheit).  
**In diesem Projekt:** `false` (Safety wird nicht bewertet).

---

### 3.11 `notes`
**Typ:** Freitext

---

## 4. External Entity Properties

Gilt für: EE-1 bis EE-5.

### 4.1 `entityType`
**Typ:** Auswahl  
**Zweck:** Kategorisierung der externen Entität.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `user` | Menschlicher Endbenutzer | EE-1 (Smartphone Operator) |
| `admin_user` | Administrativer Benutzer | EE-1 (wenn Techniker) |
| `partner` | Partnerunternehmen | — |
| `thirdparty` | Drittanbieter | — |
| `service` | Automatisierter Dienst / Backend | EE-2 (Update Server), EE-3 (OT Master) |
| `identity_provider` | Identitätsprovider (LDAP, OAuth IDP) | — |
| `payment` | Zahlungsdienstleister | — |
| `contractor` | Externer Dienstleister | EE-4 (Debug User) |
| `bot` | Automatisierter Agent | — |
| `webhook` | Webhook-Endpunkt | — |
| `mobile_app` | Mobile Applikation | — |
| `iot` | IoT-Gerät | EE-3 (wenn PLC als IoT-Gerät) |

---

### 4.2 `trustLevel`
**Typ:** Auswahl (`low` / `medium` / `high`)  
**Zweck:** Wie vertrauenswürdig ist diese Entität? Beeinflusst die Bedrohungsbewertung.

| Wert | Wann vergeben |
|------|--------------|
| `low` | Unbekannte externe Partei, Internet-User, nicht authentifiziert |
| `medium` | Bekannte Partei mit Auth, aber nicht vollständig kontrolliert |
| `high` | Vollständig kontrolliert, interner Akteur, starke Vertragsbeziehung |

---

### 4.3 `authenticationMethod`
**Typ:** Auswahl  
**Zweck:** Wie authentifiziert sich diese Entität gegenüber dem System.

| Wert | Bedeutung |
|------|-----------|
| `none` | Keine Authentifizierung |
| `password` | Passwort-basiert |
| `mfa` | Multi-Faktor-Authentifizierung |
| `oauth` | OAuth 2.0 |
| `saml` | SAML 2.0 |
| `certificate` | Client-Zertifikat (X.509) |
| `apikey` | API-Key |
| `mutual_tls` | Mutual TLS |
| `jwt` | JSON Web Token |

---

### 4.4 `authorizationScope`
**Typ:** Freitext  
**Zweck:** Welche Operationen darf diese Entität ausführen.  
**Beispiel:** `"Lesen: alle Messwerte. Schreiben: Kalibrierung nur nach Auth als Techniker."`

---

### 4.5 `ownership`
**Typ:** Auswahl (`internal` / `external` / `partner`)  
**Zweck:** Wem gehört / wer kontrolliert diese Entität.

---

### 4.6 `threatActor`
**Typ:** Auswahl  
**Zweck:** Wie ist die Bedrohungsabsicht dieser Entität einzuschätzen — beeinflusst Attack-Tree-Feasibility.

| Wert | Bedeutung |
|------|-----------|
| `benign` | Keine Bedrohungsabsicht — rein legitimer Akteur |
| `curious` | Neugierig, probiert Grenzen aus, aber keine destruktive Absicht |
| `malicious` | Aktive Angreiferabsicht |
| `advanced` | APT (Advanced Persistent Threat), staatlich, hochqualifiziert |
| `insider` | Innentäter mit legitimem Zugang |
| `compromised` | Legitimer Akteur, dessen Account / System kompromittiert wurde |

---

### 4.7 `contractExists`
**Typ:** Boolean  
**Zweck:** Besteht ein Vertrag / SLA mit dieser Entität?  
**Relevanz:** Vertragliche Bindung beeinflusst rechtliche Haftung und Compliance.

---

### 4.8 `rateLimited`
**Typ:** Boolean  
**Zweck:** Ist der Zugriff dieser Entität rate-limitiert (Schutz vor Brute Force / DoS)?

---

### 4.9 `threatProfile` (zusammengesetzt)
**Typ:** Objekt  
**Zweck:** Deterministische Angriffsbaum-Feasibility-Bewertung für Phase 3 (Attack Tree).

#### `threatProfile.category`

| Wert | Bedeutung | Basis-Feasibility |
|------|-----------|------------------|
| `public_network` | Internet, unauthentifizierter Remote-Zugang | `very_high` |
| `corporate_it` | Unternehmensnetz (MES, ERP) — erfordert vorherige IT-Kompromittierung | `medium` |
| `adjacent_wireless` | WLAN, Bluetooth — physische Nähe erforderlich | `high` |
| `local_physical` | USB, HMI vor Ort, lokale Service-Ports | `low` |
| `supply_chain` | Vendor-Updates, Firmware-Signing | `very_low` |
| `authorized_person` | Operator, Wartung mit gültigen Credentials | variabel |

#### `threatProfile.baseFeasibility`

| Wert | Bedeutung |
|------|-----------|
| `very_low` | Sehr hoher Aufwand für Angreifer |
| `low` | Erheblicher Aufwand |
| `medium` | Moderater Aufwand |
| `high` | Geringer Aufwand |
| `very_high` | Trivial ausführbar |

#### `threatProfile.rationale`
**Typ:** Freitext — Begründung gemäss IEC 62443-4-1.  
**Beispiel:** `"WLAN-Zugang erfordert physische Nähe (<50m). Auth vorhanden. Basis-Feasibility: high."`

---

### 4.10 `owner` / `notes`
**Typ:** Freitext

---

## 5. Data Store Properties

Gilt für: DS-1 bis DS-7.

### 5.1 `storedDataTypes`
**Typ:** Freitext  
**Zweck:** Welche Datenkategorien sind in diesem Speicher abgelegt.  
**Beispiel:** `"Kalibrierkoeffizienten, Sensor-Seriennummer, werksseitige Referenzwerte"`

---

### 5.2 `dataClassification`
**Typ:** Auswahl  
**Zweck:** Vertraulichkeitsstufe der gespeicherten Daten.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `public` | Öffentlich zugänglich, kein Schutzbedarf | DS-1 (Prozessdaten), DS-5 (Sensor Public) |
| `internal` | Intern, aber kein aktiver Schutz nötig | DS-4 (LogFiles) |
| `confidential` | Vertraulich — eingeschränkter Zugriff | DS-2 (Config/Passwörter), DS-6 (Kalibrierparameter) |
| `restricted` | Streng vertraulich — sehr eingeschränkter Zugriff | DS-3 (Firmware), DS-7 (Sensor Firmware) |
| `secret` | Höchste Vertraulichkeitsstufe | — (Krypto-Keys, falls separat gespeichert) |

---

### 5.3 `encryptionAtRest`
**Typ:** Auswahl  
**Zweck:** Ist der gespeicherte Inhalt verschlüsselt?

| Wert | Bedeutung |
|------|-----------|
| `none` | Keine Verschlüsselung — Klartext |
| `yes` | Verschlüsselt (Algorithmus unspezifiziert) |
| `aes256` | AES-256 |
| `tde` | Transparent Data Encryption (Datenbank) |
| `kms` | Key Management Service (Cloud) |
| `custom` | Proprietäre Verschlüsselung |

**Empfehlung:** Private Config (DS-2) und Firmware (DS-3) → mindestens `aes256`.

---

### 5.4 `accessControlMechanism`
**Typ:** Auswahl  
**Zweck:** Technischer Mechanismus, der den Zugriff auf diesen Store durchsetzt. Ein DataStore ist passiv — der Enforcement-Mechanismus liegt immer in einem vorgelagerten Prozess oder in Hardware. Diese Property macht explizit *wie* der Schutz realisiert ist, damit Lücken sichtbar werden.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `none` | Kein Zugriffsschutz — physischer Zugang = voller Zugriff | DS-4 (SD-Card ohne Verschlüsselung) |
| `process_enforced` | Zugriff nur über dedizierten Prozess (API-Gate) | DS-2 (nur via P-4 Persistence Controller) |
| `mpu_protected` | MCU Memory Protection Unit isoliert den Speicherbereich | — (falls MCU mit MPU konfiguriert) |
| `os_permissions` | Betriebssystem-Dateiberechtigungen (Linux, RTOS) | — |
| `crypto_erase` | Encryption-as-Access-Control — ohne Key kein Klartext | DS-3 (falls firmware encrypted) |
| `custom` | Proprietärer Mechanismus | — |

> **Designprinzip:** `accessControlMechanism` beschreibt den *Mechanismus* (maschinell auswertbar, Threat-Generator-Input). Das Freitextfeld `accessControl` (s.u.) beschreibt die *Policy* — welche Prozesse dürfen was.

---

### 5.5 `accessControl`
**Typ:** Freitext  
**Zweck:** Policy-Beschreibung — welche Prozesse oder Akteure haben Lese-/Schreibzugriff und unter welchen Bedingungen. Ergänzt `accessControlMechanism`, ersetzt es nicht.  
**Beispiel:** `"Schreibzugriff: nur P-13 (Calibration Controller) via Modbus-Kommando von P-1. Lesezugriff: P-1 (Polling). Kein direkter externer Zugriff ohne physischen Debug-Zugang."`

---

### 5.6 `integrityProtection`
**Typ:** Auswahl  
**Zweck:** Wie ist die Integrität der gespeicherten Daten geschützt? Ein Boolean reicht nicht — Modbus CRC und HMAC-SHA256 sind fundamental unterschiedlich in ihrer kryptographischen Stärke und führen zu völlig anderen Threat-Bewertungen.

| Wert | Kryptographisch? | Manipulationsschutz | Beispiel |
|------|-----------------|--------------------|---------| 
| `none` | Nein | Keiner — Manipulation undetektiert | DS-1 bis DS-7 (aktuell) |
| `crc` | Nein | Erkennt Übertragungsfehler, **nicht** gezielte Manipulation | Modbus-Frame-CRC |
| `hash` | Ja | Erkennt Änderungen, aber kein Schlüssel — Angreifer kann Hash neu berechnen | SHA-256 Prüfsumme |
| `hmac` | Ja | Erkennt Manipulation wenn Key geheim bleibt | HMAC-SHA256 auf Config-Block |
| `signature` | Ja | Stärkste Garantie — asymmetrisch, Signing-Key nie im Gerät | Code-Signing auf Firmware |
| `custom` | ? | Proprietär | — |

**⚠ Wichtig:** `crc` ist **kein** Integritätsschutz gegen Angriffe — nur `hmac` und `signature` schützen vor gezielter Manipulation.  
**Empfehlung:** DS-3 (Firmware) → `signature`, DS-2 (Config) → `hmac`, DS-6 (Kalibrierparameter) → `hmac`.

---

### 5.7 `backupEnabled`
**Typ:** Boolean  
**Zweck:** Gibt es ein Backup / eine Redundanzkopie dieser Daten?

---

### 5.8 `deletionMechanism`
**Typ:** Auswahl  
**Zweck:** Technischer Mechanismus für die sichere Datenlöschung. Relevant für Gerät-Rückgabe, End-of-Life und DSGVO-Compliance.

| Wert | Bedeutung | Sicherheit |
|------|-----------|-----------|
| `none` | Keine sichere Löschung vorgesehen | ⚠ Daten auf zurückgegebenem Gerät lesbar |
| `overwrite` | Überschreiben mit Nullen oder Zufallsdaten (mind. 1 Pass) | Mittel (Flash-Wear-Leveling kann Kopien hinterlassen) |
| `factory_reset` | Geräte-Factory-Reset löscht diesen Store | Mittel (je nach Implementierung) |
| `crypto_erase` | Schlüssellöschung — nur sinnvoll wenn `encryptionAtRest ≠ none` | Hoch (Daten kryptographisch unlesbar) |
| `physical` | Physische Vernichtung des Speichermediums (End-of-Life) | Sehr hoch |
| `retention_period` | Automatische Löschung nach konfigurierter Aufbewahrungsdauer | Abhängig von Implementierung |
| `custom` | Proprietär | — |

> **Designprinzip:** `deletionMechanism` beschreibt das *Wie* (Auswahl). Das Freitextfeld `deletionPolicy` (s.u.) beschreibt das *Was/Wann* — welche Daten werden bei welchem Ereignis gelöscht.

---

### 5.9 `deletionPolicy`
**Typ:** Freitext  
**Zweck:** Policy-Beschreibung — bei welchen Ereignissen wird was gelöscht, und was bleibt erhalten. Ergänzt `deletionMechanism`.  
**Beispiel:** `"Factory Reset löscht DS-2 (Config) und DS-4 (Logs) via overwrite. DS-3 (Firmware) bleibt erhalten — separater Flash-Löschbefehl via Service-Tool erforderlich."`

---

### 5.10 `technology`
**Typ:** Auswahl  
**Zweck:** Technologie des Datenspeichers.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `database` | Relationale/NoSQL Datenbank | — |
| `filesystem` | Dateisystem | DS-4 (SD-Card FAT) |
| `cloud` | Cloud-Speicher | — |
| `cache` | Flüchtiger Cache | — |
| `queue` | Message Queue | — |
| `blockchain` | Blockchain / DLT | — |
| `flash` | NOR/NAND Flash (Firmware, Konfiguration) | DS-1, DS-2, DS-3, DS-5, DS-6, DS-7 |
| `eeprom` | EEPROM (Kalibrierdata, Geräteidentität) | DS-6 (alternativ) |
| `nvram` | Non-Volatile RAM (Sicherheitsparameter, Last-State) | — |

---

### 5.11 `multiTenant`
**Typ:** Boolean  
**Zweck:** Teilen sich mehrere Mandanten / Benutzer diesen Speicher? (Relevant bei Cloud/Backend, hier i.d.R. `false`)

---

### 5.12 `containsSafetyRelevantData`
**Typ:** Boolean  
**Zweck:** Enthält dieser Speicher sicherheitsrelevante Konfigurationsdaten (Funktionale Sicherheit).  
**In diesem Projekt:** `false` für alle DS (Safety wird nicht bewertet).

---

### 5.13 `owner` / `notes`
**Typ:** Freitext

---

## 6. Data Flow Properties

Gilt für: DF-1 bis DF-10.

### 6.1 `dataTypes`
**Typ:** Freitext  
**Zweck:** Welche Daten werden transportiert.  
**Beispiel:** `"Trübungswert EBC (float32), Farbwert EBC (float32), Temperatur °C (float32), Statusbyte"`

---

### 6.2 `protocol`
**Typ:** Auswahl  
**Zweck:** Kommunikationsprotokoll. Eingebettete Protokolle haben automatisch `direction=unidirectional`, `endpointAuth=none`, `encryptionInTransit=none` als Default.

| Wert | Bedeutung | Default-Schutz |
|------|-----------|---------------|
| `http` | HTTP | keiner |
| `https` | HTTPS (TLS) | TLS-Verschlüsselung |
| `grpc` | gRPC | TLS (optional mTLS) |
| `mqtt` | MQTT | optional TLS |
| `amqp` | AMQP | optional TLS |
| `websocket` | WebSocket | optional TLS |
| `file` | Dateibasierter Transfer | keiner |
| `database` | Datenbankprotokoll | — |
| `custom` | Proprietäres Protokoll | — |
| `can` | CAN-Bus | **kein Auth, keine Encryption** |
| `modbus` | Modbus RTU / TCP | **kein Auth, keine Encryption** |
| `uart` | UART seriell | **kein Auth, keine Encryption** |
| `spi` | SPI-Bus | **kein Auth, keine Encryption** |
| `i2c` | I2C-Bus | **kein Auth, keine Encryption** |

---

### 6.3 `direction`
**Typ:** Auswahl  
**Zweck:** Richtung des Datenflusses.

| Wert | Bedeutung |
|------|-----------|
| `unidirectional` | Nur in eine Richtung (Sender → Empfänger) |
| `bidirectional` | In beide Richtungen gleichzeitig möglich |
| `requestresponse` | Request-Response-Muster (Anfrage → Antwort) |

---

### 6.4 `frequency`
**Typ:** Auswahl  
**Zweck:** Wie häufig fliesst der Datenfluss.

| Wert | Bedeutung | Beispiel |
|------|-----------|---------|
| `continuous` | Ständig / Real-Time | DF-1 (Messwerte, 1–10 Hz) |
| `periodic` | Regelmässig, getaktet | — |
| `ondemand` | Nur bei Bedarf / Ereignis | DF-2 (Kalibrierung), DF-6 (Update) |
| `batch` | Stapelweise, periodisch grössere Mengen | — |

---

### 6.5 `volume`
**Typ:** Freitext  
**Zweck:** Datenmenge pro Übertragung / Zeiteinheit.  
**Beispiel:** `"~20 Bytes/Transaktion, 1–10 Hz → ca. 200 Bytes/s"`

---

### 6.6 `encryptionInTransit`
**Typ:** Auswahl  
**Zweck:** Ist die Kommunikation verschlüsselt?

| Wert | Bedeutung |
|------|-----------|
| `none` | Keine Verschlüsselung — Klartext |
| `tls` | TLS (einseitige Authentifizierung des Servers) |
| `mtls` | Mutual TLS (beidseitige Zertifikatauthentifizierung) |
| `vpn` | VPN-Tunnel |
| `custom` | Proprietäre Verschlüsselung |

**⚠ Alle eingebetteten Feldbus-Protokolle (Modbus, CAN, SPI, UART) → `none`.**

---

### 6.7 `integrityProtection`
**Typ:** Auswahl  
**Zweck:** Wie ist die Integrität der transportierten Daten geschützt? Gleiche Logik wie bei DataStore — der Mechanismus bestimmt die tatsächliche Schutzwirkung.

| Wert | Kryptographisch? | Manipulationsschutz |
|------|-----------------|---------------------|
| `none` | Nein | Keiner |
| `crc` | Nein | Übertragungsfehler-Erkennung, **kein** Schutz vor gezielter Manipulation |
| `hash` | Ja | Änderungserkennung ohne Schlüssel |
| `hmac` | Ja | Manipulationsschutz mit geheimem Schlüssel |
| `signature` | Ja | Stärkste Garantie — asymmetrisch |
| `custom` | ? | Proprietär |

**Beispiele:** DF-1 (Modbus RTU) → `crc` (Frame-CRC vorhanden, kein Schutz gegen gezielte Manipulation). DF-6 (Firmware Update) → `signature` (sollte so sein). DF-3 (Profibus) → `none`.

---

### 6.8 `endpointAuthentication`
**Typ:** Auswahl  
**Zweck:** Wie authentifiziert sich der Endpunkt (Sender oder Empfänger)?

| Wert | Bedeutung |
|------|-----------|
| `none` | Keine Endpoint-Authentifizierung |
| `token` | Bearer Token / Session Token |
| `certificate` | X.509-Zertifikat |
| `apikey` | API-Key / Pre-shared Key |
| `oauth` | OAuth 2.0 |
| `mutual_tls` | Mutual TLS |

---

### 6.9 `exposureLevel` / `exposureLevelSource` / `exposureLevelRationale`
**Typ:** ExposureLevel / Auswahl / Freitext  
**Zweck:** Expositionsniveau dieses Datenflusses.

| `exposureLevelSource` | Bedeutung |
|----------------------|-----------|
| `derived` | Automatisch aus Source/Target-Elementen abgeleitet |
| `manual` | Vom Analysten manuell gesetzt |

**Beispiel:** DF-6 (Firmware Update) → `EL4`, `manual`, `"Update-Server ist externes Internet-Backend"`

---

### 6.10 `assumedTrusted` / `assumedTrustedRationale`
**Typ:** Boolean / Freitext  
**Zweck:** Dieser Datenfluss wird als vertrauenswürdig angenommen — muss explizit begründet werden.  
**⚠ IEC 62443:** "trusted" muss gerechtfertigt sein. Fehlende Begründung = Audit-Befund.  
**Beispiel:** DF-10 (interne SPI ADC-Daten) → `true`, `"Vollständig interner Bus, kein externer Zugang möglich"`

---

### 6.11 `excludeFromThreatGen` / `excludeFromThreatGenRationale`
**Typ:** Boolean / Freitext  
**Zweck:** Datenfluss von der automatischen Bedrohungsgenerierung ausschliessen.  
**Nur gültig wenn:** `assumedTrusted=true` oder Fluss nachweislich nicht erreichbar.  
**⚠ IEC 62443-4-1:** Ausschlüsse erfordern dokumentierte Begründung für Audit-Traceability.

---

### 6.12 `location`
**Typ:** Auswahl  
**Zweck:** Physisches Medium / Routing-Pfad dieses Datenflusses. Bestimmt welche physischen DoS-Angriffe möglich sind und wie leicht Eavesdropping durchführbar ist. Semantisch verschieden von `Interface.location` (Punkt) — `DataFlow.location` beschreibt eine Strecke.

| Wert | Bedeutung | Typischer EL | DoS-Vektor | Beispiel im System |
|------|-----------|-------------|-----------|-------------------|
| `on_chip` | Interner Chip-Bus (Register, interne Peripherie) | EL0 | Nur via Debug-Interface | — |
| `on_board` | PCB-Leiterbahn, gleiche Platine | EL0/EL1 | Physische PCB-Beschädigung | DF-10 (ADC intern) |
| `in_enclosure` | Kabel/Leiterbahn in versiegeltem Gehäuse | EL1 | Gehäuse öffnen erforderlich | DF-7 (SPI → SD-Card) |
| `field_cable` | Externes Feldkabel (M12, DIN-Schiene, Kabelkanal) | EL1/EL2 | **Stecker abziehen, Kabel durchtrennen** | DF-1, DF-2 (SiDis ↔ TurBiScat) |
| `local_network` | Kabelgebundenes lokales OT/IT-Netzwerksegment | EL2 | Port-Flooding, Kabelzug am Switch | DF-3, DF-4 (Feldbus via Ethernet) |
| `enterprise_network` | OT-IT-Übergangszone, Unternehmensnetzwerk | EL3 | Broadcast-Storm, ARP-Poisoning | — |
| `wireless_local` | Lokale Funkverbindung (WLAN, Bluetooth) innerhalb Gebäude | EL3 | **Störsender (Jammer), 802.11 Deauth-Attack** | DF-5, DF-6 (via WLAN) |
| `internet` | Über öffentliches Netzwerk | EL4 | DDoS, BGP-Hijack | DF-6 (Update Server) |
| `custom` | Proprietärer Pfad | — | — | — |

**DoS-Bedrohungsklassen die `location` triggert:**
- `field_cable` | `in_enclosure` | `on_board` → **DoS-Physical:** Physical Disconnection / Cable Tampering (EL1, kein Netzwerkzugang nötig)
- `wireless_local` → **DoS-Wireless:** RF Jamming / 802.11 Deauth Attack (EL3, nur physische Nähe nötig, 30 CHF Störsender)

**Plausibilitätsprüfung mit `exposureLevel`:**
- `field_cable` + `EL1` → konsistent
- `wireless_local` + `EL4` → Begründung erforderlich (`locationRationale`)

---

### 6.13 `locationRationale`
**Typ:** Freitext  
**Zweck:** Begründung wenn `location` und `exposureLevel` nicht dem Standardmapping entsprechen oder wenn der physische Pfad besondere Umstände hat.  
**Beispiel:** `"Feldkabel verläuft durch öffentlich zugänglichen Korridor — daher EL2 statt EL1."`

---

### 6.14 `redundancy`
**Typ:** Auswahl  
**Zweck:** Verhalten des Systems bei Unterbrechung dieses Datenflusses. Fliesst direkt in die DoS-Impact-Bewertung ein: `none` + `location=field_cable` + hoher Operational-Impact → Critical-DoS-Threat.

| Wert | Bedeutung | DoS-Impact | Beispiel im System |
|------|-----------|-----------|-------------------|
| `none` | Single Point of Failure — vollständiger Ausfall bei Unterbrechung | **Critical** | DF-1 (Messwerte via UART — kein Fallback) |
| `failover` | Automatischer Failover auf Backup-Pfad | Low | — |
| `degraded` | System läuft weiter mit reduzierter Funktionalität | Medium | DF-5 (WLAN-Ausfall — Gerät läuft, nur HMI weg) |
| `buffered` | Lokales Buffering überbrückt kurze Unterbrechungen | Low–Medium | DF-3 (Profibus — Pufferung im Kommunikationsmodul?) |

**Workshop-Frage für dieses System:** DF-3 (Prozessdaten → OT Master): `none` oder `buffered`? Hängt von der Anlage des Kunden ab.

---

### 6.15 `notes`
**Typ:** Freitext

---

## 7. Interface Properties

Gilt für: IF-1 bis IF-9.

### 7.1 `type`
**Typ:** Auswahl  
**Zweck:** Physischer Schnittstellentyp.

| Wert | Bedeutung | Beispiel im System |
|------|-----------|-------------------|
| `ethernet` | Ethernet (RJ45, M12) | IF-3 (EG_PoE) |
| `serial` | Serielle Schnittstelle (RS485, RS232, UART) | IF-1 (RS485/UART), IF-4 (Profibus), IF-7/IF-8 (Debug UART) |
| `usb` | USB | — |
| `gpio` | GPIO / Analog-Digital-IO | IF-5 (EG_IO) |
| `bluetooth` | Bluetooth | — |
| `wifi` | WLAN / WiFi | IF-2 (WLAN 802.11) |
| `nfc` | NFC | — |
| `fiber` | Glasfaser | — |
| `custom` | Proprietär | IF-9 (SPI intern) |

---

### 7.2 `accessControl`
**Typ:** Auswahl  
**Zweck:** Physischer oder logischer Zugangschutz auf dieser Schnittstelle.

| Wert | Bedeutung |
|------|-----------|
| `none` | Kein Zugangschutz |
| `physical_lock` | Physische Sperre (abschliessbarer Schrank, Siegel) |
| `credentials` | Passwort / Credential-basiert |
| `card` | Chipkarte / Badge |
| `certificate` | Zertifikat-basiert |

---

### 7.3 `connectionSpeed`
**Typ:** Auswahl (`low` / `medium` / `high`)  
**Zweck:** Übertragungsgeschwindigkeit — relevant für DoS-Angriffsoberfläche.

| Wert | Typischer Bereich |
|------|------------------|
| `low` | < 1 Mbit/s (UART, RS485, Profibus) |
| `medium` | 1–100 Mbit/s (Fast Ethernet) |
| `high` | > 100 Mbit/s (Gigabit, WLAN 802.11n) |

---

### 7.4 `isShieldedCable`
**Typ:** Boolean  
**Zweck:** Ist das Kabel geschirmt (EMV-Schutz, Abhörschutz)?  
**Relevant für:** Industrieumgebungen mit elektromagnetischen Störungen.

---

### 7.5 `location`
**Typ:** Freitext  
**Zweck:** Physischer Standort der Schnittstelle.  
**Beispiel:** `"Aussenseite Gehäuse, M12-Stecker oben"`, `"Intern, Leiterplatte J3"`

---

### 7.6 `exposureLevel` / `exposureLevelSource` / `exposureLevelRationale`
**Typ:** ExposureLevel / Auswahl / Freitext  
**Zweck:** Interfaces sind die primären Träger des ExposureLevels im DFD-Graph.  
**Beispiel:** IF-2 (WLAN) → `EL3`, `manual`, `"Lokales WLAN, erfordert physische Nähe (<50m)"`

---

### 7.7 `safetyRelevant` / `safetyRationale`
**Typ:** Boolean / Freitext  
**In diesem Projekt:** `false` (Safety wird nicht bewertet).

---

### 7.8 `notes`
**Typ:** Freitext

---

## 4. Physical Boundary Properties

Physical Boundary modelliert eine räumlich-physische Zugriffsbarriere. Beantwortet:
**"Wer kann physisch an diese Grenze herantreten?"**

**Nicht connectable** — kein DataFlow terminiert an einer PhysicalBoundary.
Elemente innerhalb teilen dieselbe physische Zugangsvoraussetzung.

---

### 4.1 `boundaryType`
**Typ:** Auswahl  
**Zweck:** Primärer Klassifikator — bestimmt Cascade-Defaults und Threat-Template-Selektion.

| Wert | Bedeutung | Threat-Klasse |
|------|-----------|---------------|
| `device_enclosure` | Gerätegehäuse — Werkzeugzugang zum Öffnen | Firmware Implant, Debug Attach |
| `cabinet` | Schaltschrank / Server-Rack — Schloss oder Badge | Unauthorized Physical Access |
| `room` | Zugangskontrollierter Raum | Badge Relay Attack, No Audit Trail |
| `building` | Gebäude / Werksgelände | Perimeter Breach |
| `vehicle` | Fahrzeug, Maschine | Depot Attack, Vehicle Theft |
| `tamper_zone` | Vergossener / versiegelter Bereich | PEL0 — nur destruktiver Zugang |
| `custom` | Proprietärer Typ | Analyst definiert |

---

### 4.2 `physicalExposureLevel`
**Typ:** `PEL0` | `PEL1` | `PEL2` | `PEL3` | `PEL4`  
**Zweck:** Physische Erreichbarkeit — höher = exponierter.

Bewusst getrennt von `ExposureLevel (EL)`: Ein Schaltschrank mit `PEL2` und ein
Interface darauf mit `EL3` sind zwei unabhängige Aussagen über verschiedene Räume.

---

### 4.3 `physicalMobility`
**Typ:** `fixed` | `removable` | `portable` | `vehicle_mounted`  
**Zweck:** Kann der Angreifer den Angriffskontext kontrollieren?

Nur relevant für `device_enclosure` und `vehicle`.

| Wert | Bedeutung | Neue Threat-Klasse |
|------|-----------|-------------------|
| `fixed` | Fest installiert — Angriff nur vor Ort | — (Baseline) |
| `removable` | Ausbaubar (DIN-Rail, Steckmodul) | Depot Attack, Hardware Swap |
| `portable` | Tragbar — kann mitgenommen werden | Evil-Maid, Lab-Analyse, Firmware Implant |
| `vehicle_mounted` | Im Fahrzeug, mobil aber nicht handtragbar | Vehicle Theft, Field Manipulation |

**⚠ `portable + safetyRelevant = true`:** Rogue Calibration Device Threat wird generiert.
Beispiel: Kalibriergerät mitgenommen → im Labor manipuliert → scheinbar legitim zurückgebracht.

---

### 4.4 `accessibility`
**Typ:** `public` | `controlled` | `guarded`  
**Zweck:** Umgebungskontext des Angreifers — wer kommt in die Nähe?

Orthogonal zu PEL: Ein PEL4-Port kann `controlled` (Fabrik) oder `public` (Bahnhof) sein.

---

### 4.5 `physicalAccessControl`
**Typ:** `none` | `key` | `badge` | `badge_pin` | `biometric` | `guard`  
**Zweck:** Schutzmechanismus an der Boundary.

| Wert | Threat |
|------|--------|
| `none` | Uncontrolled Physical Access |
| `badge` | Badge Relay Attack (Wiegand/MIFARE Classic) |
| `badge_pin` | Relay Attack mitigiert |

---

### 4.6 `tamperProtection`
**Typ:** `none` | `seal` | `switch` | `mesh` | `potting` | `active_detection`  
**Zweck:** Manipulationsnachweis und -widerstand.

| Wert | Schutzwirkung |
|------|---------------|
| `none` | Keine Spuren bei Öffnung — Tampering unerkannt |
| `seal` | Post-hoc Evidence — kein Prevention |
| `switch` | Alert bei Gehäuseöffnung |
| `potting` | Kein Rework möglich — PEL0-Niveau |
| `active_detection` | Voltage/Temp-Sensor mit Zeroize — HSM-Niveau |

---

### 4.7 `monitoringType`
**Typ:** `none` | `camera` | `alarm` | `soc` | `guard_patrol` | `tamper_monitoring`  
**Zweck:** Erkennungskapazität an der Boundary.

| Wert | Threat-Reduktion |
|------|-----------------|
| `none` | Keine — Repudiation Threat |
| `camera` | Gering — nur post-hoc Evidence |
| `alarm` | Mittel — Echtzeit-Alert |
| `soc` | Hoch — aktive Response |
| `tamper_monitoring` | Hoch — oft kombiniert mit Zeroize auf ChipBoundary |

---

### 4.8 `debugInterfaceAccessible`
**Typ:** Boolean  
**Zweck:** Ist ein Debug-Port (JTAG, SWD, UART) physisch zugänglich innerhalb der Boundary — ohne weitere Demontage?  
**Distinct von** `ChipBoundary.debugInterfacePresent` (Existenz des Ports) — dieses Feld modelliert physische Erreichbarkeit von aussen.  
**Wenn `true`:** Debug Attachment + Firmware Readback Threats werden generiert.

---

### 4.9 `removableMediaAccessible`
**Typ:** Boolean  
**Zweck:** Ist ein USB/SD/CF-Slot physisch zugänglich — ohne weitere Demontage?  
Modelliert physische Zugänglichkeit, nicht SW-Policy (allowed/denied).  
**Wenn `true`:** Removable Media Insertion + Data Exfiltration Threats.

---

### 4.10 `safetyRelevant` / `safetyRationale`
**Typ:** Boolean / String  
**Zweck:** Schützt diese Boundary safety-kritische Hardware oder Funktionen?  
Eskaliert alle physischen Threats auf Safety-Impact-Niveau.  
Erforderlich für EN 50742 / MVO 2027 Dokumentation.

---

## Querverweise: Welche Properties lösen Bedrohungen aus?

| Element | Property | Wert | Automatisch generierte Bedrohung | STRIDE |
|---------|----------|------|----------------------------------|--------|
| ChipBoundary | `secureBootEnabled` | `false` | Bootloader Tampering | T |
| ChipBoundary | `debugInterfaceLocked` | `false` | JTAG/SWD Unauthorized Access | S, T, I, E |
| ChipBoundary | `firmwareProtection` | `none` | Firmware Readback / Extraction | I, T |
| ChipBoundary | `bitstreamEncryption` | `false` | Bitstream Readback (FPGA) | I, T |
| ChipBoundary | `tamperProtection` | `none` | Physical Tampering, Key Extraction | T, I |
| DataFlow | `encryptionInTransit` | `none` | Man-in-the-Middle, Eavesdropping | I, T |
| DataFlow | `endpointAuthentication` | `none` | Spoofing, Unauthorized Command Injection | S, T |
| DataFlow | `integrityProtection` | `none` oder `crc` | Tampering (Datenmanipulation im Transit) | T |
| DataFlow | `location` | `field_cable` | DoS-Physical: Physical Disconnection / Cable Tampering | D |
| DataFlow | `location` | `wireless_local` | DoS-Wireless: RF Jamming / 802.11 Deauth Attack | D |
| DataFlow | `redundancy` | `none` + `location=field_cable` | Critical DoS — kein Fallback bei physischer Unterbrechung | D |
| DataFlow | `assumedTrusted` | `true` ohne Rationale | Audit-Befund: fehlende Begründung (IEC 62443-4-1) | — |
| DataStore | `integrityProtection` | `none` oder `crc` | Tampering (Daten im Speicher manipulierbar) | T |
| DataStore | `accessControlMechanism` | `none` | Unauthorized Access / Information Disclosure auf Store | S, I |
| DataStore | `encryptionAtRest` | `none` + `dataClassification=confidential/restricted` | Information Disclosure bei physischem Zugang | I |
| DataStore | `deletionMechanism` | `none` | Residual Data Exposure bei Gerät-Rückgabe / End-of-Life | I |
| Process | `authenticationRequired` | `no` | Spoofing, Unauthorized Access | S, E |
| Process | `inputValidation` | `none` | Injection Attacks, Buffer Overflow | T, E |
| Process | `errorHandling` | `verbose` | Information Disclosure via Fehlermeldungen | I |
| ExternalEntity | `threatActor` | `malicious` / `advanced` | Erhöhte Feasibility aller Bedrohungen von dieser Entität | alle |
| PhysicalBoundary | `physicalExposureLevel` | `PEL3` / `PEL4` + `accessibility=public` | Unauthorized Physical Access | T, E |
| PhysicalBoundary | `physicalAccessControl` | `badge` | Badge Relay Attack / Cloning | S |
| PhysicalBoundary | `tamperProtection` | `none` | Physical Tampering — No Evidence | T |
| PhysicalBoundary | `monitoringType` | `none` | No Physical Audit Trail (Repudiation) | R |
| PhysicalBoundary | `debugInterfaceAccessible` | `true` | Debug Interface Attachment, Firmware Readback | I, E |
| PhysicalBoundary | `removableMediaAccessible` | `true` | Removable Media Insertion, Data Exfiltration | I, T |
| PhysicalBoundary | `physicalMobility` | `portable` | Evil-Maid Attack, Lab Firmware Implant | T |
| PhysicalBoundary | `physicalMobility` + `safetyRelevant` | `portable` + `true` | Rogue Calibration Device | T |
| PhysicalBoundary | `physicalMobility` | `removable` | Depot Attack, Hardware Swap | T |

---

*TARAflow Property Reference — Sigrist Photometer AG — TurBiScat PM 40 / SiDis AD 40*  
*Vertraulich — nur für interne Workshop-Nutzung*
