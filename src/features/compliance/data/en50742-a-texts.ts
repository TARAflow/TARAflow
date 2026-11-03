// ==================== REQUIREMENT TEXTS: EN 50742 APPROACH A ====================
// What each row of the sub-tab `en-50742-a` is about — short title and a
// SHORT SUMMARY IN OUR OWN WORDS, English and German (licence rule D-27 as
// for IEC 62443: never the normative text of the licensed draft; source of
// the content: en-50742-rq-coverage.md §9.2). checklistDe: the German
// checklist of the rule, same order.

import type { En50742RequirementId } from "../models/compliance-types";
import type { RequirementText } from "./requirement-texts";

export const EN50742_A_TEXTS: Readonly<Record<En50742RequirementId, RequirementText>> = {
  // ── Threat assessment ──────────────────────────────────────────────────
  "en-4.3-217": {
    title: "Threat assessment based on the risk assessment",
    en: "The hazards of the machine are known and every safety function under threat has risks in the analysis.",
    de: "Die Gefährdungen der Maschine sind bekannt, und jede bedrohte Sicherheitsfunktion hat Risiken in der Analyse.",
  },
  "en-4.3-220": {
    title: "Basis of the threat assessment",
    en: "The way of operation and the system definition (boundary, environment) are set before threats are assessed.",
    de: "Betriebsart und Systemdefinition (Grenze, Umgebung) sind festgelegt, bevor Bedrohungen bewertet werden.",
    checklistDe: [
      "bestimmungsgemässe Verwendung beschrieben",
      "vernünftigerweise vorhersehbare Fehlanwendung beschrieben",
      "Benutzergruppen beschrieben",
      "Verbindungen der Maschine beschrieben",
    ],
  },
  "en-4.3-238": {
    title: "Measures do not degrade the safety functions",
    en: "For each safety function: the selected security measures do not impair it.",
    de: "Je Sicherheitsfunktion: die gewählten Security-Massnahmen beeinträchtigen sie nicht.",
  },
  "en-7.1-260": {
    title: "Interfaces to the safety functions assessed",
    en: "Every interface on a path to a safety function has a risk with SRSL or a reason why it is out.",
    de: "Jede Schnittstelle auf einem Pfad zu einer Sicherheitsfunktion hat ein Risiko mit SRSL oder eine Begründung für den Ausschluss.",
  },
  "en-7.4.2-334": {
    title: "SRSL determined",
    en: "Every safety function has an SRSL on every risk of its interfaces.",
    de: "Jede Sicherheitsfunktion hat auf jedem Risiko ihrer Schnittstellen ein SRSL.",
  },
  "en-7.4.2-344": {
    title: "SRSL consistent with the exposure",
    en: "No SRSL 0 while an interface of the safety function is exposed beyond EL0.",
    de: "Kein SRSL 0, solange eine Schnittstelle der Sicherheitsfunktion über EL0 exponiert ist.",
  },

  // ── Information collection (7.3) ───────────────────────────────────────
  "en-7.3.1-281": {
    title: "Interventions to be recorded",
    en: "Which kinds of intervention the machine has, and which of them are recorded.",
    de: "Welche Arten von Eingriffen die Maschine hat und welche davon aufgezeichnet werden.",
  },
  "en-7.3.2-295": {
    title: "Recording of interventions",
    en: "The machine records changes to safety-relevant software and configuration.",
    de: "Die Maschine zeichnet Änderungen an sicherheitsrelevanter Software und Konfiguration auf.",
    checklistDe: ["jeder Eintrag enthält den Mindestinhalt (was, wann, durch wen)"],
  },
  "en-7.3.3-304": {
    title: "Access to the recorded evidence",
    en: "The recorded evidence is collected automatically and can be read through a documented way.",
    de: "Die aufgezeichneten Nachweise werden automatisch erfasst und sind auf einem dokumentierten Weg lesbar.",
    checklistDe: ["die Nachweise sind lesbar", "der Zugang dazu ist dokumentiert", "sie werden automatisch erfasst"],
  },
  "en-7.3.4-317": {
    title: "Retention of the evidence",
    en: "The last intervention of each kind is kept for years after putting into service.",
    de: "Der letzte Eingriff jeder Art bleibt über Jahre ab Inbetriebnahme erhalten.",
  },
  "en-7.3.5-321": {
    title: "Protection of the evidence",
    en: "The stored evidence is protected against change; deletion needs an authorised procedure.",
    de: "Die gespeicherten Nachweise sind gegen Veränderung geschützt; Löschen erfordert ein autorisiertes Verfahren.",
    checklistDe: ["Einträge lassen sich nur über ein autorisiertes Verfahren löschen"],
  },

  // ── Identification of software versions and configuration (7.5) ────────
  "en-7.5-444": {
    title: "Software versions and configuration identifiable",
    en: "The versions of safety-relevant software and the configuration can be read on demand.",
    de: "Die Versionen sicherheitsrelevanter Software und die Konfiguration lassen sich bei Bedarf auslesen.",
  },

  // ── Protection measures against corruption (7.4.3) ─────────────────────
  "en-7.4.3.1-347": {
    title: "Protection measures per SRSL",
    en: "Summary: every protection clause below is met for every safety function and interface.",
    de: "Zusammenfassung: jede Schutzklausel unten ist für jede Sicherheitsfunktion und Schnittstelle erfüllt.",
  },
  "en-7.4.3.2.1-356": {
    title: "Identification and authentication",
    en: "Where a risk mandates it at its SRSL, access to the safety function is identified and authenticated.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, wird der Zugriff auf die Sicherheitsfunktion identifiziert und authentisiert.",
  },
  "en-7.4.3.3.1-370": {
    title: "Authorisation",
    en: "Where a risk mandates it at its SRSL, only authorised users and processes change the safety function.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, ändern nur autorisierte Benutzer und Prozesse die Sicherheitsfunktion.",
  },
  "en-7.4.3.4.1-380": {
    title: "Integrity of the interface",
    en: "Where a risk mandates it at its SRSL, tampering at the interface is prevented or detected.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, wird Manipulation an der Schnittstelle verhindert oder erkannt.",
  },
  "en-7.4.3.4.2-392": {
    title: "Integrity of the software",
    en: "Where a risk mandates it at its SRSL, the integrity of safety-relevant software is protected.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, ist die Integrität sicherheitsrelevanter Software geschützt.",
  },
  "en-7.4.3.4.3-402": {
    title: "Integrity of the communication",
    en: "Where a risk mandates it at its SRSL, changes to transmitted data are detected.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, werden Änderungen übertragener Daten erkannt.",
  },
  "en-7.4.3.4.4-412": {
    title: "Input validation",
    en: "Where a risk mandates it at its SRSL, inputs to the safety function are checked.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, werden Eingaben an die Sicherheitsfunktion geprüft.",
  },
  "en-7.4.3.4.5-426": {
    title: "Integrity of the configuration",
    en: "Where a risk mandates it at its SRSL, the safety configuration is protected against change.",
    de: "Wo ein Risiko es auf seinem SRSL verlangt, ist die Sicherheitskonfiguration gegen Veränderung geschützt.",
  },
  "en-7.4.3.5.1-438": {
    title: "Authenticity of safety software",
    en: "From SRSL 2: safety software and critical configuration are accepted only when their origin is verified.",
    de: "Ab SRSL 2: Sicherheitssoftware und kritische Konfiguration werden nur mit geprüfter Herkunft übernommen.",
    checklistDe: ["die Echtheit wird bei der Installation geprüft"],
  },

  // ── Information for use (9) ────────────────────────────────────────────
  "en-9-491": {
    title: "Security information for use",
    en: "The information for use covers the security context, software identification, access to the evidence and permitted modifications.",
    de: "Die Benutzerinformation behandelt Security-Kontext, Software-Identifikation, Zugang zu den Nachweisen und zulässige Änderungen.",
  },
  "en-4.3-229": {
    title: "Remaining requirements passed on",
    en: "Every risk with a remaining requirement is named in the information for use.",
    de: "Jedes Risiko mit verbleibender Anforderung ist in der Benutzerinformation genannt.",
    checklistDe: ["jede verbleibende Anforderung ist in der Benutzerinformation genannt"],
  },
};
