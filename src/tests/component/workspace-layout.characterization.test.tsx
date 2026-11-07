// src/tests/component/workspace-layout.characterization.test.tsx
//
// Characterization of WorkspaceLayout (MT-1): written against the
// single-file version BEFORE it was split into hooks per strand
// (src/app/hooks/workspace/*), and kept as the regression net for the split
// and for later changes. The layout renders for real; only the feature tabs
// and the phase bar are replaced by stand-ins that record their props, so
// the tests can check what each tab receives and call its callbacks.
//
// Covered: phase change + strict-mode warning, the safety gate, navigation
// requests between tabs, handlers pinned to the project they were made for
// (a save that lands after a project switch), memo stability of the DFD tab
// project (iframe reload guard), preset-dependent props, compliance view
// only on its tab, local settings remembered once per project.

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../fixtures/load-fixture";
import { PhaseId } from "app/models/phase-types";

// ==================== HOISTED MOCK STATE ====================

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  ctx: null as null | Record<string, unknown>,
  props: {} as Record<string, any>,
  renders: {} as Record<string, number>,
  auditHints: null as null | { repoMissing: boolean; uncommittedVerifications: number },
  rememberLocalSettings: vi.fn(),
}));

function stub(name: string) {
  return (props: any) => {
    h.props[name] = props;
    h.renders[name] = (h.renders[name] ?? 0) + 1;
    return null;
  };
}

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("shared")>()),
  useToast: () => h.toast,
}));

vi.mock("app/contexts/project-context", () => ({
  useProjectContext: () => h.ctx,
}));

vi.mock("app/components/navigation/phase-tab-bar", () => ({ PhaseTabs: stub("PhaseTabs") }));
vi.mock("features/overview", async (o) => ({ ...(await o<object>()), GeneralTab: stub("GeneralTab") }));
vi.mock("features/hazards", async (o) => ({ ...(await o<object>()), HazardsTab: stub("HazardsTab") }));
vi.mock("features/dfd", async (o) => ({ ...(await o<object>()), DFDTab: stub("DFDTab") }));
vi.mock("features/assets", async (o) => ({ ...(await o<object>()), AssetsTab: stub("AssetsTab") }));
vi.mock("features/threats", async (o) => ({ ...(await o<object>()), ThreatsTab: stub("ThreatsTab") }));
vi.mock("features/risks", async (o) => ({ ...(await o<object>()), RisksTab: stub("RisksTab") }));
vi.mock("features/attacktree", async (o) => ({ ...(await o<object>()), AttackTreeTab: stub("AttackTreeTab") }));
vi.mock("features/documentation", async (o) => ({ ...(await o<object>()), DocTab: stub("DocTab") }));
vi.mock("features/integration", async (o) => ({ ...(await o<object>()), IntegrationTab: stub("IntegrationTab") }));
vi.mock("features/audit", async (o) => ({
  ...(await o<object>()),
  AuditTab: stub("AuditTab"),
  useAuditHints: () => h.auditHints,
}));
vi.mock("features/compliance", async (o) => ({ ...(await o<object>()), ComplianceFrame: stub("ComplianceFrame") }));
vi.mock("app/services/local-user-settings", async (o) => ({
  ...(await o<object>()),
  rememberLocalSettings: (...args: unknown[]) => h.rememberLocalSettings(...args),
}));

import { WorkspaceLayout } from "app/components/layout/workspace-layout";

// ==================== FIXTURES ====================

function project(file: string, id: string, patch: Partial<Project> = {}): Project {
  const p = parseAndRepair(loadProjectFixture(file));
  if (!p) throw new Error(`fixture ${file} did not load`);
  return { ...p, id, ...patch } as Project;
}

/** SmokeDetector: IEC 62443 + CRA, safety relevant. */
const smoke = (patch: Partial<Project> = {}) => project("SmokeDetector.tara.json", "p-smoke", patch);
/** Headlamp: ISO/SAE 21434. */
const headlamp = (patch: Partial<Project> = {}) => project("headlamp-iso21434.tara.json", "p-head", patch);

interface Harness {
  setActivePhase: ReturnType<typeof vi.fn>;
  updateProject: ReturnType<typeof vi.fn>;
  rerender: (next: { projects?: Project[]; activeProject?: Project; activePhase?: number }) => void;
}

function mount(active: Project, activePhase: number, others: Project[] = []): Harness {
  const setActivePhase = vi.fn();
  const updateProject = vi.fn(async () => {});
  const state = { projects: [active, ...others], activeProject: active, activePhase };
  const ctxOf = () => ({
    ...state,
    activeProjectId: state.activeProject?.id ?? null,
    openProjects: state.projects,
    recentProjectsMetadata: [],
    isLoading: false,
    setActivePhase,
    updateProject,
    switchProject: vi.fn(),
    saveProject: vi.fn(),
  });
  h.ctx = ctxOf();
  const view = render(<WorkspaceLayout />);
  return {
    setActivePhase,
    updateProject,
    rerender: (next) => {
      Object.assign(state, next);
      h.ctx = ctxOf();
      view.rerender(<WorkspaceLayout />);
    },
  };
}

beforeEach(() => {
  h.props = {};
  h.renders = {};
  h.auditHints = null;
  h.rememberLocalSettings.mockClear();
  h.toast.warning.mockClear();
});

// ==================== PHASE CHANGE ====================

describe("WorkspaceLayout — phase change", () => {
  it("switches the phase and stores it as currentPhase of the project", () => {
    const w = mount(smoke(), PhaseId.General);
    act(() => h.props.PhaseTabs.onPhaseChange(PhaseId.Risk));
    expect(w.setActivePhase).toHaveBeenCalledWith(PhaseId.Risk);
    expect(w.updateProject).toHaveBeenCalledWith({ id: "p-smoke", currentPhase: PhaseId.Risk });
  });

  it("warns in strict mode when the previous phase is not complete", () => {
    const p = smoke();
    const strict = smoke({
      settings: { ...p.settings, strictMode: true },
      phaseStatus: { ...p.phaseStatus, [PhaseId.Risk - 1]: "in-progress", [PhaseId.Risk]: "not-started" },
    });
    mount(strict, PhaseId.General);
    act(() => h.props.PhaseTabs.onPhaseChange(PhaseId.Risk));
    expect(h.toast.warning).toHaveBeenCalledTimes(1);
  });

  it("does not warn without strict mode", () => {
    mount(smoke({ settings: { ...smoke().settings, strictMode: false } }), PhaseId.General);
    act(() => h.props.PhaseTabs.onPhaseChange(PhaseId.Risk));
    expect(h.toast.warning).not.toHaveBeenCalled();
  });

  it("falls back to the Overview when the Hazard tab is active but safety is off", () => {
    const p = smoke();
    const w = mount(smoke({ info: { ...p.info, safetyRelevant: false } }), PhaseId.Hazard);
    expect(w.setActivePhase).toHaveBeenCalledWith(PhaseId.General);
    expect(h.props.HazardsTab).toBeUndefined();
  });

  it("renders the Hazard tab when safety relevant", () => {
    mount(smoke(), PhaseId.Hazard);
    expect(h.props.HazardsTab.project.id).toBe("p-smoke");
  });
});

// ==================== NAVIGATION REQUESTS ====================

describe("WorkspaceLayout — navigation between tabs", () => {
  it("'show in table' from the DFD opens the Assets tab with the row marked; leaving Assets drops the mark", () => {
    const w = mount(smoke(), PhaseId.DFD);
    act(() => h.props.DFDTab.onShowInTable("asset-1"));
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Assets);
    w.rerender({ activePhase: PhaseId.Assets });
    expect(h.props.AssetsTab.tableHighlightRequest).toEqual({ assetId: "asset-1" });

    act(() => h.props.PhaseTabs.onPhaseChange(PhaseId.Risk));
    w.rerender({ activePhase: PhaseId.Risk });
    w.rerender({ activePhase: PhaseId.Assets });
    expect(h.props.AssetsTab.tableHighlightRequest).toBeNull();
  });

  it("'show in graph' from the Assets tab sends a graph focus request to the DFD tab", () => {
    const w = mount(smoke(), PhaseId.Assets);
    act(() => h.props.AssetsTab.onShowInGraph("asset-2"));
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.DFD);
    expect(h.props.DFDTab.graphFocusRequest).toEqual({ assetId: "asset-2" });
  });

  it("'open hazard' from the DFD opens the Hazard tab with the hazard; leaving it drops the request", () => {
    const w = mount(smoke(), PhaseId.DFD);
    act(() => h.props.DFDTab.onOpenHazard("hz-1"));
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Hazard);
    w.rerender({ activePhase: PhaseId.Hazard });
    expect(h.props.HazardsTab.openRequest).toEqual({ hazardId: "hz-1" });
    act(() => h.props.PhaseTabs.onPhaseChange(PhaseId.Risk));
    w.rerender({ activePhase: PhaseId.Hazard });
    expect(h.props.HazardsTab.openRequest).toBeNull();
  });

  it("offers no 'open hazard' without safety relevance", () => {
    const p = smoke();
    mount(smoke({ info: { ...p.info, safetyRelevant: false } }), PhaseId.DFD);
    expect(h.props.DFDTab.onOpenHazard).toBeUndefined();
  });

  it("'show element' from the Compliance tab focuses the element in the DFD", () => {
    const w = mount(smoke(), PhaseId.Compliance);
    expect(h.props.ComplianceFrame).toBeDefined();
    act(() => h.props.ComplianceFrame.onShowElement("el-1"));
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.DFD);
    expect(h.props.DFDTab.elementFocusRequest).toEqual({ elementId: "el-1" });
  });

  it("the Overview opens the Audit and Risk tabs", () => {
    const w = mount(smoke(), PhaseId.General);
    act(() => h.props.GeneralTab.onOpenAuditTab());
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Audit);
    act(() => h.props.GeneralTab.onOpenRiskTab());
    expect(w.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Risk);
  });
});

// ==================== PINNED HANDLERS ====================

describe("WorkspaceLayout — handlers stay with their project after a switch", () => {
  function switched(phase: number) {
    const a = smoke();
    const b = headlamp();
    const w = mount(a, phase, [b]);
    const before = { ...h.props };
    w.rerender({ activeProject: b });
    w.updateProject.mockClear();
    return { w, a, b, before };
  }

  it("Assets: a flush after the switch writes the outgoing project", async () => {
    const { w, a, before } = switched(PhaseId.Assets);
    await act(async () => {
      await before.AssetsTab.onUpdate({ assets: a.assets, phaseStatus: a.phaseStatus, lastModified: "x" });
    });
    expect(w.updateProject).toHaveBeenCalledTimes(1);
    expect(w.updateProject.mock.calls[0][0].id).toBe("p-smoke");
  });

  it("Hazards", async () => {
    const { w, a, before } = switched(PhaseId.Hazard);
    await act(async () => {
      await before.HazardsTab.onUpdate({ hazards: a.hazards, lastModified: "x" });
    });
    expect(w.updateProject.mock.calls[0][0]).toMatchObject({ id: "p-smoke", hazards: a.hazards });
  });

  it("Risks", async () => {
    const { w, a, before } = switched(PhaseId.Risk);
    await act(async () => {
      await before.RisksTab.onUpdate({ risks: a.risks, phaseStatus: a.phaseStatus, lastModified: "x" });
    });
    expect(w.updateProject.mock.calls[0][0].id).toBe("p-smoke");
    expect(w.updateProject.mock.calls[0][0].risks).toBeDefined();
  });

  it("Attack trees", () => {
    const { w, a, before } = switched(PhaseId.AttackTree);
    act(() => before.AttackTreeTab.onUpdate({ attackTrees: a.attackTrees, phaseStatus: a.phaseStatus, lastModified: "x" }));
    expect(w.updateProject).toHaveBeenCalledWith({ id: "p-smoke", attackTrees: a.attackTrees, phaseStatus: a.phaseStatus });
  });

  it("Overview", () => {
    const { w, before } = switched(PhaseId.General);
    act(() => before.GeneralTab.onUpdate(before.GeneralTab.data));
    expect(w.updateProject.mock.calls[0][0].id).toBe("p-smoke");
  });

  it("Audit: update, dirty flag and verifications", () => {
    const { w, a, before } = switched(PhaseId.Audit);
    act(() => before.AuditTab.onUpdate({ audit: a.audit, phaseStatus: a.phaseStatus }));
    act(() => before.AuditTab.onDirtyChange(true));
    act(() => before.AuditTab.onVerificationsChange([]));
    const ids = w.updateProject.mock.calls.map((c) => c[0].id);
    expect(ids).toEqual(["p-smoke", "p-smoke", "p-smoke"]);
    expect(w.updateProject.mock.calls[1][0]).toEqual({ id: "p-smoke", hasUnsavedChanges: true });
    expect(w.updateProject.mock.calls[2][0].cybersecurityConcept.verifications).toEqual([]);
  });

  it("Threats and DFD (shared project update handlers)", async () => {
    const { w, a, before } = switched(PhaseId.Threats);
    await act(async () => {
      await before.ThreatsTab.onUpdate({ threats: a.threats, phaseStatus: a.phaseStatus, lastModified: "x" });
    });
    expect(w.updateProject.mock.calls.length).toBeGreaterThan(0);
    expect(w.updateProject.mock.calls.every((c) => c[0].id === "p-smoke")).toBe(true);
  });

  it("asset deletion removes the asset from the pinned project and re-syncs threats", async () => {
    const a = smoke();
    const w = mount(a, PhaseId.Assets);
    const assetId = a.assets!.assets.find((x) => (w && h.props.AssetsTab.assetUsage(x.id).blockingAttackTrees.length === 0))!.id;
    await act(async () => {
      await h.props.AssetsTab.onDeleteAsset(assetId);
    });
    const patch = w.updateProject.mock.calls[0][0];
    expect(patch.id).toBe("p-smoke");
    expect(patch.assets.assets.some((x: { id: string }) => x.id === assetId)).toBe(false);
    expect(patch.threats).toBeDefined();
  });
});

// ==================== MEMO STABILITY ====================

describe("WorkspaceLayout — stable props", () => {
  it("the DFD tab keeps the same project object when the project is re-spread with equal content", () => {
    const a = smoke();
    const w = mount(a, PhaseId.DFD);
    const first = h.props.DFDTab.project;
    w.rerender({
      activeProject: { ...a, phaseStatus: { ...a.phaseStatus }, settings: { ...a.settings } },
    });
    expect(h.props.DFDTab.project).toBe(first);
  });

  it("the DFD tab gets a new project object when the DFD changes", () => {
    const a = smoke();
    const w = mount(a, PhaseId.DFD);
    const first = h.props.DFDTab.project;
    w.rerender({ activeProject: { ...a, dfd: { ...a.dfd!, lastModified: "2099-01-01" } } });
    expect(h.props.DFDTab.project).not.toBe(first);
  });

  it("DFD and attack-tree tabs stay mounted on other phases", () => {
    mount(smoke(), PhaseId.Risk);
    expect(h.props.DFDTab).toBeDefined();
    expect(h.props.AttackTreeTab).toBeDefined();
    expect(h.props.AssetsTab).toBeUndefined();
  });

  it("the threat-count lookup counts threats on an element", () => {
    const a = smoke();
    mount(a, PhaseId.DFD);
    const threat = a.threats!.perElementTables.flatMap((t) => t.threats).find((t) => t.linkedElement?.elementId)!;
    expect(h.props.DFDTab.threatCountOf(threat.linkedElement!.elementId)).toBeGreaterThan(0);
    expect(h.props.DFDTab.threatCountOf("no-such-element")).toBe(0);
  });
});

// ==================== PRESET-DEPENDENT PROPS ====================

describe("WorkspaceLayout — preset-dependent props", () => {
  it("ISO/SAE 21434 project", () => {
    const w = mount(headlamp(), PhaseId.Assets);
    expect(h.props.AssetsTab.project.damageScenarioMode).toBe(true);
    expect(h.props.AssetsTab.project.impactLabelVocabulary).toBe("iso-21434");
    expect(h.props.DFDTab.assumptionsNeutral).toBe(false);
    expect(h.props.DFDTab.labelVocabulary).toBe("iso-21434");
    expect(h.props.AttackTreeTab.project.isoMode).toBe(true);
    w.rerender({ activePhase: PhaseId.Risk });
    expect(h.props.RisksTab.project.isoMode).toBe(true);
    w.rerender({ activePhase: PhaseId.Audit });
    expect(h.props.AuditTab.project.verification).toBeDefined();
    w.rerender({ activePhase: PhaseId.General });
    expect(h.props.GeneralTab.verification).toBeDefined();
  });

  it("IEC 62443 project", () => {
    const w = mount(smoke(), PhaseId.Assets);
    expect(h.props.AssetsTab.project.damageScenarioMode).toBe(false);
    expect(h.props.AssetsTab.project.impactLabelVocabulary).toBe("default");
    expect(h.props.DFDTab.assumptionsNeutral).toBe(true);
    expect(h.props.DFDTab.labelVocabulary).toBe("default");
    w.rerender({ activePhase: PhaseId.Risk });
    expect(h.props.RisksTab.project.isoMode).toBe(false);
    w.rerender({ activePhase: PhaseId.Audit });
    expect(h.props.AuditTab.project.verification).toBeUndefined();
  });

  it("the Risk tab gets the threats of all three generators", () => {
    const a = smoke();
    mount(a, PhaseId.Risk);
    const p = h.props.RisksTab.project;
    expect(p.perElementThreats.length).toBeGreaterThan(0);
    expect(p.perInteractionThreats.length).toBeGreaterThan(0);
    expect(Array.isArray(p.perAttackPathThreats)).toBe(true);
  });
});

// ==================== COMPLIANCE / PHASE BAR / LOCAL SETTINGS ====================

describe("WorkspaceLayout — compliance, phase bar, local settings", () => {
  it("evaluates the requirement matrix only on the Compliance tab", () => {
    const w = mount(smoke(), PhaseId.Risk);
    expect(h.props.ComplianceFrame).toBeUndefined();
    expect(h.props.PhaseTabs.complianceAvailable).toBe(true);
    w.rerender({ activePhase: PhaseId.Compliance });
    expect(typeof h.props.ComplianceFrame.evaluate).toBe("function");
    expect(h.props.ComplianceFrame.componentOptions.length).toBeGreaterThan(0);
  });

  it("shows audit hints on the phase bar", () => {
    h.auditHints = { repoMissing: true, uncommittedVerifications: 2 };
    mount(smoke(), PhaseId.General);
    expect(h.props.PhaseTabs.auditHints).toEqual(["phases.audit.repoMissing", "phases.audit.uncommitted"]);
  });

  it("passes phase indicators to the phase bar and the Overview", () => {
    mount(smoke(), PhaseId.General);
    expect(h.props.PhaseTabs.indicators).toBeDefined();
    expect(h.props.GeneralTab.phaseIndicators).toBe(h.props.PhaseTabs.indicators);
  });

  it("remembers the local settings once per opened project", () => {
    const a = smoke();
    const b = headlamp();
    const w = mount(a, PhaseId.General, [b]);
    w.rerender({ activeProject: { ...a } });
    expect(h.rememberLocalSettings).toHaveBeenCalledTimes(1);
    expect(h.rememberLocalSettings.mock.calls[0][0]).toBe("p-smoke");
    w.rerender({ activeProject: b });
    expect(h.rememberLocalSettings).toHaveBeenCalledTimes(2);
    expect(h.rememberLocalSettings.mock.calls[1][0]).toBe("p-head");
  });

  it("renders nothing without an active project", () => {
    h.ctx = {
      projects: [],
      activeProject: undefined,
      activePhase: 0,
      setActivePhase: vi.fn(),
      updateProject: vi.fn(),
    };
    render(<WorkspaceLayout />);
    expect(h.props.PhaseTabs).toBeUndefined();
  });
});
