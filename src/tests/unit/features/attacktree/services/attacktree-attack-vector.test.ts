// tests/unit/features/attacktree/services/attacktree-attack-vector.test.ts
//
// Mitigation catalog design D1 (doc/InProgress/Threat/mitigation-catalog-
// attack-vector.md): the DSL attribute av=network|adjacent|local|physical on
// any node, inherited down the subtree into AttackPath.attackVector. It picks
// controls only — attack potential, feasibility and path keys are unchanged.

import { describe, it, expect } from "vitest";
import { parseAttackTree } from "features/attacktree/services/attacktree-parser";
import { analyzeAttackPaths } from "features/attacktree/services/attacktree-calculator";
import { attackTreeOperations } from "features/attacktree/services/attacktree-operations";
import { attackTreeReportSections } from "features/documentation/utils/attack-tree-report";
import type { AttackTree } from "features/attacktree/models/attacktree-types";

const AP = "et=1w,se=proficient,kn=restricted,wo=easy,eq=standard";

const DSL = [
  "Lamp request spoofed;ROOT @manipulation",
  "\tVia OBD-II port;OR av=physical",
  `\t\tInject through diagnostic gateway;${AP}`,
  `\t\tReach the bus over a paired dongle;${AP},av=adjacent`,
  "\tVia cellular link;OR AV=Net",
  `\t\tExploit the telematics stack;${AP}`,
  `\t\tAbuse the backend connection;${AP}`,
  "\tUnknown route;OR",
  `\t\tSomething else;${AP}`,
  `\t\tAnything else;${AP}`,
].join("\n");

const WITHOUT = DSL.replace(/[ ,]av=[a-z]+/gi, "");

const paths = (dsl: string) => analyzeAttackPaths(parseAttackTree(dsl, "simple").ast!, "simple").paths;

describe("av= in the DSL", () => {
  it("parses on gates and leaves (alias, case, comma form)", () => {
    const r = parseAttackTree(DSL, "simple");
    expect(r.success).toBe(true);
    const [obd, cell, unknown] = r.ast!.children;
    expect(obd.attackVector).toBe("physical");
    expect(obd.type).toBe("OR");
    expect(obd.children[1].attackVector).toBe("adjacent");
    expect(obd.children[1].evaluation?.attackPotential).toBeDefined();
    expect(cell.attackVector).toBe("network");
    expect(unknown.attackVector).toBeUndefined();
  });

  it("an unknown value warns and is ignored; the node stays", () => {
    const r = parseAttackTree(`Root;ROOT\n\tStep;${AP} av=wireless\n\tOther;${AP}`, "simple");
    expect(r.success).toBe(true);
    expect(r.ast!.children[0].attackVector).toBeUndefined();
    expect(r.ast!.children[0].evaluation?.attackPotential).toBeDefined();
    expect(r.warnings.map((w) => w.messageKey)).toContain(
      "tabs.attacktree.validation.parser.unknownAttackVector",
    );
  });

  it("paths inherit the vector closest to the leaf; none when no node states one", () => {
    expect(paths(DSL).map((p) => [p.path.at(-1), p.attackVector])).toEqual([
      ["Inject through diagnostic gateway", "physical"],
      ["Reach the bus over a paired dongle", "adjacent"],
      ["Exploit the telematics stack", "network"],
      ["Abuse the backend connection", "network"],
      ["Something else", undefined],
      ["Anything else", undefined],
    ]);
  });

  it("golden: attack potential, feasibility and path keys unchanged", () => {
    const strip = (list: ReturnType<typeof paths>) =>
      list.map(({ pathKey, attackPotential, feasibilityLevel, likelihoodLevel }) => ({
        pathKey,
        attackPotential,
        feasibilityLevel,
        likelihoodLevel,
      }));
    expect(strip(paths(DSL))).toEqual(strip(paths(WITHOUT)));
  });

  it("a changed av= makes the stored ast stale (re-parse on load)", () => {
    const tree = {
      dsl: DSL,
      configuration: { evaluationMethod: "simple" },
      ast: parseAttackTree(WITHOUT, "simple").ast,
    } as unknown as AttackTree;
    expect(attackTreeOperations.astLagsDsl(tree)).toBe(true);
  });

  it("the report shows the vector next to the gate", () => {
    const t = ((_k: string, d?: string) => d ?? _k) as never;
    const [section] = attackTreeReportSections(
      {
        assets: null,
        attackTree: { trees: [{ id: "t", name: "T", anchor: { type: "standalone" }, dsl: DSL, configuration: { evaluationMethod: "simple" } }] },
      } as never,
      t,
    );
    expect(section.outline[1].text).toBe("Via OBD-II port (OR · physical)");
    expect(section.outline[3].text).toMatch(/^Reach the bus over a paired dongle \(adjacent\) — AP /);
  });
});
