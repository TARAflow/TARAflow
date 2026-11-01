// "How TARAflow checks it" generated from the evidence rules (D-27).
import { describe, it, expect } from "vitest";
import { describeLanguageOf, describeRequirement } from "features/compliance";

describe("describeRequirement", () => {
  it("an all-rule: every element of the target, with its neighbour and the accepted values", () => {
    const d = describeRequirement("cr-2.5", "en");
    expect(d.title).toBe("Session lock");
    expect(d.check).toBe("Checked in the model: every Process / Multiprocess connected to ExternalEntity (entity type = user / admin_user / operator / maintenance / contractor / device_owner): session lock enabled = true.");
  });

  it("an any-rule and a precondition", () => {
    expect(describeRequirement("cr-3.10", "en").check).toContain("at least one Process / Multiprocess: update mechanism set, not none");
    expect(describeRequirement("cr-1.9-re1", "en").check).toMatch(/^Applies when: at least one DataFlow with endpoint authentication = certificate \/ mutual_tls/);
  });

  it("type C: not derivable from the model", () => {
    expect(describeRequirement("cr-1.7", "en").check).toContain("Not derivable from the model");
  });

  it("German: summary, check and checklist", () => {
    const d = describeRequirement("cr-1.5", "de");
    expect(d.summary).toMatch(/^Passwörter, Schlüssel/);
    expect(d.check).toMatch(/^Im Modell geprüft: mindestens ein Process/);
    expect(d.checklist[0]).toBe("erstmalige Authentisierungsmerkmale können vergeben werden");
    expect(describeRequirement("cr-1.5", "en").checklist[0]).toBe("initial authenticators can be provisioned");
  });

  it("language codes", () => {
    expect(describeLanguageOf("de-CH")).toBe("de");
    expect(describeLanguageOf("en")).toBe("en");
    expect(describeLanguageOf(undefined)).toBe("en");
  });
});
