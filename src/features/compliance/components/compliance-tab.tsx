// features/compliance/components/compliance-tab.tsx
//
// The Compliance tab (iec-62443-4-2-cra-coverage.md D-9, IEC-8): the
// IEC 62443-4-2 requirement matrix of the project — component under
// evaluation (D-7), device categories of the 2019 edition (K-C1), target
// SL-C per FR with the achieved and planned values (D-2, D-4, D-14), and
// the rows with their status, source and the analyst statements (D-8, D-17).
// A standard without security levels (EN 50742 A, CM-11) shows a status
// summary instead of the SL table, its row groups, and no component when its
// family assesses the whole model.
//
// Presentational: the app layer evaluates the model (compliance-report.ts)
// and stores what the tab changes (project.compliance).

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  complianceComponentOf,
  emptyCybersecurityConcept,
  familyCompliance,
  familyHasComponent,
  FOUNDATIONAL_REQUIREMENTS,
  withComplianceComponent,
  withComplianceStatement,
  withComplianceTarget,
  withDeviceCategories,
  withoutComplianceStatement,
  WINDOW_OF_OPPORTUNITY_OPTIONS,
  type ComplianceData,
  type ComplianceStatement,
  type CybersecurityConcept,
  type DeviceCategory,
  type StatementStatus,
  type TargetSecurityLevel,
} from "shared";
import type { AnyEdition, AnyRequirementId } from "../models/compliance-types";
import type { StandardHeader } from "../services/standard-registry";
import type { ComplianceResult, RowResult, RowStatus } from "../models/evaluation-types";
import type { DeviceCategoryProposal } from "../services/device-category";
import {
  describeLanguageOf,
  describeRequirement,
  localizedChecklist,
  words,
  type RequirementDescription,
} from "../services/describe-requirement";
import { buildTodoList } from "../services/todo-list";
import { editionStatements, statementKeyOf } from "../services/edition-statements";
import { qualifyRequirementId } from "../models/compliance-types";
import { RowClaims } from "./matrix-claims";

const NS = "compliance";

const GUIDE_SEEN_KEY = "taraflow.compliance.guideSeen";

function guideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, "1");
  } catch {
    // no storage (e.g. private mode): the guide opens again next time
  }
}

/** Keys of the compliance namespace live under "compliance.*" (one file per feature, full key paths). */
function useComplianceT() {
  const { t } = useTranslation(NS);
  const translate = t as unknown as (key: string, options: Record<string, unknown>) => string;
  return (key: string, defaultValue: string, options?: Record<string, unknown>): string =>
    translate(`compliance.${key}`, { defaultValue, ...(options ?? {}) });
}

const DEVICE_CATEGORIES: DeviceCategory[] = ["SAR", "EDR", "HDR", "NDR"];
const OPEN_STATUSES: readonly RowStatus[] = ["gap", "unknown", "needs-statement", "pending-category"];

/** The row filter (user 2026-11-02): all, the open rows, or one status; "met" includes "claimed". */
type RowFilter = "all" | "open" | "gap" | "needs-statement" | "unknown" | "n/a" | "met";
const ROW_FILTERS: readonly RowFilter[] = ["all", "open", "gap", "needs-statement", "unknown", "n/a", "met"];
const FILTER_DEFAULT: Record<RowFilter, string> = {
  all: "All",
  open: "Open",
  gap: "Gap",
  "needs-statement": "Statement needed",
  unknown: "Information missing",
  "n/a": "Not applicable",
  met: "Met (incl. claimed)",
};

function matchesFilter(row: RowResult, filter: RowFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return OPEN_STATUSES.includes(row.status) || !!row.statementModelChanged;
    case "met":
      return row.status === "met" || row.status === "claimed";
    default:
      return row.status === filter;
  }
}

const STATUS_DEFAULT: Record<RowStatus, string> = {
  met: "met",
  claimed: "claimed",
  "n/a": "not applicable",
  unknown: "information missing",
  "pending-category": "confirm category",
  "needs-statement": "statement needed",
  gap: "gap",
};
const STATUS_COLOR: Record<RowStatus, "success" | "info" | "default" | "warning" | "error"> = {
  met: "success",
  claimed: "info",
  "n/a": "default",
  unknown: "warning",
  "pending-category": "warning",
  "needs-statement": "warning",
  gap: "error",
};
const SOURCE_DEFAULT: Record<string, string> = {
  model: "model",
  mitigation: "mitigation",
  "supporting-measure": "supporting measure",
  statement: "statement",
  claim: "claim",
  edition: "edition",
  "device-category": "device category",
};
const STATEMENT_DEFAULT: Record<StatementStatus, string> = { met: "met", "not-met": "not met", "n/a": "not applicable" };

/**
 * A row met by a statement, mitigation, supporting measure or claim while the
 * model alone still has gaps or missing properties (user 2026-11-06, CR 1.7):
 * the missing properties are said to be the model's, not the row's.
 */
const modelStillOpen = (row: { status: string; source?: string; modelStatus: string }) =>
  row.status === "met" && !!row.source && row.source !== "model" && (row.modelStatus === "unknown" || row.modelStatus === "gap");

export interface ComplianceTabProps {
  edition: AnyEdition;
  /** The standard's header kind; absent = security levels (IEC 62443-4-2). */
  header?: StandardHeader;
  achieved: ComplianceResult;
  planned: ComplianceResult;
  data: ComplianceData | undefined;
  /** Elements that can be the component (Multiprocess, Process). */
  componentOptions: readonly { id: string; label: string }[];
  /** 2019 edition: the proposal for the selected component (K-C1). */
  deviceProposal?: DeviceCategoryProposal;
  /** Element id → "P-6 Maintenance Authentication Service". */
  nameOf: (id: string) => string;
  /** ISO date stored with a statement. */
  today: string;
  onChange: (data: ComplianceData) => void;
  /** "Show in the diagram": the DFD tab opens the drawing with the element selected. */
  onShowElement?: (elementId: string) => void;
  /** Element / flow id → type, for the properties of the to-do list. */
  typeOf?: (id: string) => string | undefined;
  /** Goals and claims of the project — the supporting claims cover matrix rows (D-5, IEC-6). */
  concept?: CybersecurityConcept;
  /** Stores claim changes; absent = the info dialog shows no claims. */
  onConceptChange?: (concept: CybersecurityConcept) => void;
  /** Catalog mitigations for a row; filtered to the types of the elements still open (D-29). */
  mitigationSuggestions?: (
    requirementIds: readonly AnyRequirementId[],
    openElementIds: readonly string[],
  ) => readonly { id: string; text: string }[];
}

/** Element type → its block under tabs.dfd.element_description (dfd namespace). */
const DESCRIPTION_KEY: Readonly<Record<string, string>> = {
  ExternalEntity: "external_entity",
  DataFlow: "dataflow",
  DataStore: "datastore",
};

/**
 * FX-21: "MP-1 Controller (Password lifetime limit)" — the unknown element
 * with the fields it lacks, under the DFD form's label where one exists.
 */
function useUnknownNames(nameOf: (id: string) => string, typeOf?: (id: string) => string | undefined) {
  const { t, i18n } = useTranslation("dfd");
  const label = (path: string, id: string): string => {
    const type = typeOf?.(id);
    const keys = [
      `tabs.dfd.modelFields.${path.split(".").pop()}.label`,
      ...(type ? [`tabs.dfd.element_description.${DESCRIPTION_KEY[type] ?? type.toLowerCase()}.fields.${path}.label`] : []),
    ];
    const key = keys.find((k) => i18n?.exists?.(k, { ns: "dfd" }));
    return key ? String(t(key)) : words(path);
  };
  return (row: RowResult): string[] =>
    row.unknown.map((id) => {
      const fields = row.unsetFields?.[id] ?? [];
      return fields.length > 0 ? `${nameOf(id)} (${fields.map((f) => label(f, id)).join(", ")})` : nameOf(id);
    });
}

/** FX-22: the edition's reason for a void row (EditionRow.void) → its text key. */
export const VOID_REASONS: Readonly<Record<string, { key: string; text: string }>> = {
  "void in prAA": {
    key: "voidInPraa",
    text: "The CRA edition (EN IEC 62443-4-2/prAA) declares this requirement void — it does not apply to the component.",
  },
  "no component requirement": {
    key: "noComponentRequirement",
    text: "The standard sets no component requirement under this number — the topic is left to the system (IEC 62443-3-3).",
  },
  "no component requirement (SR 2.3 is system level)": {
    key: "noComponentRequirementSr23",
    text: "The standard sets no component requirement under this number — SR 2.3 is a system requirement (IEC 62443-3-3).",
  },
  "no component requirement (emergency power, system level)": {
    key: "noComponentRequirementPower",
    text: "The standard sets no component requirement under this number — emergency power is a matter of the system (IEC 62443-3-3).",
  },
};

/** The reason of a void row in the UI language; an unknown reason as written in the edition. */
const voidReasonText = (t: ReturnType<typeof useComplianceT>, reasoning: string | undefined): string => {
  const known = reasoning ? VOID_REASONS[reasoning] : undefined;
  return known ? t(`voidReason.${known.key}`, known.text) : (reasoning ?? "");
};

/** First items of a list, the rest counted. */
const shortList = (items: readonly string[], max = 4) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} (+${items.length - max})`;

export const ComplianceTab: React.FC<ComplianceTabProps> = ({
  edition,
  header = "security-levels",
  achieved,
  planned,
  data,
  componentOptions,
  deviceProposal,
  nameOf,
  today,
  onChange,
  onShowElement,
  mitigationSuggestions,
  typeOf,
  concept,
  onConceptChange,
}) => {
  const t = useComplianceT();
  const { i18n } = useTranslation(NS);
  const unknownNames = useUnknownNames(nameOf, typeOf);
  const lang = describeLanguageOf(i18n?.language);
  const [filter, setFilter] = useState<RowFilter>("open");
  const [editing, setEditing] = useState<RowResult | null>(null);
  const [info, setInfo] = useState<RowResult | null>(null);
  // The quick guide: open the first time the tab is shown on this machine,
  // collapsed from then on (user 2026-11-01); it can always be opened.
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen());
  useEffect(() => markGuideSeen(), []);
  const hasDeviceRows = edition.rows.some((r) => r.deviceCategories);
  const levels = header === "security-levels";
  const cra = edition.id === "en-iec-62443-4-2-praa-2026";
  // The edition's family block (K-2); component: the family's own, else the default (K-5).
  const family = edition.family;
  const familyData = familyCompliance(data, family);
  const hasComponent = familyHasComponent(family);
  // D-31: one statement per requirement, shared by the editions of the family.
  const statements = useMemo(() => editionStatements(edition, familyData.statements), [edition, familyData.statements]);
  const keyOf = (label: string) => {
    const row = rowDef.get(label);
    return row ? statementKeyOf(row) : label;
  };
  const rowDef = useMemo(() => new Map(edition.rows.map((r) => [r.label, r])), [edition]);

  const rows = useMemo(() => achieved.rows.filter((r) => matchesFilter(r, filter)), [achieved.rows, filter]);
  const filterCount = useMemo(
    () => new Map(ROW_FILTERS.map((f) => [f, achieved.rows.filter((r) => matchesFilter(r, f)).length])),
    [achieved.rows],
  );

  const target = useMemo(() => familyData.target ?? {}, [familyData.target]);
  // Without levels there is no target: every open row is to do.
  const hasTarget = !levels || Object.keys(target).length > 0;
  const todo = useMemo(
    () => buildTodoList(edition, achieved, planned, levels ? target : "all", typeOf),
    [edition, achieved, planned, target, typeOf, levels],
  );
  const srsl = achieved.srsl;
  // The WoO names live with the Overview selector (common namespace).
  const wooLabel = (id: string | undefined) => {
    const option = id ? WINDOW_OF_OPPORTUNITY_OPTIONS.find((o) => o.id === id) : undefined;
    return option ? String(i18n?.t?.(option.nameKey, { ns: "common", defaultValue: id }) ?? id) : id;
  };
  const statusCounts = useMemo(() => {
    const counts = new Map<RowStatus, number>();
    for (const r of achieved.rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return counts;
  }, [achieved.rows]);
  const rowByLabel = useMemo(() => new Map(achieved.rows.map((r) => [r.label, r])), [achieved.rows]);
  const openInfo = (label: string) => {
    const row = rowByLabel.get(label);
    if (row) setInfo(row);
  };
  /** A requirement number: tooltip with title and summary, a click opens the info dialog (D-27). */
  const requirementLink = (label: string, testId?: string) => {
    const descriptions = (rowDef.get(label)?.requirementIds ?? []).map((id) => describeRequirement(id, lang));
    const link = (
      <Link
        component="button"
        variant="body2"
        underline="hover"
        onClick={() => openInfo(label)}
        sx={{ verticalAlign: "baseline" }}
        data-testid={testId}
      >
        {label}
      </Link>
    );
    // FX-22: a void row has no description — the tooltip and the dialog give the edition's reason.
    if (descriptions.length === 0) {
      const reason = voidReasonText(t, rowByLabel.get(label)?.reasoning);
      return reason ? (
        <Tooltip arrow placement="right" title={<Box sx={{ maxWidth: 360 }}>{reason}</Box>}>
          {link}
        </Tooltip>
      ) : (
        link
      );
    }
    return (
      <Tooltip arrow placement="right" title={<RequirementTooltip label={label} descriptions={descriptions} />}>
        {link}
      </Tooltip>
    );
  };

  const choice = familyData.deviceCategories;
  const confirmedCategories = choice?.source === "manual" ? choice.categories : [];

  return (
    <Box sx={{ p: 3 }} data-testid="compliance-tab">
      <Stack spacing={3}>
        {/* ── Quick guide ───────────────────────────────────────────── */}
        <Accordion
          variant="outlined"
          expanded={guideOpen}
          onChange={(_, open) => setGuideOpen(open)}
          disableGutters
          data-testid="compliance-guide"
        >
          <AccordionSummary expandIcon={<span aria-hidden>▾</span>}>
            <Typography variant="subtitle1">{t("guideTitle", "How to work with this tab")}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box component="ol" sx={{ m: 0, pl: 3, "& li": { mb: 0.5 } }}>
              {hasComponent && <li>{t("guide1", "Choose the component under evaluation — or keep the whole model.")}</li>}
              {levels ? (
                <li>{t("guide2", "Set the SL-T per foundational requirement: what the operator, the zone or your customer requires.")}</li>
              ) : (
                <li>{t("guideSrsl", "There is no target to set: the SRSL comes from the rated risks in the risk tab, and the requirements apply to the whole machine.")}</li>
              )}
              <li>{t("guide3", "Work through the to-do list: set the missing properties in the DFD, and choose mitigations in the risk treatment where the model shows a requirement not met.")}</li>
              <li>{t("guide4", "Rows the model cannot show need a statement: reasoning and where the evidence is (manual, test report). Click a requirement number for everything about it.")}</li>
              {levels && (
                <li>{t("guide5", "Compare SL-C (product) with the SL-T: planned shows the value once the chosen mitigations are done; a gap that remains needs a change of the product or a measure of the system around it.")}</li>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* ── Basis ─────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">{edition.title}</Typography>
            {edition.draft && <Chip size="small" color="warning" label={t("draft", "draft")} />}
            {!hasComponent && <Chip size="small" variant="outlined" label={t("wholeMachine", "Scope: the whole machine")} />}
            {hasComponent && (
              <TextField
                select
                size="small"
                sx={{ minWidth: 320 }}
                label={t("component", "Component under evaluation")}
                value={complianceComponentOf(data, family) ?? ""}
                onChange={(e) => onChange(withComplianceComponent(data, e.target.value || undefined))}
                inputProps={{ "data-testid": "compliance-component" }}
              >
                <MenuItem value="">{t("wholeModel", "Whole model")}</MenuItem>
                {componentOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              "intro",
              "The matrix is derived from the model: properties, the mitigations of the risk treatment, supporting measures outside the component, your statements and claims. Unset properties count as unknown — never as not applicable.",
            )}
          </Typography>

          {hasDeviceRows && (
            <Box sx={{ mt: 2 }} data-testid="compliance-device-categories">
              <Typography variant="subtitle2">{t("deviceCategories", "Device categories (IEC 62443-4-2:2019)")}</Typography>
              {choice?.source !== "manual" && (
                <Alert severity="warning" sx={{ my: 1 }}>
                  {deviceProposal && deviceProposal.categories.length > 0
                    ? t("deviceProposal", "Proposal from the model: {{categories}} — confirm before the device rows count.", {
                        categories: deviceProposal.categories.join(", "),
                      })
                    : t("deviceAsk", "Choose the device category of the component — workstation or mobile device: HDR if the device is delivered, SAR for an app or tool only.")}
                </Alert>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                {DEVICE_CATEGORIES.map((category) => {
                  const current = choice?.source === "manual" ? confirmedCategories : deviceProposal?.categories ?? [];
                  return (
                    <FormControlLabel
                      key={category}
                      label={category}
                      control={
                        <Checkbox
                          size="small"
                          checked={current.includes(category)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...current, category] : current.filter((c) => c !== category);
                            onChange(withDeviceCategories(data, family, { categories: next, source: "manual" }));
                          }}
                        />
                      }
                    />
                  );
                })}
                {choice?.source !== "manual" && deviceProposal && deviceProposal.categories.length > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onChange(withDeviceCategories(data, family, { categories: deviceProposal.categories, source: "manual" }))}
                  >
                    {t("confirm", "Confirm")}
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </Paper>

        {/* ── Without levels: rows per status ───────────────────────── */}
        {!levels && (
          <Paper variant="outlined" sx={{ p: 2 }} data-testid="compliance-summary">
            <Typography variant="subtitle1" gutterBottom>
              {srsl ? t("srslTitle", "SRSL per safety function and requirements per status") : t("summaryTitle", "Requirements per status")}
            </Typography>
            {srsl && (
              <Box sx={{ mb: 1.5 }} data-testid="compliance-srsl">
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t("woo", "Window of opportunity")}: {wooLabel(srsl.windowOfOpportunity) ?? t("notSet", "not set")}
                </Typography>
                {srsl.safetyFunctions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("noSafetyFunctions", "No safety function yet — mark the safety functions as assets with a physical impact.")}
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("safetyFunction", "Safety function")}</TableCell>
                        <TableCell>{t("highestSrsl", "Highest SRSL (from the risks)")}</TableCell>
                        <TableCell>{t("pathInterfaces", "Interfaces on the path")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {srsl.safetyFunctions.map((sf) => (
                        <TableRow key={sf.id} data-testid={`compliance-srsl-${sf.id}`}>
                          <TableCell>{sf.name}</TableCell>
                          <TableCell>{sf.srsl === null ? t("notRated", "not rated") : `SRSL${sf.srsl}`}</TableCell>
                          <TableCell>{sf.interfaces.length > 0 ? shortList(sf.interfaces.map(nameOf), 6) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(Object.keys(STATUS_DEFAULT) as RowStatus[])
                .filter((status) => statusCounts.has(status))
                .map((status) => (
                  <Chip
                    key={status}
                    size="small"
                    color={STATUS_COLOR[status]}
                    label={`${t(`status.${status}`, STATUS_DEFAULT[status])}: ${statusCounts.get(status)}`}
                    data-testid={`compliance-summary-${status}`}
                  />
                ))}
            </Stack>
          </Paper>
        )}

        {/* ── SL table (D-26): FRs as columns ─────────────────────── */}
        {levels && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t("vectorTitle", "Security levels per foundational requirement")}
            </Typography>
            <Table size="small" data-testid="compliance-vector">
              <TableHead>
                <TableRow>
                  <TableCell />
                  {FOUNDATIONAL_REQUIREMENTS.map((fr) => (
                    <TableCell key={fr} align="center">
                      {fr}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{t("target", "SL-T (requirement)")}</span>
                      <TextField
                        select
                        size="small"
                        label={t("targetAll", "all FR")}
                        value=""
                        sx={{ minWidth: 96 }}
                        onChange={(e) => {
                          const level = e.target.value === "-" ? undefined : (Number(e.target.value) as TargetSecurityLevel);
                          let next = data;
                          for (const fr of FOUNDATIONAL_REQUIREMENTS) next = withComplianceTarget(next, family, fr, level);
                          if (next) onChange(next);
                        }}
                        inputProps={{ "data-testid": "compliance-target-all" }}
                      >
                        <MenuItem value="-">—</MenuItem>
                        {["1", "2", "3", "4"].map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </TableCell>
                  {FOUNDATIONAL_REQUIREMENTS.map((fr) => {
                    const target = familyData.target?.[fr];
                    return (
                      <TableCell key={fr} align="center">
                        <TextField
                          select
                          size="small"
                          value={target === undefined ? "" : String(target)}
                          onChange={(e) =>
                            onChange(withComplianceTarget(data, family, fr, e.target.value === "" ? undefined : (Number(e.target.value) as TargetSecurityLevel)))
                          }
                          inputProps={{ "data-testid": `compliance-target-${fr}` }}
                        >
                          <MenuItem value="">—</MenuItem>
                          {["1", "2", "3", "4"].map((n) => (
                            <MenuItem key={n} value={n}>
                              {n}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    );
                  })}
                </TableRow>
                {(
                  [
                    ["slcProduct", t("achievedComponent", "SL-C (product)"), achieved.component, true],
                    ["slcPlanned", t("plannedComponent", "SL-C planned"), planned.component, true],
                    ["withSystem", t("achievedWithSupport", "With measures of the system"), achieved.withSupport, false],
                  ] as const
                ).map(([key, label, values, compare]) => (
                  <TableRow key={key} data-testid={`compliance-vector-${key}`}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{label}</TableCell>
                    {FOUNDATIONAL_REQUIREMENTS.map((fr) => (
                      <TableCell key={fr} align="center">
                        <LevelChip value={values[fr]} target={compare ? familyData.target?.[fr] : undefined} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t(
                "vectorText",
                "SL-T: what the operator or the zone requires. SL-C (product): what the product provides according to the model; planned: after the chosen open mitigations. With measures of the system: what the plant can reach if it provides the listed supporting measures and claims — the basis for the SL-A, which only arises in the operated plant.",
              )}
            </Typography>
          </Paper>
        )}

        {/* ── To do up to the SL-T ───────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }} data-testid="compliance-todo">
          <Typography variant="subtitle1" gutterBottom>
            {levels ? t("todoTitle", "To do up to the SL-T") : t("todoTitleAll", "To do")}
          </Typography>
          {!hasTarget ? (
            <Alert severity="info">{t("todoNoTarget", "Set the SL-T above — the to-do list shows what is open up to it.")}</Alert>
          ) : todo.elements.length === 0 &&
            todo.component.length === 0 &&
            todo.statements.length === 0 &&
            todo.risks.length === 0 &&
            todo.project.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {levels ? t("todoNothing", "Nothing open up to the SL-T.") : t("todoNothingAll", "Nothing open.")}
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {todo.elements.map((element) => (
                <Box key={element.elementId} data-testid={`compliance-todo-${element.elementId}`}>
                  <Typography variant="subtitle2">
                    {onShowElement ? (
                      <Tooltip title={t("showInDiagram", "Show in the diagram")}>
                        <Link
                          component="button"
                          variant="subtitle2"
                          underline="hover"
                          onClick={() => onShowElement(element.elementId)}
                          data-testid={`compliance-todo-link-${element.elementId}`}
                        >
                          {nameOf(element.elementId)}
                        </Link>
                      </Tooltip>
                    ) : (
                      nameOf(element.elementId)
                    )}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    {element.items.map((item) => (
                      <li key={`${item.label}-${item.kind}`}>
                        <Typography variant="body2" component="span">
                          {requirementLink(item.label)}
                          {" — "}
                          {item.kind === "not-met"
                            ? t("todoNotMet", "not met, check")
                            : item.kind === "inside"
                              ? t("todoInside", "set its inside fields (black box), model its processes and stores on a child page, or make a statement")
                              : t("todoMissing", "set")}
                          {item.properties.length > 0 && `: ${item.properties.join(", ")}`}
                        </Typography>
                        {item.plannedClosed && (
                          <Chip size="small" color="info" variant="outlined" sx={{ ml: 1 }} label={t("todoPlanned", "closed by planned mitigations")} />
                        )}
                      </li>
                    ))}
                  </Box>
                </Box>
              ))}
              {todo.component.length > 0 && (
                <Box data-testid="compliance-todo-component">
                  <Typography variant="subtitle2">{t("todoComponent", "For the component — one element suffices")}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    {todo.component.map((item) => (
                      <li key={item.label}>
                        <Typography variant="body2" component="span">
                          {requirementLink(item.label)}
                          {` — ${t("todoOnOne", "on one {{types}}", { types: item.elementTypes.join(" / ") })}: ${item.properties.join(", ")}`}
                        </Typography>
                        {item.plannedClosed && (
                          <Chip size="small" color="info" variant="outlined" sx={{ ml: 1 }} label={t("todoPlanned", "closed by planned mitigations")} />
                        )}
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {todo.risks.length > 0 && (
                <Box data-testid="compliance-todo-risks">
                  <Typography variant="subtitle2">{t("todoRisks", "In the risk tab — rate the risk or choose the mandated control")}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    {todo.risks.map((item) => (
                      <li key={item.label}>
                        <Typography variant="body2" component="span">
                          {requirementLink(item.label)}: {shortList(item.risks, 6)}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {todo.project.length > 0 && (
                <Box data-testid="compliance-todo-project">
                  <Typography variant="subtitle2">{t("todoProject", "In the project data — hazards, overview, item definition")}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    {todo.project.map((item) => (
                      <li key={item.label}>
                        <Typography variant="body2" component="span">
                          {requirementLink(item.label)}
                          {item.reasoning ? `: ${item.reasoning}` : ""}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {todo.statements.length > 0 && (
                <Box data-testid="compliance-todo-statements">
                  <Typography variant="subtitle2">{t("todoStatements", "Statements needed")}</Typography>
                  <Typography variant="body2">
                    {todo.statements.map((s, i) => (
                      <React.Fragment key={s.label}>
                        {i > 0 && ", "}
                        {requirementLink(s.label)}
                      </React.Fragment>
                    ))}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Paper>

        {/* ── Rows ──────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">{t("rowsTitle", "Requirements")}</Typography>
            <TextField
              select
              size="small"
              label={t("filterLabel", "Show")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as RowFilter)}
              inputProps={{ "data-testid": "compliance-filter" }}
              sx={{ minWidth: 220 }}
            >
              {ROW_FILTERS.map((f) => (
                <MenuItem key={f} value={f}>
                  {t(`filter.${f}`, FILTER_DEFAULT[f])} ({filterCount.get(f) ?? 0})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Table size="small" data-testid="compliance-rows">
            <TableHead>
              <TableRow>
                <TableCell>{t("requirement", "Requirement")}</TableCell>
                {levels ? <TableCell>{t("minSl", "SL-C from")}</TableCell> : <TableCell>{t("groupColumn", "Group")}</TableCell>}
                {cra && <TableCell>{t("cra", "CRA")}</TableCell>}
                <TableCell>{t("statusColumn", "Status")}</TableCell>
                <TableCell>{t("sourceColumn", "Source")}</TableCell>
                <TableCell>{t("notes", "Notes")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const descriptions = (rowDef.get(row.label)?.requirementIds ?? []).map((id) => describeRequirement(id, lang));
                const checklist = localizedChecklist(descriptions, row.checklist);
                const notes = [
                  row.failing.length > 0 && `${t("failing", "not met by")}: ${shortList(row.failing.map(nameOf))}`,
                  row.unknown.length > 0 &&
                    (modelStillOpen(row)
                      ? t("modelUnknown", "model still open — information missing on {{elements}}", { elements: shortList(unknownNames(row)) })
                      : `${t("unknown", "information missing on")} ${shortList(unknownNames(row))}`),
                  row.supportingElements.length > 0 && `${t("supporting", "supporting measure")}: ${shortList(row.supportingElements.map(nameOf))}`,
                  row.mitigationIds.length > 0 && `${t("mitigations", "mitigations")}: ${shortList([...new Set(row.mitigationIds)])}`,
                  // phase 4b: unclear is not planned — an assumption of use lacks evidence (another action)
                  (row.unclearMitigationIds?.length ?? 0) > 0 &&
                    `${t("unclearMitigations", "unclear (assumption of use without evidence)")}: ${shortList(row.unclearMitigationIds!)}`,
                  row.risks && row.risks.length > 0 && `${t("risks", "risks")}: ${shortList(row.risks)}`,
                  !levels && row.source !== "statement" && !row.failing.length && !row.unknown.length && !row.risks?.length && row.status !== "met" && row.status !== "n/a" && row.reasoning,
                  checklist.length > 0 && `${t("checklist", "to confirm")}: ${checklist.join("; ")}`,
                  row.source === "statement" && row.reasoning,
                ].filter(Boolean);
                return (
                  <TableRow key={row.label} data-testid={`compliance-row-${row.label}`}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {requirementLink(row.label, `compliance-req-${row.label}`)}
                    </TableCell>
                    <TableCell>{levels ? (row.minSl ?? "—") : t(`group.${row.group}`, row.group)}</TableCell>
                    {cra && <TableCell>{(rowDef.get(row.label)?.cra ?? []).join(", ") || "—"}</TableCell>}
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[row.status]} label={t(`status.${row.status}`, STATUS_DEFAULT[row.status])} />
                    </TableCell>
                    <TableCell>{row.source ? t(`sourceName.${row.source}`, SOURCE_DEFAULT[row.source]) : ""}</TableCell>
                    <TableCell sx={{ maxWidth: 520 }}>
                      <Typography variant="body2">{notes.join(" · ")}</Typography>
                      {row.contradiction && (
                        <Typography variant="body2" color="error.main">
                          {t("contradiction", "Mitigation marked done, but the model shows the requirement not met.")}
                        </Typography>
                      )}
                      {row.statementModelChanged && (
                        <Typography variant="body2" color="warning.main">
                          {t("modelChanged", "The model changed since the statement — review it.")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.source !== "edition" && (
                        <Button size="small" onClick={() => setEditing(row)} data-testid={`compliance-statement-${row.label}`}>
                          {statements[row.label] ? t("editStatement", "Statement") : t("addStatement", "Add statement")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {filter === "open" ? t("noOpenRows", "No open requirements.") : t("noRowsFilter", "No requirements with this status.")}
            </Typography>
          )}
        </Paper>
      </Stack>

      {info && (
        <RequirementInfoDialog
          row={info}
          descriptions={(rowDef.get(info.label)?.requirementIds ?? []).map((id) => describeRequirement(id, lang))}
          cra={cra ? [...(rowDef.get(info.label)?.cra ?? [])] : undefined}
          levels={levels}
          claims={
            onConceptChange ? (
              <RowClaims
                concept={concept ?? emptyCybersecurityConcept()}
                requirements={(rowDef.get(info.label)?.requirementIds ?? []).map((id) => qualifyRequirementId(family, id))}
                onConceptChange={onConceptChange}
                t={t}
              />
            ) : undefined
          }
          statement={statements[info.label]}
          suggestions={mitigationSuggestions?.(rowDef.get(info.label)?.requirementIds ?? [], [...info.failing, ...info.unknown]) ?? []}
          nameOf={nameOf}
          unknownNames={unknownNames(info)}
          t={t}
          onClose={() => setInfo(null)}
          onStatement={() => {
            // The info dialog goes first, then the statement dialog opens — never two at once.
            const row = info;
            setInfo(null);
            setEditing(row);
          }}
        />
      )}

      {editing && (
        <StatementDialog
          row={editing}
          existing={statements[editing.label]}
          onClose={() => setEditing(null)}
          onSave={(statement) => {
            onChange(withComplianceStatement(data, family, keyOf(editing.label), statement));
            setEditing(null);
          }}
          onRemove={() => {
            onChange(withoutComplianceStatement(data, family, keyOf(editing.label)));
            setEditing(null);
          }}
          today={today}
        />
      )}
    </Box>
  );
};

// ==================== REQUIREMENT TOOLTIP AND INFO DIALOG (D-27) ====================
// Title and our own summary — never the normative text.

/** Compact: title and summary; a click on the number opens the info dialog. */
const RequirementTooltip: React.FC<{ label: string; descriptions: readonly RequirementDescription[] }> = ({ label, descriptions }) => (
  <Box sx={{ maxWidth: 360 }} data-testid={`compliance-tooltip-${label}`}>
    {descriptions.map((d) => (
      <Box key={d.id} sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2">
          {label} – {d.title}
        </Typography>
        <Typography variant="body2">{d.summary}</Typography>
      </Box>
    ))}
  </Box>
);

interface RequirementInfoDialogProps {
  row: RowResult;
  descriptions: readonly RequirementDescription[];
  cra?: readonly string[];
  /** The standard has security levels: the row's SL-C from. */
  levels: boolean;
  /** The claims covering the row, with add / remove (IEC-6). */
  claims?: React.ReactNode;
  statement?: ComplianceStatement;
  suggestions: readonly { id: string; text: string }[];
  nameOf: (id: string) => string;
  /** FX-21: the unknown elements with their missing fields. */
  unknownNames: readonly string[];
  t: ReturnType<typeof useComplianceT>;
  onClose: () => void;
  onStatement: () => void;
}

const RequirementInfoDialog: React.FC<RequirementInfoDialogProps> = ({
  row,
  descriptions,
  cra,
  levels,
  claims,
  statement,
  suggestions,
  nameOf,
  unknownNames,
  t,
  onClose,
  onStatement,
}) => {
  const section = (title: string, body: React.ReactNode) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2">{title}</Typography>
      {body}
    </Box>
  );
  const checklist = localizedChecklist(descriptions, row.checklist);
  /** FX-22: a row the edition declares void — only its reason, nothing to check or state. */
  const isVoid = row.source === "edition";
  return (
    // At most 80 % of the window: a long description scrolls inside, title and buttons stay in view.
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { maxHeight: "80vh" } }}
      data-testid="compliance-info-dialog"
    >
      <DialogTitle>
        {descriptions.length > 0 ? `${row.label} – ${descriptions.map((d) => d.title).join(" / ")}` : row.label}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap">
          {levels && <Chip size="small" label={`${t("minSl", "SL-C from")} ${row.minSl ?? "—"}`} />}
          {cra && cra.length > 0 && <Chip size="small" label={`CRA ${cra.map((c) => `(2)(${c})`).join(", ")}`} />}
          <Chip size="small" color={STATUS_COLOR[row.status]} label={t(`status.${row.status}`, STATUS_DEFAULT[row.status])} />
          {row.source && <Chip size="small" variant="outlined" label={t(`sourceName.${row.source}`, SOURCE_DEFAULT[row.source])} />}
        </Stack>
        {modelStillOpen(row) && (
          <Alert severity="info" sx={{ mb: 1.5 }} data-testid="compliance-met-model-open">
            {t("metModelOpen", "Met by the {{source}}. The model alone does not show it yet — see the elements below; once their properties meet the requirement, the model does too.", {
              source: t(`sourceName.${row.source}`, SOURCE_DEFAULT[row.source!]),
            })}
          </Alert>
        )}
        {isVoid &&
          section(
            t("whyNotApplicable", "Why not applicable"),
            <Typography variant="body2" data-testid="compliance-void-reason">
              {voidReasonText(t, row.reasoning)}
            </Typography>,
          )}
        {descriptions.length > 0 &&
          section(
            t("whatItIsAbout", "What it is about"),
            descriptions.map((d) => (
              <Typography key={d.id} variant="body2">
                {d.summary}
              </Typography>
            )),
          )}
        {descriptions.length > 0 &&
          section(
            t("howChecked", "How TARAflow checks it"),
            descriptions.map((d) => (
              <Typography key={d.id} variant="body2">
                {d.check}
              </Typography>
            )),
          )}
        {(row.failing.length > 0 || row.unknown.length > 0 || row.supportingElements.length > 0) &&
          section(
            t("elements", "Elements"),
            <>
              {row.failing.length > 0 && (
                <Typography variant="body2">
                  {t("failing", "not met by")}: {row.failing.map(nameOf).join(", ")}
                </Typography>
              )}
              {row.unknown.length > 0 && (
                <Typography variant="body2">
                  {modelStillOpen(row) ? `${t("modelPrefix", "Model")}: ` : ""}
                  {t("unknown", "information missing on")} {unknownNames.join(", ")}
                </Typography>
              )}
              {row.supportingElements.length > 0 && (
                <Typography variant="body2">
                  {t("supporting", "supporting measure")}: {row.supportingElements.map(nameOf).join(", ")}
                </Typography>
              )}
            </>,
          )}
        {row.contradiction && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {t("contradiction", "Mitigation marked done, but the model shows the requirement not met.")}
          </Alert>
        )}
        {checklist.length > 0 &&
          section(
            t("checklist", "to confirm"),
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {checklist.map((c) => (
                <li key={c}>
                  <Typography variant="body2">{c}</Typography>
                </li>
              ))}
            </ul>,
          )}
        {suggestions.length > 0 &&
          section(
            t("suggestions", "Catalog mitigations"),
            suggestions.map((m) => (
              <Typography key={m.id} variant="body2">
                <b>{m.id}</b> {m.text}
              </Typography>
            )),
          )}
        {!isVoid &&
          section(
            t("statementSection", "Statement"),
            statement ? (
              <>
                <Typography variant="body2">
                  {t(`statementStatusName.${statement.status}`, STATEMENT_DEFAULT[statement.status])} — {statement.reasoning}
                </Typography>
                {statement.supportingMeasure && (
                  <Typography variant="body2">
                    {t("supportingMeasure", "Supporting measure (outside the component)")}: {statement.supportingMeasure}
                  </Typography>
                )}
                {row.statementModelChanged && (
                  <Typography variant="body2" color="warning.main">
                    {t("modelChanged", "The model changed since the statement — review it.")}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("noStatement", "No statement yet.")}
              </Typography>
            ),
          )}
        {claims && row.source !== "edition" && section(t("claimsSection", "Claims (measures of the system)"), claims)}
        <Typography variant="caption" sx={{ fontStyle: "italic" }}>
          {t("summaryDisclaimer", "Summary in our own words — the standard is authoritative.")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("close", "Close")}</Button>
        {row.source !== "edition" && (
          <Button variant="contained" onClick={onStatement} data-testid="compliance-info-statement">
            {statement ? t("editStatement", "Statement") : t("addStatement", "Add statement")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ==================== LEVEL CHIP ====================

/** A level, compared with the SL-T by colour AND symbol (D-26). */
const LevelChip: React.FC<{ value: number; target?: number }> = ({ value, target }) => {
  if (target === undefined) return <Chip size="small" variant="outlined" label={value} />;
  const ok = value >= target;
  return (
    <Chip
      size="small"
      color={ok ? "success" : "error"}
      label={`${value} ${ok ? "✓" : "✗"}`}
      sx={{ fontWeight: 700, minWidth: 48 }}
      data-level={ok ? "meets" : "below"}
    />
  );
};

// ==================== STATEMENT DIALOG ====================

interface StatementDialogProps {
  row: RowResult;
  existing?: ComplianceStatement;
  today: string;
  onSave: (statement: ComplianceStatement) => void;
  onRemove: () => void;
  onClose: () => void;
}

const StatementDialog: React.FC<StatementDialogProps> = ({ row, existing, today, onSave, onRemove, onClose }) => {
  const t = useComplianceT();
  const [status, setStatus] = useState<StatementStatus>(existing?.status ?? "met");
  const [reasoning, setReasoning] = useState(existing?.reasoning ?? "");
  const [supportingMeasure, setSupportingMeasure] = useState(existing?.supportingMeasure ?? "");
  const [evidenceRef, setEvidenceRef] = useState(existing?.evidenceRef ?? "");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("statementTitle", "Statement on {{row}}", { row: row.label })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("statementModel", "Model result now: {{status}}. It is stored with the statement, so a later change of the model is shown.", {
              status: t(`status.${row.modelStatus}`, STATUS_DEFAULT[row.modelStatus]),
            })}
          </Typography>
          <TextField select label={t("statementStatus", "Status")} value={status} onChange={(e) => setStatus(e.target.value as StatementStatus)}
            inputProps={{ "data-testid": "statement-status" }}>
            {(Object.keys(STATEMENT_DEFAULT) as StatementStatus[]).map((s) => (
              <MenuItem key={s} value={s}>
                {t(`statementStatusName.${s}`, STATEMENT_DEFAULT[s])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("reasoning", "Reasoning")}
            required
            multiline
            minRows={2}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            inputProps={{ "data-testid": "statement-reasoning" }}
          />
          <TextField
            label={t("supportingMeasure", "Supporting measure (outside the component)")}
            helperText={t("supportingMeasureHelp", "Name it when the system around the component meets the requirement (CCSC 2).")}
            value={supportingMeasure}
            onChange={(e) => setSupportingMeasure(e.target.value)}
          />
          <TextField label={t("evidenceRef", "Evidence (document, section, test report)")} value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {existing && (
          <Button color="error" onClick={onRemove}>
            {t("removeStatement", "Remove")}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>{t("cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          disabled={reasoning.trim() === ""}
          data-testid="statement-save"
          onClick={() =>
            onSave({
              status,
              reasoning: reasoning.trim(),
              ...(supportingMeasure.trim() ? { supportingMeasure: supportingMeasure.trim() } : {}),
              ...(evidenceRef.trim() ? { evidenceRef: evidenceRef.trim() } : {}),
              modelStatusAtStatement: row.modelStatus,
              date: today,
            })
          }
        >
          {t("save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
