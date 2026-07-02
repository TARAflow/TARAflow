import { describe, it, expect } from "vitest";
import { migrate_2_to_3 } from "app/services/versions";

function ifaceEl(logicalAccessControl?: string, extra: Record<string, any> = {}) {
  return {
    id: "if1",
    type: "Interface",
    properties: {
      type: "bluetooth",
      implementedControls: {
        physicalAccessProtection: "none",
        ...(logicalAccessControl ? { logicalAccessControl } : {}),
      },
      ...extra,
    },
  };
}
 
function project(elements: any[]) {
  return { schemaVersion: 2, dfd: { elements } };
}
 
describe("migrate_2_to_3 — logicalAccessControl split", () => {
  it("secure_pairing → implementedControls.linkAuthentication=pairing, key dropped", () => {
    const out = migrate_2_to_3(project([ifaceEl("secure_pairing")]));
    const p = out.dfd.elements[0].properties;
    expect(p.implementedControls.linkAuthentication).toBe("pairing");
    expect(p.implementedControls.logicalAccessControl).toBeUndefined();
    expect(p.implementedControls.physicalAccessProtection).toBe("none"); // untouched
  });
 
  it.each([
    "password",
    "certificate",
    "mfa",
    "hardware_token",
    "challenge_response",
  ])(
    "app-auth value %s → notes marker, no linkAuthentication, key dropped",
    (value) => {
      const out = migrate_2_to_3(project([ifaceEl(value)]));
      const p = out.dfd.elements[0].properties;
      expect(p.implementedControls.linkAuthentication).toBeUndefined();
      expect(p.notes).toContain("[MIGRATED] logicalAccessControl");
      expect(p.notes).toContain(value);
      expect(p.implementedControls.logicalAccessControl).toBeUndefined();
    },
  );

  it("existing notes are preserved and appended to", () => {
    const out = migrate_2_to_3(
      project([ifaceEl("password", { notes: "prior note" })]),
    );
    const p = out.dfd.elements[0].properties;
    expect(p.notes).toContain("prior note");
    expect(p.notes).toContain("[MIGRATED]");
  });

  it("none → key dropped, nothing carried", () => {
    const out = migrate_2_to_3(project([ifaceEl("none")]));
    const p = out.dfd.elements[0].properties;
    expect(p.implementedControls.linkAuthentication).toBeUndefined();
    expect(p.notes).toBeUndefined();
    expect(p.implementedControls.logicalAccessControl).toBeUndefined();
  });

  it("idempotent: interface without logicalAccessControl is untouched", () => {
    const first = migrate_2_to_3(project([ifaceEl("secure_pairing")]));
    const second = migrate_2_to_3({ ...first, schemaVersion: 2 });
    expect(
      second.dfd.elements[0].properties.implementedControls.linkAuthentication,
    ).toBe("pairing");
    // no duplicate notes, no re-processing
    expect(second.dfd.elements[0].properties.notes).toBeUndefined();
  });

  it("non-interface elements are left alone", () => {
    const proc = {
      id: "p1",
      type: "Process",
      properties: { authenticationRequired: "password" },
    };
    const out = migrate_2_to_3(project([proc]));
    expect(out.dfd.elements[0]).toEqual(proc);
  });
 
  it("bumps schemaVersion to 3", () => {
    const out = migrate_2_to_3(project([]));
    expect(out.schemaVersion).toBe(3);
  });
});
 