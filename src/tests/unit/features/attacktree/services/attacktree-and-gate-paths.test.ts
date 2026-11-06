// FX-6 (release plan 0.18): an AND gate is one attack scenario — one path per
// combination of the steps below it (minimal cut set; an OR below the gate
// multiplies out), with the gate's feasibility over exactly that combination.
// Trees without AND keep their paths and keys.
import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import { computePathKey, findPathKeyCollisions } from "features/attacktree/services/attacktree-path-identity";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";

const analyse = (lines: string[]) =>
  attackTreeCalculator.analyzeAttackPaths(attackTreeParser.parse(lines.join("\n"), "simple").ast!, "simple", DEFAULT_FEASIBILITY_CONFIGURATION);
const last = (p: { path: string[] }) => p.path[p.path.length - 1];

describe("AND gate paths (FX-6)", () => {
  it("an AND over two leaves is one path naming both steps", () => {
    const a = analyse(["Replace firmware;ROOT", "\tBoth;AND", "\t\tOpen debug port;p=0.5,i=3", "\t\tBypass signature;p=0.4,i=4"]);
    expect(a.paths).toHaveLength(1);
    const [p] = a.paths;
    expect(last(p)).toBe("Open debug port + Bypass signature");
    expect(p.combination).toEqual({ gate: ["Replace firmware", "Both"], legs: [["Open debug port"], ["Bypass signature"]] });
    expect(p.probability).toBeCloseTo(0.2);
  });

  it("an OR below the gate gives one path per branch, each rated on its own branch", () => {
    const a = analyse([
      "Root;ROOT",
      "\tGate;AND",
      "\t\tAccess;OR",
      "\t\t\tDebug port;p=0.9,i=3",
      "\t\t\tJTAG;p=0.1,i=3",
      "\t\tBypass;p=0.9,i=3",
    ]);
    expect(a.paths.map(last).sort()).toEqual(["Debug port + Bypass", "JTAG + Bypass"]);
    const viaJtag = a.paths.find((p) => last(p) === "JTAG + Bypass")!;
    const viaDebug = a.paths.find((p) => last(p) === "Debug port + Bypass")!;
    expect(viaJtag.probability!).toBeLessThan(viaDebug.probability!);
    expect(viaJtag.combination!.legs).toEqual([["Access", "JTAG"], ["Bypass"]]);
  });

  it("nested AND: the inner gate's steps belong to the same combination", () => {
    const a = analyse(["Root;ROOT", "\tOuter;AND", "\t\tInner;AND", "\t\t\tX;p=0.5,i=3", "\t\t\tY;p=0.5,i=3", "\t\tZ;p=0.5,i=3"]);
    expect(a.paths).toHaveLength(1);
    expect(a.paths[0].combination!.legs).toEqual([["Inner", "X"], ["Inner", "Y"], ["Z"]]);
  });

  it("the key is stable under sibling order and changes with a rename", () => {
    const one = analyse(["R;ROOT", "\tG;AND", "\t\tA;p=0.5,i=3", "\t\tB;p=0.5,i=3"]).paths[0].pathKey;
    const swapped = analyse(["R;ROOT", "\tG;AND", "\t\tB;p=0.5,i=3", "\t\tA;p=0.5,i=3"]).paths[0].pathKey;
    const renamed = analyse(["R;ROOT", "\tG;AND", "\t\tA2;p=0.5,i=3", "\t\tB;p=0.5,i=3"]).paths[0].pathKey;
    expect(swapped).toBe(one);
    expect(renamed).not.toBe(one);
    expect(findPathKeyCollisions(analyse(["R;ROOT", "\tG;AND", "\t\tA;p=0.5,i=3", "\t\tB;p=0.5,i=3", "\tC;p=0.5,i=3"]).paths)).toEqual([]);
  });

  it("a tree without AND keeps its paths and keys", () => {
    const a = analyse(["R;ROOT", "\tO;OR", "\t\tA;p=0.5,i=3", "\t\tB;p=0.5,i=3"]);
    expect(a.paths.map((p) => p.pathKey).sort()).toEqual([computePathKey(["R", "O", "A"]), computePathKey(["R", "O", "B"])].sort());
    expect(a.paths.every((p) => !p.combination)).toBe(true);
  });

  it("the attack vector is the most restrictive one the steps need", () => {
    const a = analyse(["R;ROOT", "\tG;AND", "\t\tRemote;p=0.5,i=3,av=network", "\t\tOn site;p=0.5,i=3,av=physical"]);
    expect(a.paths[0].attackVector).toBe("physical");
  });
});
