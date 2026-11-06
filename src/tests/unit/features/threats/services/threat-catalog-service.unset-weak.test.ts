// FX-7 (release plan 0.18): the threat catalog matcher reads every context key
// the catalog uses, and a key that names a missing or weak control matches an
// UNSET property as that weak value — an unfinished model never looks safer
// than a complete one. Templates matched by facts still win over templates
// matched by such an assumption.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  contextMatch,
  findElementTemplate,
  matchesContext,
  MATCHED_CONTEXT_KEYS,
} from "features/threats/services/threat-catalog-service";
import type { TemplateContext, ThreatProjectData } from "features/threats/models/threat-types";

const project = { info: { tags: { regulation: [], platform: [], domain: [], custom: [] } } } as unknown as ThreatProjectData;

function catalogFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? catalogFiles(p) : p.endsWith(".json") ? [p] : [];
  });
}

describe("every catalog context key is read (FX-7 guard)", () => {
  it("no template names a key the matcher ignores", () => {
    const unknown: string[] = [];
    for (const file of catalogFiles("src/features/threats/services/catalog/threats")) {
      const json = JSON.parse(readFileSync(file, "utf-8"));
      for (const t of [...(json.elementTemplates ?? []), ...(json.interactionTemplates ?? [])]) {
        for (const key of Object.keys(t.context ?? {})) {
          if (!(MATCHED_CONTEXT_KEYS as readonly string[]).includes(key)) unknown.push(`${t.id}.${key}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});

/** Compiles only when every TemplateContext key is in MATCHED_CONTEXT_KEYS. */
type Missing = Exclude<keyof TemplateContext, (typeof MATCHED_CONTEXT_KEYS)[number]>;
export const everyKeyListed: [Missing] extends [never] ? true : Missing = true;

describe("unset = weak (FX-7)", () => {
  const ctx = (c: TemplateContext) => c;

  it("an unset weak-control property matches as the weak value — counted as an assumption", () => {
    expect(contextMatch(ctx({ backupMechanism: ["none"] }), project, {})).toEqual({ matches: true, assumed: 1 });
    expect(contextMatch(ctx({ backupMechanism: ["none"] }), project, { backupMechanism: "snapshot" })).toEqual({ matches: false, assumed: 0 });
    expect(contextMatch(ctx({ backupMechanism: ["none"] }), project, { backupMechanism: "none" })).toEqual({ matches: true, assumed: 0 });
    expect(matchesContext(ctx({ failSafeOutputState: ["not_defined"] }), project, { failSafeOutputState: "not_specified" })).toBe(true);
    expect(matchesContext(ctx({ accessMode: ["read_write"] }), project, {})).toBe(true);
    expect(matchesContext(ctx({ accessMode: ["read_write"] }), project, { accessMode: "read_only" })).toBe(false);
  });

  it("login settings count as weak only where the element authenticates", () => {
    const c = ctx({ accountManagement: ["local_only"] });
    expect(matchesContext(c, project, {})).toBe(false);
    expect(matchesContext(c, project, { authenticationRequired: "no" })).toBe(false);
    expect(matchesContext(c, project, { authenticationRequired: "yes" })).toBe(true);
    expect(matchesContext(c, project, { boundaryAuthentication: "password" })).toBe(true);
    expect(matchesContext(c, project, { authenticationRequired: "yes", accountManagement: "central" })).toBe(false);
  });

  it("the keys the matcher ignored are read: physical path protection (multi-select) and encryption in transit", () => {
    const c = ctx({ location: ["on_board"], physicalPathProtection: ["none"], encryptionInTransit: ["none"] });
    expect(matchesContext(c, project, { location: "on_board" })).toBe(true);
    expect(matchesContext(c, project, { location: "on_board", physicalPathProtection: ["conformal_coating"] })).toBe(false);
    expect(matchesContext(c, project, { location: "on_board", physicalPathProtection: ["none"] })).toBe(true);
    expect(matchesContext(c, project, { location: "on_board", encryptionInTransit: "tls" })).toBe(false);
  });

  it("selector keys still need a value: an unknown protocol matches no protocol template", () => {
    expect(matchesContext(ctx({ protocol: ["modbus_tcp"] }), project, {})).toBe(false);
  });

  it("a template matched by a fact beats one matched by an assumption; an assumption beats no constraint", () => {
    // technology = rtos_task (fact) → embedded T-004, not the gap template on the unset fail-safe state.
    expect(findElementTemplate("T", "Process", project, { technology: "rtos_task" })?.id).toBe("T-004");
    // Nothing known: the weak-control template is preferred to the general one.
    const general = findElementTemplate("T", "Process", project, { failSafeOutputState: "unpowered" })?.domain;
    const assumed = findElementTemplate("T", "Process", project, {})?.domain;
    expect(general).toBe("general");
    expect(assumed).toBe("gap");
  });
});
