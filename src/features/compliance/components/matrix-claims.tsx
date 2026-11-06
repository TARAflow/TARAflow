// features/compliance/components/matrix-claims.tsx
//
// Claims for SL-C gaps (iec-62443-4-2-cra-coverage.md D-5, IEC-6): a
// requirement the system around the component meets — prAA CCSC 2
// "supporting measure", a compensating countermeasure in the 2019 edition —
// is covered by a cybersecurity claim CLM-nn of kind "supporting" (the same
// numbering as the claims of the risk treatment). The claim names the
// measure and who provides it; one claim may cover several rows. A claimed
// row counts for the value with measures of the system, never for SL-C of
// the component (D-14).

import React, { useState } from "react";
import { DeleteOutline as DeleteIcon } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  addClaim,
  claimsOfRequirements,
  linkClaimRequirements,
  newSupportingClaim,
  removeClaim,
  unlinkClaimRequirements,
  type CybersecurityClaim,
  type CybersecurityConcept,
} from "shared";

type T = (key: string, defaultValue: string, options?: Record<string, unknown>) => string;

/** What the claim dialog returns: link an existing claim, or a new one. */
export type ClaimChoice =
  | { existingId: string }
  | { statement: string; responsibleParty?: string; reviewBy?: string };

/** The claim operation on the concept for a row's requirements (qualified ids). */
export function applyClaimChoice(concept: CybersecurityConcept, requirements: readonly string[], choice: ClaimChoice): CybersecurityConcept {
  if ("existingId" in choice) return linkClaimRequirements(concept, choice.existingId, requirements);
  const claim = newSupportingClaim(concept, requirements, choice.statement, choice.responsibleParty);
  return addClaim(concept, choice.reviewBy ? { ...claim, reviewBy: choice.reviewBy } : claim);
}

/**
 * FX-24: a supporting claim no requirement and no risk uses any more — only
 * such a claim can be deleted (as in the risk tab: a used claim stays).
 */
export const isUnusedClaim = (c: CybersecurityClaim): boolean =>
  c.kind === "supporting" && (c.requirements ?? []).length === 0 && c.riskIds.length === 0;

/** The claims of one row in the info dialog, with "add" and "remove from this row". */
export const RowClaims: React.FC<{
  concept: CybersecurityConcept;
  requirements: readonly string[];
  onConceptChange: (concept: CybersecurityConcept) => void;
  t: T;
}> = ({ concept, requirements, onConceptChange, t }) => {
  const [adding, setAdding] = useState(false);
  const claims = claimsOfRequirements(concept, requirements);
  return (
    <Box data-testid="compliance-row-claims">
      {claims.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("noClaim", "No claim — when the system around the component provides the requirement, claim it here.")}
        </Typography>
      ) : (
        claims.map((c) => (
          <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start" data-testid={`compliance-claim-${c.displayId}`}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              <b>{c.displayId}</b> {c.statement}
              {c.responsibleParty && ` — ${t("responsibleParty", "provided by")}: ${c.responsibleParty}`}
              {c.reviewBy && ` (${t("reviewBy", "review by")} ${c.reviewBy})`}
            </Typography>
            <Tooltip title={t("unlinkClaim", "Remove the claim from this requirement")}>
              <IconButton
                size="small"
                aria-label={t("unlinkClaim", "Remove the claim from this requirement")}
                onClick={() => onConceptChange(unlinkClaimRequirements(concept, c.id, requirements))}
              >
                ✕
              </IconButton>
            </Tooltip>
          </Stack>
        ))
      )}
      <Button size="small" sx={{ mt: 0.5 }} onClick={() => setAdding(true)} data-testid="compliance-add-claim">
        {t("addClaim", "Add claim")}
      </Button>
      {adding && (
        <ClaimDialog
          existing={concept.claims.filter((c) => c.kind === "supporting" && !claims.includes(c))}
          t={t}
          onDelete={(id) => onConceptChange(removeClaim(concept, id))}
          onClose={() => setAdding(false)}
          onSave={(choice) => {
            onConceptChange(applyClaimChoice(concept, requirements, choice));
            setAdding(false);
          }}
        />
      )}
    </Box>
  );
};

const NEW = "";

const ClaimDialog: React.FC<{
  existing: readonly CybersecurityClaim[];
  t: T;
  /** FX-24: delete an unused claim for good. */
  onDelete: (claimId: string) => void;
  onClose: () => void;
  onSave: (choice: ClaimChoice) => void;
}> = ({ existing, t, onDelete, onClose, onSave }) => {
  const [chosenId, setExistingId] = useState(NEW);
  // A deleted claim can no longer be the choice.
  const existingId = chosenId === NEW || existing.some((c) => c.id === chosenId) ? chosenId : NEW;
  const [statement, setStatement] = useState("");
  const [party, setParty] = useState("");
  const [reviewBy, setReviewBy] = useState("");
  const isNew = existingId === NEW;
  const valid = !isNew || statement.trim().length > 0;
  return (
    // At most 80 % of the window, scrolling inside — title and buttons stay in view.
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { maxHeight: "80vh" } }}
      data-testid="compliance-claim-dialog"
    >
      <DialogTitle>{t("claimTitle", "Claim: the system provides the requirement")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              "claimHelp",
              "Name the measure of the system around the component (CCSC 2, supporting measure) and who provides it — the operator, the integrator or another component. A claimed requirement counts for the value with measures of the system, not for SL-C of the product.",
            )}
          </Typography>
          {existing.length > 0 && (
            <TextField
              select
              label={t("claimChoice", "Claim")}
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              inputProps={{ "data-testid": "compliance-claim-choice" }}
              SelectProps={{
                // The field shows the claim, not the row's delete button.
                renderValue: (value) => {
                  const claim = existing.find((c) => c.id === value);
                  return claim ? `${claim.displayId} ${claim.statement}` : t("newClaim", "New claim");
                },
                // A long list scrolls inside the menu (FX-24b).
                MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
              }}
            >
              <MenuItem value={NEW}>{t("newClaim", "New claim")}</MenuItem>
              {existing.map((c) => (
                <MenuItem key={c.id} value={c.id} data-testid={`compliance-claim-option-${c.displayId}`}>
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }} title={c.statement}>
                    <b>{c.displayId}</b> {c.statement}
                  </Typography>
                  {/* FX-24b: an unused claim is deleted right in the list. */}
                  {isUnusedClaim(c) && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                        {t("unusedClaim", "unused")}
                      </Typography>
                      <Tooltip title={t("deleteClaim", "Delete this unused claim for good")}>
                        <IconButton
                          size="small"
                          color="error"
                          sx={{ ml: 0.5, flexShrink: 0 }}
                          aria-label={t("deleteClaim", "Delete this unused claim for good")}
                          onClick={(e) => {
                            // Delete only — do not choose the claim.
                            e.stopPropagation();
                            onDelete(c.id);
                          }}
                          data-testid={`compliance-claim-delete-${c.displayId}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </MenuItem>
              ))}
            </TextField>
          )}
          {isNew && (
            <>
              <TextField
                label={t("claimStatement", "Supporting measure")}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                multiline
                minRows={2}
                required
                inputProps={{ "data-testid": "compliance-claim-statement" }}
              />
              <TextField
                label={t("claimParty", "Provided by")}
                value={party}
                onChange={(e) => setParty(e.target.value)}
                inputProps={{ "data-testid": "compliance-claim-party" }}
              />
              <TextField
                label={t("claimReviewBy", "Review by")}
                type="date"
                value={reviewBy}
                onChange={(e) => setReviewBy(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() =>
            onSave(
              isNew
                ? { statement, ...(party.trim() ? { responsibleParty: party } : {}), ...(reviewBy ? { reviewBy } : {}) }
                : { existingId },
            )
          }
          data-testid="compliance-claim-save"
        >
          {t("save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
