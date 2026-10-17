// ==================== IDENTITY REVIEW DIALOG ====================
// Leveled-DFD Phase 5b (leveled-dfd-multi-diagram-design.md §11.2.1, §5.2,
// D8, D13). One dialog, two entry points:
//
//   adoption     confirm the page tree and which cells show the same
//                element (ID_ADOPTION_PENDING)
//   assignment   pasted cells: context copy of an existing element, or a
//                new element of their own
//
// Only dfd.pages changes; the drawing stays as it is. Nothing is merged
// without the analyst's confirmation.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Radio,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import type {
  AdoptionReview,
  AssignmentReview,
  CellRef,
  IdentityReview,
} from "../services/leveled";
import type { AdoptionDecisions } from "../services/leveled";

// ==================== PROPS ====================

export interface IdentityReviewDialogProps {
  review: IdentityReview | null;
  onClose: () => void;
  /** Resolves to an error code, or null on success. */
  onApplyAdoption: (decisions: AdoptionDecisions) => Promise<string | null>;
  onApplyAssignment: (copies: readonly CellRef[]) => Promise<string | null>;
  /** "Keep all as new elements" — the paste hint is done. */
  onDismissAssignment: () => void;
}

const cellKey = (c: CellRef) => `${c.pageId}\u0000${c.cellId}`;
const parseCellKey = (key: string): CellRef => {
  const [pageId, cellId] = key.split("\u0000");
  return { pageId, cellId };
};

/** "DF-7 stream sensor data" for a tfId of the review's parse. */
function useLabels(review: IdentityReview) {
  return useMemo(() => {
    const labels = new Map<string, string>();
    for (const r of [...review.parse.elements, ...review.parse.connections]) {
      labels.set(r.id, [r.displayId, r.name].filter(Boolean).join(" "));
    }
    const pageNames = new Map(review.parse.pages.map((p) => [p.pageId, p.name || p.pageId]));
    return {
      label: (tfId: string | undefined) => (tfId ? (labels.get(tfId) ?? tfId) : ""),
      page: (pageId: string) => pageNames.get(pageId) ?? pageId,
    };
  }, [review]);
}

// ==================== DIALOG ====================

export const IdentityReviewDialog: React.FC<IdentityReviewDialogProps> = ({
  review,
  ...handlers
}) => {
  if (!review) return null;
  return review.kind === "adoption" ? (
    <AdoptionContent review={review} {...handlers} />
  ) : (
    <AssignmentContent review={review} {...handlers} />
  );
};

// ==================== ADOPTION ====================

const AdoptionContent: React.FC<
  Omit<IdentityReviewDialogProps, "review"> & { review: AdoptionReview }
> = ({ review, onClose, onApplyAdoption }) => {
  const { t } = useTranslation();
  const { label, page } = useLabels(review);
  const { proposal } = review;

  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [definition, setDefinition] = useState<Record<string, string>>({});
  const [decomposes, setDecomposes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRejected(new Set());
    setDefinition({});
    setDecomposes({});
    setError(null);
  }, [review]);

  // Every page except the root details a multiprocess — a page without one
  // would be a second root (§5.3). Decomposition per page: the analyst's
  // choice, else the proposal.
  const chosenDecomposes = (p: { pageId: string; decomposes?: string }) =>
    decomposes[p.pageId] ?? p.decomposes ?? "";

  // Decomposition targets: the proposed candidates first, then every other
  // multiprocess that is not just a copy of a grouped one — without those
  // another page already details (a multiprocess has one child page).
  const multiprocesses = useMemo(() => {
    const copies = new Set(
      proposal.groups.flatMap((g) => (g.conflictWith ? [] : g.copies.map((c) => c.cellId))),
    );
    const all = review.parse.elements
      .filter((e) => e.type === "Multiprocess" && !copies.has(e.id))
      .map((e) => e.id);
    return (pageId: string, candidates: string[]) => {
      const taken = new Set(
        proposal.pages
          .filter((p) => p.pageId !== pageId)
          .map((p) => decomposes[p.pageId] ?? p.decomposes)
          .filter(Boolean),
      );
      return [...candidates, ...all.filter((id) => !candidates.includes(id))].filter(
        (id) => !taken.has(id),
      );
    };
  }, [proposal.groups, proposal.pages, review.parse.elements, decomposes]);

  const unplaced = proposal.pages.filter(
    (p) => p.status !== "root" && chosenDecomposes(p) === "",
  );

  const handleApply = async () => {
    const decisions: AdoptionDecisions = {
      reject: [...rejected],
      definition: Object.fromEntries(
        Object.entries(definition).map(([key, cell]) => [key, parseCellKey(cell)]),
      ),
      decomposes: Object.fromEntries(
        Object.entries(decomposes).filter(([, tfId]) => tfId !== ""),
      ),
    };
    setBusy(true);
    const result = await onApplyAdoption(decisions);
    setBusy(false);
    if (result) setError(result);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth data-testid="identity-review-adoption">
      <DialogTitle>
        {t("tabs.dfd.identityReview.adoption.title", { defaultValue: "Adopt pages" })}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("tabs.dfd.identityReview.adoption.intro", {
            defaultValue:
              "This diagram has several pages. Confirm which page details which multiprocess and which cells show the same element. Only the page tree and the identity links are stored; the drawing is not changed.",
          })}
        </Typography>

        {/* ── Pages ─────────────────────────────────────────────── */}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("tabs.dfd.identityReview.adoption.pages", { defaultValue: "Pages" })}
        </Typography>
        <Table size="small" sx={{ mb: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.dfd.identityReview.adoption.page", { defaultValue: "Page" })}</TableCell>
              <TableCell>{t("tabs.dfd.identityReview.adoption.details", { defaultValue: "Details multiprocess" })}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {proposal.pages.map((p) => {
              const fixed = p.status === "root" || p.status === "existing";
              const options = fixed ? [] : multiprocesses(p.pageId, p.candidates);
              return (
                <TableRow key={p.pageId} data-testid={`adoption-page-${p.pageId}`}>
                  <TableCell>{p.name || p.pageId}</TableCell>
                  <TableCell>
                    {p.status === "root" ? (
                      t("tabs.dfd.identityReview.adoption.root", { defaultValue: "— top level —" })
                    ) : fixed ? (
                      label(p.decomposes)
                    ) : options.length === 0 ? (
                      <Typography variant="body2" color="error">
                        {t("tabs.dfd.identityReview.adoption.noMultiprocess", {
                          defaultValue:
                            "No multiprocess left to detail. Draw the multiprocess this page details on a higher page first, or delete the page in draw.io.",
                        })}
                      </Typography>
                    ) : (
                      <Select
                        size="small"
                        fullWidth
                        displayEmpty
                        error={chosenDecomposes(p) === ""}
                        value={chosenDecomposes(p)}
                        renderValue={(value) =>
                          value === "" ? (
                            <em>
                              {t("tabs.dfd.identityReview.adoption.chooseMultiprocess", {
                                defaultValue: "Choose the multiprocess this page details…",
                              })}
                            </em>
                          ) : (
                            label(String(value))
                          )
                        }
                        onChange={(e) =>
                          setDecomposes((d) => ({ ...d, [p.pageId]: String(e.target.value) }))
                        }
                        inputProps={{ "data-testid": `adoption-decomposes-${p.pageId}` }}
                      >
                        {options.map((tfId) => (
                          <MenuItem key={tfId} value={tfId}>
                            {label(tfId)}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={p.status === "ambiguous" || p.status === "unplaced" ? "warning" : "default"}
                      label={t(`tabs.dfd.identityReview.adoption.status.${p.status}`, {
                        defaultValue: p.status,
                      })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* ── Groups ────────────────────────────────────────────── */}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("tabs.dfd.identityReview.adoption.groups", {
            defaultValue: "Same element on several pages",
          })}
        </Typography>
        {proposal.groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("tabs.dfd.identityReview.adoption.noGroups", {
              defaultValue: "No cell appears on more than one page.",
            })}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>{t("tabs.dfd.identityReview.adoption.element", { defaultValue: "Element" })}</TableCell>
                <TableCell>{t("tabs.dfd.identityReview.adoption.definition", { defaultValue: "Definition on" })}</TableCell>
                <TableCell>{t("tabs.dfd.identityReview.adoption.copies", { defaultValue: "Context copies on" })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposal.groups.map((g) => {
                const members = [g.definition, ...g.copies];
                const chosen = definition[g.key] ?? cellKey(g.definition);
                const conflict = !!g.conflictWith;
                const memberLabel = (c: CellRef) =>
                  members.filter((m) => m.pageId === c.pageId).length > 1
                    ? `${page(c.pageId)} (${c.cellId})`
                    : page(c.pageId);
                return (
                  <TableRow key={g.key} data-testid={`adoption-group-${g.key}`}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        disabled={conflict}
                        checked={!conflict && !rejected.has(g.key)}
                        onChange={(e) =>
                          setRejected((r) => {
                            const next = new Set(r);
                            if (e.target.checked) next.delete(g.key);
                            else next.add(g.key);
                            return next;
                          })
                        }
                        inputProps={{ "aria-label": g.displayId }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <span>{label(g.tfId)}</span>
                        {g.labelDivergence && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={t("tabs.dfd.identityReview.adoption.labelDivergence", {
                              defaultValue: "labels differ",
                            })}
                          />
                        )}
                        {conflict && (
                          <Tooltip title={g.conflictWith!.map(label).join(", ")}>
                            <Chip
                              size="small"
                              color="error"
                              variant="outlined"
                              label={t("tabs.dfd.identityReview.adoption.conflict", {
                                defaultValue: "conflict — not merged",
                              })}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {conflict ? (
                        page(g.definition.pageId)
                      ) : (
                        <Box>
                          <Select
                            size="small"
                            value={chosen}
                            onChange={(e) =>
                              setDefinition((d) => ({ ...d, [g.key]: String(e.target.value) }))
                            }
                            inputProps={{ "data-testid": `adoption-definition-${g.key}` }}
                          >
                            {members.map((m) => (
                              <MenuItem key={cellKey(m)} value={cellKey(m)}>
                                {memberLabel(m)}
                              </MenuItem>
                            ))}
                          </Select>
                          {g.definitionReason === "tie-break" && chosen === cellKey(g.definition) && (
                            <Typography variant="caption" color="warning.main" display="block">
                              {t("tabs.dfd.identityReview.adoption.tieBreak", {
                                defaultValue: "chosen by page order — please check",
                              })}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {members
                        .filter((m) => cellKey(m) !== chosen)
                        .map(memberLabel)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {unplaced.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }} data-testid="adoption-unplaced">
            {t("tabs.dfd.identityReview.adoption.unplaced", {
              defaultValue:
                "Every page except the top level details a multiprocess. Choose one for: {{pages}}.",
              pages: unplaced.map((p) => p.name || p.pageId).join(", "),
            })}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("tabs.dfd.identityReview.error", {
              defaultValue: "The decision could not be applied ({{code}}).",
              code: error,
            })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("tabs.dfd.identityReview.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={busy || unplaced.length > 0}
          data-testid="identity-review-apply"
        >
          {t("tabs.dfd.identityReview.adoption.apply", { defaultValue: "Adopt" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== ASSIGNMENT ====================

const AssignmentContent: React.FC<
  Omit<IdentityReviewDialogProps, "review"> & { review: AssignmentReview }
> = ({ review, onClose, onApplyAssignment, onDismissAssignment }) => {
  const { t } = useTranslation();
  const { label, page } = useLabels(review);

  const initial = () =>
    Object.fromEntries(review.assignments.map((a) => [cellKey(a.cell), a.proposal]));
  const [choice, setChoice] = useState<Record<string, "copy" | "new">>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChoice(initial());
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  const handleApply = async () => {
    const copies = review.assignments
      .filter((a) => choice[cellKey(a.cell)] === "copy")
      .map((a) => a.cell);
    setBusy(true);
    const result = await onApplyAssignment(copies);
    setBusy(false);
    if (result) setError(result);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth data-testid="identity-review-assignment">
      <DialogTitle>
        {t("tabs.dfd.identityReview.assignment.title", { defaultValue: "Assign pasted cells" })}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("tabs.dfd.identityReview.assignment.intro", {
            defaultValue:
              "These cells were pasted and carry the ID of an existing element. A context copy shows that element (one element, one set of threats); a new element is analysed on its own and gets its own ID with the next auto-numbering.",
          })}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.dfd.identityReview.assignment.cell", { defaultValue: "Pasted cell" })}</TableCell>
              <TableCell>{t("tabs.dfd.identityReview.assignment.target", { defaultValue: "Looks like" })}</TableCell>
              <TableCell align="center">{t("tabs.dfd.identityReview.assignment.copy", { defaultValue: "Context copy" })}</TableCell>
              <TableCell align="center">{t("tabs.dfd.identityReview.assignment.new", { defaultValue: "New element" })}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {review.assignments.map((a) => {
              const key = cellKey(a.cell);
              const set = (value: "copy" | "new") => setChoice((c) => ({ ...c, [key]: value }));
              return (
                <TableRow key={key} data-testid={`assignment-${a.cell.pageId}-${a.cell.cellId}`}>
                  <TableCell>
                    {label(a.cell.cellId)} · {page(a.cell.pageId)}
                  </TableCell>
                  <TableCell>
                    {label(a.targetTfId)} · {page(a.definitionPageId)}
                  </TableCell>
                  <TableCell align="center">
                    <Radio
                      size="small"
                      checked={choice[key] === "copy"}
                      onChange={() => set("copy")}
                      inputProps={{ "aria-label": `copy ${a.displayId}` }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Radio
                      size="small"
                      checked={choice[key] === "new"}
                      onChange={() => set("new")}
                      inputProps={{ "aria-label": `new ${a.displayId}` }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("tabs.dfd.identityReview.error", {
              defaultValue: "The decision could not be applied ({{code}}).",
              code: error,
            })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() =>
            setChoice(Object.fromEntries(review.assignments.map((a) => [cellKey(a.cell), "copy"])))
          }
          sx={{ mr: "auto" }}
        >
          {t("tabs.dfd.identityReview.assignment.allCopies", { defaultValue: "All as context copies" })}
        </Button>
        <Button onClick={onClose}>
          {t("tabs.dfd.identityReview.later", { defaultValue: "Later" })}
        </Button>
        <Button onClick={onDismissAssignment} data-testid="identity-review-dismiss">
          {t("tabs.dfd.identityReview.assignment.keepNew", { defaultValue: "Keep all as new" })}
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={busy}
          data-testid="identity-review-apply"
        >
          {t("tabs.dfd.identityReview.assignment.apply", { defaultValue: "Apply" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== HINTS ====================

export interface IdentityReviewHintsProps {
  adoptionPending: boolean;
  /**
   * Adopted pages the page tree cannot use (extra root pages, missing
   * pages) — repaired with the same dialog.
   */
  pageRepair?: boolean;
  pendingCopies: number;
  onOpenAdoption: () => void;
  onOpenAssignment: () => void;
}

/** Non-blocking hints above the diagram — the dialog's two entry points. */
export const IdentityReviewHints: React.FC<IdentityReviewHintsProps> = ({
  adoptionPending,
  pageRepair = false,
  pendingCopies,
  onOpenAdoption,
  onOpenAssignment,
}) => {
  const { t } = useTranslation();
  if (!adoptionPending && !pageRepair && pendingCopies === 0) return null;
  return (
    <Box>
      {adoptionPending && (
        <Alert
          severity="warning"
          data-testid="adoption-hint"
          action={
            <Button color="inherit" size="small" onClick={onOpenAdoption}>
              {t("tabs.dfd.identityReview.adoption.open", { defaultValue: "Adopt pages…" })}
            </Button>
          }
        >
          {t("tabs.dfd.identityReview.adoption.hint", {
            defaultValue:
              "This diagram has pages that are not adopted yet. Changes are not saved until you adopt them.",
          })}
        </Alert>
      )}
      {!adoptionPending && pageRepair && (
        <Alert
          severity="warning"
          data-testid="page-repair-hint"
          action={
            <Button color="inherit" size="small" onClick={onOpenAdoption}>
              {t("tabs.dfd.identityReview.repair.open", { defaultValue: "Review pages…" })}
            </Button>
          }
        >
          {t("tabs.dfd.identityReview.repair.hint", {
            defaultValue:
              "Some pages have no place in the page tree (several top-level pages, or a page that no longer exists).",
          })}
        </Alert>
      )}
      {!adoptionPending && !pageRepair && pendingCopies > 0 && (
        <Alert
          severity="info"
          data-testid="assignment-hint"
          action={
            <Button color="inherit" size="small" onClick={onOpenAssignment}>
              {t("tabs.dfd.identityReview.assignment.open", { defaultValue: "Assign…" })}
            </Button>
          }
        >
          {t("tabs.dfd.identityReview.assignment.hint", {
            defaultValue:
              "{{count}} pasted cell(s) look like copies of existing elements.",
            count: pendingCopies,
          })}
        </Alert>
      )}
    </Box>
  );
};

export default IdentityReviewDialog;
