// tests/unit/features/audit/services/diff-service.golden.test.ts
//
// Characterisation of the audit commit body (0.20 item 16): for a set of
// typical single changes to the SmokeDetector project, what the DiffService
// lists and how generateCommitMessage words it. Taken BEFORE the audit diff
// learns the fields it misses (generic field compare, patch 37), so that
// patch shows its effect as added lines here — and that the texts of the
// existing comparisons stay as they are.
//
// The previous state is the raw file, as the Audit tab reads it from git
// (audit-prev-state.ts: JSON.parse, no migration). Since 0.20 item 16 the
// body also names the fields the diff does not list (withUnlistedChanges).
//
// The snapshot is the deliberate golden: regenerate with `vitest -u` only
// when the audit diff changes on purpose.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { diffService } from "features/audit/services/diff-service";
import { generateCommitMessage } from "features/audit/models/audit-types";
import { withUnlistedChanges } from "features/audit/services/unlisted-changes";
import type { Project } from "app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const fixture = (name: string) => readFileSync(resolve(__dirname, "../../../../fixtures", name), "utf8");
const SMOKE = fixture("SmokeDetector.tara.json");
// SmokeDetector has no chosen measures; the component example has
const CASE = fixture("component-0.19/SmokeDetectorCase.tara.json");

/** The commit body for one change: the change lines, without the trailers. */
function body(mutate: (p: Json) => void): string {
  const text = mutate.name === "onCase" ? CASE : SMOKE;
  const previous: Json = JSON.parse(text);
  const current: Json = JSON.parse(text);
  mutate(current);
  // as the Audit tab: the diff's list plus the fields it does not list (0.20 item 16)
  const changes = withUnlistedChanges(
    diffService.detectChanges(current as Project, previous as Project),
    JSON.stringify(previous),
    JSON.stringify(current),
    true,
  );
  if (changes.length === 0) return "(nothing listed)";
  const message = generateCommitMessage(diffService.generateCommitMessageData(changes, "Detail Review", "Tester"));
  return message.split("\n\n")[1] ?? message;
}

const risk = (p: Json) => p.risks.risks[0];
const threat = (p: Json) => p.threats.perElementTables[0].threats[0];
const asset = (p: Json) => p.assets.assets[0];
const riskWithMitigation = (p: Json) => p.risks.risks.find((r: Json) => r.selectedMitigations?.length > 0);
/** A change made on the component example (named so body() picks that file). */
const onCase = (change: (p: Json) => void) => Object.defineProperty((p: Json) => change(p), "name", { value: "onCase" });

const CASES: [string, (p: Json) => void][] = [
  // listed today
  ["risk: MoSCoW priority", (p) => (risk(p).moscowPriority = risk(p).moscowPriority === "must" ? "should" : "must")],
  ["risk: risk before mitigation", (p) => (risk(p).calculatedRiskBeforeMitigation = (risk(p).calculatedRiskBeforeMitigation ?? 0) + 1)],
  ["threat: description", (p) => (threat(p).threatDescription = "Changed threat text")],
  ["asset: name", (p) => (asset(p).name = "Renamed asset")],
  ["asset: security goal level", (p) => (asset(p).securityGoals[0].level = asset(p).securityGoals[0].level === "high" ? "low" : "high")],
  ["dfd: element property", (p) => (p.dfd.elements.find((e: Json) => e.type === "Process").properties.notes = "Changed note")],
  ["risk: mitigation status", onCase((p) => (riskWithMitigation(p).selectedMitigations[0].status = "verified"))],
  // 0.20 manual test D4: listed with the risk, next to its mitigations
  ["risk: verifications chosen", onCase((p) => (riskWithMitigation(p).selectedVerifications = ["V-T-001", "V-T-002"]))],
  // not listed before 0.20 item 16
  ["threat: relevance", (p) => (threat(p).relevance = threat(p).relevance === "relevant" ? "not_relevant" : "relevant")],
  ["threat: threat actor", (p) => (threat(p).threatActor = "insider")],
  ["risk: treatment", (p) => (risk(p).treatment = risk(p).treatment === "accept" ? "reduce" : "accept")],
  ["risk: mitigation evidence note", onCase((p) => (riskWithMitigation(p).selectedMitigations[0].evidenceNote = "Test report TR-7"))],
  ["risk: treatment justification", (p) => (risk(p).treatmentJustification = "Accepted by the product owner")],
  ["asset: physical impact rationale", (p) => (asset(p).physicalImpactRationale = "Burn injury possible")],
  ["project: regulation tags", (p) => p.info.tags.regulation.push("EN 50742 A")],
  ["project: name", (p) => (p.info.name = "Renamed project")],
  ["settings: strict mode", (p) => (p.settings.strictMode = !p.settings.strictMode)],
  ["hazard: description", (p) => (p.hazards.hazards[0].description = "Changed hazard")],
  ["risk configuration: method", (p) => (p.risks.configuration.method = `${p.risks.configuration.method}-changed`)],
  // derived / presentation: never listed
  ["derived: phase status", (p) => (p.phaseStatus[0] = { ...p.phaseStatus[0], probe: 1 })],
  ["presentation: element position", (p) => (p.dfd.elements[0].position.x += 10)],
  ["presentation: report language", (p) => (p.documentation.configuration.language = p.documentation.configuration.language === "de" ? "en" : "de")],
];

describe("DiffService — commit body for single changes (SmokeDetector golden)", () => {
  it.each(CASES)("%s", (_name, mutate) => {
    expect(body(mutate)).toMatchSnapshot();
  });
});
