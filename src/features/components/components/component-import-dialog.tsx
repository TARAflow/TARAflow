// ==================== COMPONENT IMPORT DIALOG ====================
// Multi-project TARA (doc/Done/multi-project-tara-design.md v3, §5):
//   1. choose the component .tara.json (read and checked by the app)
//   2. see where it comes from — pinned to a commit, or UNPINNED with a
//      clear warning that has to be confirmed (§4.1)
//   3. name the multiprocess, set the instance prefix (unique, E9)
//   4. map every external entity of the component to a machine element on
//      the page shown, or take it over as a new element (default, E1)
//   5. flows that will not resolve (EE → boundary, §17 I2) are listed; the
//      import still runs
// Already imported (E12): the instance uses the imported state. A separate
// dialog asks first (manual test 2026-11-08: the hint was easy to miss) —
// identical units in the same context raise the quantity of an existing
// instance, another context gets a further instance (I5).

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ComponentImportCandidate,
  ComponentImportDialogChoice,
  ComponentPickError,
  ComponentPickResult,
  MachineElementOption,
} from "../models/component-import-dialog-types";

const NS = "components";
const NEW_ELEMENT = "__new__";
const PREFIX_PATTERN = /^[A-Za-z0-9_-]{1,12}$/;

export interface ComponentImportDialogProps {
  open: boolean;
  /** Elements on the page shown that an EE can be mapped to. */
  machineElements: readonly MachineElementOption[];
  /** Asks for and checks a component file; null = cancelled. */
  onPickFile: () => Promise<ComponentPickResult>;
  onConfirm: (choice: ComponentImportDialogChoice) => void;
  /** Same installation context: one more unit of an existing instance (I5). */
  onIncreaseQuantity?: (instanceId: string) => void;
  onClose: () => void;
}

export const ComponentImportDialog: React.FC<ComponentImportDialogProps> = ({
  open,
  machineElements,
  onPickFile,
  onConfirm,
  onIncreaseQuantity,
  onClose,
}) => {
  const { t } = useTranslation(NS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: ComponentPickError; detail?: string } | null>(null);
  const [candidate, setCandidate] = useState<ComponentImportCandidate | null>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [unpinnedConfirmed, setUnpinnedConfirmed] = useState(false);
  const [quantity, setQuantity] = useState("1");
  /** Imported already: the analyst chose a further instance. */
  const [anotherInstance, setAnotherInstance] = useState(false);
  const [raiseId, setRaiseId] = useState("");

  // A new opening starts empty.
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    setCandidate(null);
    setName("");
    setPrefix("");
    setMapping({});
    setUnpinnedConfirmed(false);
    setQuantity("1");
    setAnotherInstance(false);
    setRaiseId("");
  }, [open]);

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onPickFile();
      if (!result) return;
      if (!result.ok) {
        setError({ code: result.error, detail: result.detail });
        setCandidate(null);
        return;
      }
      const c = result.candidate;
      setCandidate(c);
      setName(c.name);
      setPrefix(c.defaultPrefix);
      setMapping(Object.fromEntries(c.externalEntities.map((ee) => [ee.id, NEW_ELEMENT])));
      setUnpinnedConfirmed(false);
      setQuantity("1");
      setAnotherInstance(false);
      setRaiseId(c.existing?.instances[0]?.id ?? "");
    } finally {
      setBusy(false);
    }
  };

  const prefixError = !candidate
    ? null
    : !PREFIX_PATTERN.test(prefix)
      ? t("components.import.prefixInvalid", { defaultValue: "1–12 letters, digits, - or _" })
      : candidate.usedPrefixes.some((p) => p.toUpperCase() === prefix.toUpperCase())
        ? t("components.import.prefixTaken", { defaultValue: "Already used by another instance" })
        : null;
  const unpinned = !!candidate?.source.unpinned;
  const quantityValue = Number(quantity);
  const quantityError = !Number.isInteger(quantityValue) || quantityValue < 1;
  /** Imported already and not decided yet: the question comes first. */
  const asking = !!candidate?.existing && !anotherInstance;
  const canImport =
    !!candidate && !asking && !busy && !prefixError && !quantityError && name.trim() !== "" && (!unpinned || unpinnedConfirmed);

  const confirm = () => {
    if (!candidate || !canImport) return;
    onConfirm({
      prefix,
      name: name.trim(),
      quantity: quantityValue,
      eeMapping: Object.fromEntries(
        candidate.externalEntities.map((ee) => [ee.id, mapping[ee.id] === NEW_ELEMENT ? undefined : mapping[ee.id]]),
      ),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="component-import-dialog">
      <DialogTitle>{t("components.import.title", { defaultValue: "Import component TARA" })}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t("components.import.intro", {
              defaultValue:
                "The component's DFD becomes the child page of a new multiprocess on this page; its threats, measures and assumptions come along. Choose the component's .tara.json.",
            })}
          </Typography>
          <Box>
            <Button variant="outlined" onClick={pick} disabled={busy} data-testid="component-import-pick">
              {t("components.import.pick", { defaultValue: "Choose file…" })}
            </Button>
            {busy && <CircularProgress size={18} sx={{ ml: 2, verticalAlign: "middle" }} />}
          </Box>

          {error && (
            <Alert severity="error" data-testid="component-import-error">
              {t(`components.import.error.${error.code}`, { defaultValue: defaultErrorText(error.code) })}
              {error.detail ? ` (${error.detail})` : ""}
            </Alert>
          )}

          {candidate && !asking && (
            <>
              <SourceSummary candidate={candidate} />

              {unpinned && (
                <Alert severity="warning" data-testid="component-import-unpinned">
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t(`components.import.unpinned.${candidate.source.unpinned}`, {
                      defaultValue: defaultUnpinnedText(candidate.source.unpinned!),
                    })}{" "}
                    {t("components.import.unpinned.consequence", {
                      defaultValue:
                        "The import is not pinned to a commit: only its content identifies the state, the machine keeps a warning until it is replaced by a committed state.",
                    })}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={unpinnedConfirmed}
                        onChange={(e) => setUnpinnedConfirmed(e.target.checked)}
                        data-testid="component-import-unpinned-confirm"
                      />
                    }
                    label={t("components.import.unpinned.confirm", { defaultValue: "Import the unpinned state anyway" })}
                  />
                </Alert>
              )}

              {candidate.unresolvableFlows.length > 0 && (
                <Alert severity="warning" data-testid="component-import-unresolvable">
                  <Typography variant="body2">
                    {t("components.import.unresolvable", {
                      defaultValue:
                        "These flows end on a boundary and will not resolve in the machine — draw them to the element inside the boundary in the component TARA:",
                    })}
                  </Typography>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                    {candidate.unresolvableFlows.map((f) => (
                      <li key={f}>
                        <Typography variant="body2">{f}</Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <TextField
                  label={t("components.import.name", { defaultValue: "Multiprocess name" })}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  size="small"
                  sx={{ flex: 2 }}
                  inputProps={{ "data-testid": "component-import-name" }}
                />
                <TextField
                  label={t("components.import.quantity", { defaultValue: "Quantity" })}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  size="small"
                  type="number"
                  error={quantityError}
                  helperText={t("components.import.quantityHint", { defaultValue: "Identical units in the same place" })}
                  sx={{ width: 150 }}
                  inputProps={{ min: 1, step: 1, "data-testid": "component-import-quantity" }}
                />
                <TextField
                  label={t("components.import.prefix", { defaultValue: "Prefix" })}
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  size="small"
                  error={!!prefixError}
                  helperText={
                    prefixError ??
                    t("components.import.prefixHint", { defaultValue: "Before the component's ids, e.g. {{example}}", example: `${prefix || "CAM1"}:P-3` })
                  }
                  sx={{ flex: 1 }}
                  inputProps={{ "data-testid": "component-import-prefix" }}
                />
              </Stack>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("components.import.mappingTitle", { defaultValue: "External entities of the component" })}
                </Typography>
                {candidate.externalEntities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("components.import.noEntities", { defaultValue: "The component has no external entities." })}
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("components.import.entity", { defaultValue: "Component entity" })}</TableCell>
                        <TableCell>{t("components.import.standsFor", { defaultValue: "Stands for in the machine" })}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {candidate.externalEntities.map((ee) => (
                        <TableRow key={ee.id}>
                          <TableCell>{ee.label}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              fullWidth
                              value={mapping[ee.id] ?? NEW_ELEMENT}
                              onChange={(e) => setMapping((m) => ({ ...m, [ee.id]: String(e.target.value) }))}
                              inputProps={{ "data-testid": `component-import-map-${ee.id}` }}
                            >
                              <MenuItem value={NEW_ELEMENT}>
                                <em>{t("components.import.newElement", { defaultValue: "Take over as a new element" })}</em>
                              </MenuItem>
                              {machineElements.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                  {m.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("components.import.cancel", { defaultValue: "Cancel" })}</Button>
        <Button variant="contained" onClick={confirm} disabled={!canImport} data-testid="component-import-confirm">
          {t("components.import.confirm", { defaultValue: "Import" })}
        </Button>
      </DialogActions>
      {candidate?.existing && asking && (
        <AlreadyImportedDialog
          name={candidate.name}
          existing={candidate.existing}
          raiseId={raiseId}
          onRaiseIdChange={setRaiseId}
          onCancel={onClose}
          onAnother={() => setAnotherInstance(true)}
          {...(onIncreaseQuantity
            ? {
                onIncrease: () => {
                  if (!raiseId) return;
                  onIncreaseQuantity(raiseId);
                  onClose();
                },
              }
            : {})}
        />
      )}
    </Dialog>
  );
};

/**
 * Imported already (E12, I5): a further instance for another installation
 * context, or one more unit of an existing instance in the same context.
 */
const AlreadyImportedDialog: React.FC<{
  name: string;
  existing: NonNullable<ComponentImportCandidate["existing"]>;
  raiseId: string;
  onRaiseIdChange: (id: string) => void;
  onCancel: () => void;
  onAnother: () => void;
  onIncrease?: () => void;
}> = ({ name, existing, raiseId, onRaiseIdChange, onCancel, onAnother, onIncrease }) => {
  const { t } = useTranslation(NS);
  const target = existing.instances.find((i) => i.id === raiseId) ?? existing.instances[0];
  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth data-testid="component-import-existing">
      <DialogTitle>
        {t("components.import.existingTitle", { name, defaultValue: "{{name}} is imported already" })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2">
            {t("components.import.existingIntro", {
              instances: existing.instances.map((i) => i.label).join(", ") || "—",
              defaultValue: "This project uses it already: {{instances}}.",
            })}
          </Typography>
          {!existing.sameState && (
            <Alert severity="info" data-testid="component-import-existing-other">
              {t("components.import.existingOther", {
                label: existing.label,
                defaultValue:
                  "This component is imported in another state ({{label}}). The new instance uses that state; moving all instances to a newer state comes with the update.",
              })}
            </Alert>
          )}
          <Typography variant="body2">
            {t("components.import.existingSameContext", {
              defaultValue:
                "Identical units in the same installation context (same place, same connections): raise the quantity of the existing instance — one analysis for all of them.",
            })}
          </Typography>
          <Typography variant="body2">
            {t("components.import.existingOtherContext", {
              defaultValue:
                "Another place or other connections: add a further instance — its own child page and its own ratings.",
            })}
          </Typography>
          {onIncrease && existing.instances.length > 1 && (
            <Select
              size="small"
              value={raiseId}
              onChange={(e) => onRaiseIdChange(String(e.target.value))}
              inputProps={{ "data-testid": "component-import-existing-instance" }}
            >
              {existing.instances.map((i) => (
                <MenuItem key={i.id} value={i.id}>
                  {i.label}
                </MenuItem>
              ))}
            </Select>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="component-import-existing-cancel">
          {t("components.import.cancel", { defaultValue: "Cancel" })}
        </Button>
        {onIncrease && target && (
          <Button onClick={onIncrease} data-testid="component-import-existing-increase">
            {t("components.import.existingIncrease", {
              prefix: target.label.split(" · ")[0],
              from: target.quantity,
              to: target.quantity + 1,
              defaultValue: "Raise quantity ({{prefix}}: {{from}} → {{to}})",
            })}
          </Button>
        )}
        <Button variant="contained" onClick={onAnother} data-testid="component-import-existing-another">
          {t("components.import.existingAnother", { defaultValue: "Add a further instance" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Where the component comes from — commit, tag, branch, repository, path. */
const SourceSummary: React.FC<{ candidate: ComponentImportCandidate }> = ({ candidate }) => {
  const { t } = useTranslation(NS);
  const s = candidate.source;
  const parts = [
    s.commitSha ? t("components.import.commit", { sha: s.commitSha.slice(0, 8), defaultValue: "commit {{sha}}" }) : null,
    s.tag ? t("components.import.tag", { tag: s.tag, defaultValue: "tag {{tag}}" }) : null,
    s.branch ? t("components.import.branch", { branch: s.branch, defaultValue: "branch {{branch}}" }) : null,
    s.sameRepo ? t("components.import.sameRepo", { defaultValue: "same repository as this project" }) : s.repoUrl ?? null,
    s.path ?? null,
  ].filter(Boolean);
  return (
    <Box data-testid="component-import-summary">
      <Typography variant="subtitle1">{candidate.name}</Typography>
      {parts.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {parts.join(" · ")}
        </Typography>
      )}
    </Box>
  );
};

function defaultErrorText(code: ComponentPickError): string {
  switch (code) {
    case "not_found":
      return "The file was not found.";
    case "invalid":
      return "The file is not a TARAflow project.";
    case "schema_too_new":
      return "The file was written by a newer TARAflow — update TARAflow first.";
    case "not_deterministic":
      return "The file was written by an old TARAflow. Open and save it in TARAflow 0.19 or later, commit it, then import it.";
    case "cycle":
      return "This TARA is the project itself or contains it — it cannot be imported.";
    case "no_dfd":
      return "The component TARA has no data flow diagram.";
    default:
      return "The import failed.";
  }
}

function defaultUnpinnedText(reason: NonNullable<ComponentImportCandidate["source"]["unpinned"]>): string {
  switch (reason) {
    case "no_repo":
      return "The file is not in a git repository.";
    case "untracked":
      return "The file is not committed in its repository.";
    default:
      return "The file has uncommitted changes.";
  }
}
