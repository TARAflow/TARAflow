// 7.1 per threat (0.20 patch 28): the view lists the threats of every
// relevant interface / flow and their state — a dismissal counts only with a
// reason, an unrated threat stays open.
import { describe, it, expect } from "vitest";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function zoned() {
  const p: Any = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
  p.info.tags = { ...p.info.tags, regulation: ["EN 50742 A"] };
  const tb = p.dfd.elements.find((e: Any) => e.type === "TrustBoundary");
  tb.properties.safetyZone = "yes";
  return p;
}

describe("buildEn50742View — anchorThreats", () => {
  it("states: dismissed with a reason, unjustified without one, unrated", () => {
    const p = zoned();
    const relevant = [...prepareProjectCompliance(p)!.en50742Relevance().relevant.keys()];
    const threats: Any[] = [...p.threats.perElementTables, ...p.threats.perInteractionTables].flatMap((t: Any) => t.threats);
    const onAnchor = threats.filter((t) => relevant.includes(t.linkedElement?.elementId ?? t.dataFlow?.connectionId));
    expect(onAnchor.length).toBeGreaterThanOrEqual(2);
    const [a, b] = onAnchor;
    Object.assign(a, { relevance: "not_relevant", evalNote: "" });
    Object.assign(b, { relevance: "not_relevant", evalNote: "sealed port" });
    const states = new Map(
      [...prepareProjectCompliance(p)!.en50742View().anchorThreats.values()].flat().map((x) => [x.label, x.state] as const),
    );
    expect(states.get(a.displayId)).toBe("unjustified");
    expect(states.get(b.displayId)).toBe("dismissed");
  });
});
