// ==================== REQUIREMENT TEXTS: EN 50742 APPROACH B ====================
// The rows Approach B adds — short title and a SHORT SUMMARY IN OUR OWN
// WORDS, English and German (licence rule D-27: never the normative text of
// the licensed draft; source: en-50742-rq-coverage.md §6).

import type { EN50742_B_REQUIREMENT_IDS } from "../models/compliance-types";
import type { RequirementText } from "./requirement-texts";

export const EN50742_B_TEXTS: Readonly<Record<(typeof EN50742_B_REQUIREMENT_IDS)[number], RequirementText>> = {
  "en-6-257": {
    title: "Secure development process (IEC 62443-4-1)",
    en: "The component is developed under a secure development process per IEC 62443-4-1; the threat model of this TARA is part of its evidence.",
    de: "Die Komponente wird nach einem sicheren Entwicklungsprozess gemäss IEC 62443-4-1 entwickelt; das Bedrohungsmodell dieser TARA gehört zu dessen Nachweisen.",
  },
  "en-8.2-458": {
    title: "Machinery system meets Table 3 (IEC 62443-3-3)",
    en: "Where the machinery system is assessed: it meets the system requirements of Table 3 for its safety functions — outside this component analysis.",
    de: "Wird das Maschinensystem bewertet: Es erfüllt die Systemanforderungen von Tabelle 3 für seine Sicherheitsfunktionen — ausserhalb dieser Komponentenanalyse.",
  },
  "en-8.3-471": {
    title: "Support of essential functions and least privilege",
    en: "The component supports its essential functions (CCSC 1) and works with least privilege (CCSC 3).",
    de: "Die Komponente unterstützt ihre wesentlichen Funktionen (CCSC 1) und arbeitet nach dem Prinzip der geringsten Rechte (CCSC 3).",
  },
  "en-8.3-473": {
    title: "Countermeasures of the system named",
    en: "Where the component meets a Table 4 requirement only with countermeasures of the machinery system, the information for use names them and the requirements not met.",
    de: "Erfüllt die Komponente eine Anforderung aus Tabelle 4 nur mit Gegenmassnahmen des Maschinensystems, nennt die Benutzerinformation diese und die nicht erfüllten Anforderungen.",
  },
  "en-8.3-479": {
    title: "Mixed components evaluated in full",
    en: "A component serving safety and other functions meets Table 4 as a whole, not only for its safety part.",
    de: "Eine Komponente mit Sicherheits- und anderen Funktionen erfüllt Tabelle 4 als Ganzes, nicht nur für ihren Sicherheitsteil.",
  },
  "en-8.5-487": {
    title: "Audit records kept for 5 years",
    en: "The audit records of the safety functions (CR 2.8) are kept for at least five years.",
    de: "Die Audit-Aufzeichnungen der Sicherheitsfunktionen (CR 2.8) bleiben mindestens fünf Jahre erhalten.",
  },
};
