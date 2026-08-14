import { describe, it, expect } from "vitest";
import {
  DEFAULT_ROUND_NAMES,
  DEFAULT_AUDIT_CONFIG,
  getAllRoundNames,
  roundDisplayLabel,
  normalizeRoundName,
  normalizeAuditConfig,
  generateCommitMessage,
  type RoundName,
  type AuditConfig,
} from "features/audit/models/audit-types";

// A tiny fake i18n: only German for "detail", everything else falls back.
const t = (key: string, fallback: string) =>
  key === "audit.rounds.detail" ? "Detailbewertung" : fallback;

describe("round names — canonical commit label, localized display", () => {
  it("default rounds carry the English canonical label", () => {
    expect(DEFAULT_ROUND_NAMES.map((r) => r.label)).toEqual([
      "Initial Assessment",
      "Detail Review",
      "Refinement",
      "Final Decision",
    ]);
    expect(DEFAULT_ROUND_NAMES.every((r) => !r.isCustom)).toBe(true);
  });

  it("default display localizes via i18n, falling back to the English label", () => {
    const detail = DEFAULT_ROUND_NAMES.find((r) => r.id === "detail")!;
    expect(roundDisplayLabel(detail, t)).toBe("Detailbewertung");
    const initial = DEFAULT_ROUND_NAMES.find((r) => r.id === "initial")!;
    expect(roundDisplayLabel(initial, t)).toBe("Initial Assessment"); // no DE → fallback
  });

  it("custom rounds are shown verbatim, never translated", () => {
    const custom: RoundName = { id: "c1", label: "Kundenreview", isCustom: true };
    expect(roundDisplayLabel(custom, t)).toBe("Kundenreview");
  });

  it("the committed subject uses the canonical label, not the display label", () => {
    // The commit side passes round.label straight through.
    const msg = generateCommitMessage({
      round: "Detail Review",
      batchSize: 1,
      affectedPhases: ["Assets"],
      changes: [],
      author: "J",
    });
    expect(msg.startsWith("[TARA] Detail Review")).toBe(true);
  });
});

describe("legacy compatibility (defensive)", () => {
  it("normalizeRoundName maps a legacy {name,nameDE} custom round to a single label", () => {
    const legacy = { id: "c9", name: "Legacy EN", nameDE: "Legacy DE", isCustom: true };
    const r = normalizeRoundName(legacy as unknown as RoundName);
    expect(r).toEqual({ id: "c9", label: "Legacy EN", isCustom: true });
  });

  it("getAllRoundNames tolerates a legacy custom round shape", () => {
    const cfg = {
      customRoundNames: [{ id: "c9", name: "Legacy EN", nameDE: "x", isCustom: true }],
    } as unknown as AuditConfig;
    const all = getAllRoundNames(cfg);
    expect(all).toHaveLength(DEFAULT_ROUND_NAMES.length + 1);
    expect(all[all.length - 1].label).toBe("Legacy EN");
  });

  it("normalizeAuditConfig drops the retired branch-counter fields", () => {
    const raw = {
      provider: "github",
      defaultBranch: "main",
      featureBranchTemplate: "risk-round-",
      lastRoundNumber: 7,
      author: { name: "J", email: "j@x" },
      auth: { method: "pat" },
      gpg: { enabled: false },
      customRoundNames: [{ id: "c9", name: "Legacy EN", nameDE: "x", isCustom: true }],
      signing: { enabled: false, format: "ssh" },
    } as unknown as AuditConfig;

    const cfg = normalizeAuditConfig(raw);
    expect(cfg).not.toHaveProperty("featureBranchTemplate");
    expect(cfg).not.toHaveProperty("lastRoundNumber");
    expect(cfg.customRoundNames[0]).toEqual({
      id: "c9",
      label: "Legacy EN",
      isCustom: true,
    });
  });

  it("DEFAULT_AUDIT_CONFIG no longer carries the retired fields", () => {
    expect(DEFAULT_AUDIT_CONFIG).not.toHaveProperty("featureBranchTemplate");
    expect(DEFAULT_AUDIT_CONFIG).not.toHaveProperty("lastRoundNumber");
  });
});