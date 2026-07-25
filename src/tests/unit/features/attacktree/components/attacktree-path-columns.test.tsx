// src/tests/unit/features/attacktree/components/attacktree-path-columns.test.tsx
//
// Two rules in the attack-path columns are subtle enough to be broken by a
// well-meaning refactor without anything else failing:
//
//   1. Relevance is per (pathKey, strideCategory), NOT per path. A `destruction`
//      path maps onto both T and D, so it must show TWO controls. Collapsing to
//      one toggle per row would silently merge two decisions.
//   2. The relevance column has two levels: it SHOWS as soon as treeId +
//      assessments are present, and becomes EDITABLE only when onAssessmentsChange
//      is too — so the overview can display decisions without becoming an editor.
//
// The hook returns column defs; to exercise renderCell we feed them to the real
// DataTable, the way the table view does.

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "shared";
import type { AttackPath, AttackPathAssessment } from "features/attacktree/models/attacktree-types";
import { useAttackTreePathColumns } from "features/attacktree/components/attacktree-path-columns";

// i18n: echo keys so assertions are catalogue-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

function makePath(overrides: Partial<AttackPath> = {}): AttackPath {
  return {
    id: "p1",
    pathKey: "abc123",
    path: ["Root", "Leaf"],
    nodeIds: ["n0", "n1"],
    riskScore: 10,
    probability: 0.5,
    impact: 3,
    feasibility: 0.6,
    benefits: "medium",
    feasibilityLevel: "medium",
    likelihoodLevel: "medium",
    attackGoals: ["manipulation"], // → T
    mitigations: [],
    isCritical: false,
    isFullyMitigated: false,
    ...overrides,
  } as AttackPath;
}

/** Renders the hook's columns through the real DataTable. */
function Harness({
  paths,
  treeId,
  assessments,
  onAssessmentsChange,
}: {
  paths: AttackPath[];
  treeId?: string;
  assessments?: AttackPathAssessment[];
  onAssessmentsChange?: (next: AttackPathAssessment[]) => void;
}) {
  const columns = useAttackTreePathColumns({
    evaluationMethod: "extended",
    likelihoodModel: "feasibility-only",
    treeId,
    assessments,
    onAssessmentsChange,
  });
  return (
    <DataTable<AttackPath>
      rows={paths}
      columns={columns}
      getRowId={(p) => p.pathKey}
    />
  );
}

const RELEVANCE_HEADER = "attacktree:tabs.attacktree.threatTable.relevance";

describe("relevance column — visibility (show vs edit)", () => {
  it("is absent without treeId + assessments", () => {
    render(<Harness paths={[makePath()]} />);
    expect(screen.queryByText(RELEVANCE_HEADER)).not.toBeInTheDocument();
  });

  it("shows when treeId + assessments are present, even without a change handler", () => {
    render(
      <Harness paths={[makePath()]} treeId="t1" assessments={[]} />,
    );
    expect(screen.getByText(RELEVANCE_HEADER)).toBeInTheDocument();
    // read-only: a chip, not a toggle button group
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("becomes interactive only when onAssessmentsChange is given", () => {
    render(
      <Harness
        paths={[makePath()]}
        treeId="t1"
        assessments={[]}
        onAssessmentsChange={vi.fn()}
      />,
    );
    // three toggle buttons: relevant / not_relevant / uncertain
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });
});

describe("relevance column — one control per STRIDE category", () => {
  it("shows a single control for a single-goal path", () => {
    render(
      <Harness
        paths={[makePath({ attackGoals: ["manipulation"] })]}
        treeId="t1"
        assessments={[]}
        onAssessmentsChange={vi.fn()}
      />,
    );
    // one group → exactly the three relevance options
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("shows TWO controls for a destruction path (maps to T and D)", () => {
    // The rule that is easiest to regress: destruction is the one attack goal
    // that yields two STRIDE categories, so its row must carry two independent
    // relevance controls — six buttons, not three.
    render(
      <Harness
        paths={[makePath({ attackGoals: ["destruction"] })]}
        treeId="t1"
        assessments={[]}
        onAssessmentsChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("reflects an existing decision on the right category only", () => {
    // A T decision must not light up the D control on a destruction path.
    const assessments: AttackPathAssessment[] = [
      {
        pathKey: "abc123",
        strideCategory: "T",
        relevance: "relevant",
      } as AttackPathAssessment,
    ];
    render(
      <Harness
        paths={[makePath({ attackGoals: ["destruction"] })]}
        treeId="t1"
        assessments={assessments}
        onAssessmentsChange={vi.fn()}
      />,
    );
    // exactly one button is pressed (the T "relevant"), the D group is untouched
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });
});
