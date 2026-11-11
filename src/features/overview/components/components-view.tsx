// ==================== COMPONENTS VIEW ====================
// Overview, tab "Components" (user 2026-11-11): one accordion per imported
// component — a machine can carry several — in a list that scrolls on its
// own. Per component: its overview at the imported commit (description,
// responsible, tags, Item Definition texts and functions, source
// references), where the component TARA comes from, whether the methodology
// matches, and its instances with their assumptions of use. Read-only: the
// texts are the component's, in its language; they change through an
// update. Data from the app layer (ComponentOverviewItem).

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { ComponentOverviewItem } from "../models/overview-types";

export interface ComponentsViewProps {
  items: readonly ComponentOverviewItem[];
  /** Select the instance's multiprocess in the DFD. */
  onShowInDfd?: (multiprocessTfId: string) => void;
}

const DRIFT_COLOR: Record<NonNullable<ComponentOverviewItem["drift"]>["kind"], "success" | "warning" | "error" | "default"> = {
  up_to_date: "success",
  newer_available: "warning",
  diverged: "error",
  unreachable: "default",
};

const short = (sha: string) => sha.slice(0, 8);
const day = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString() : iso);

/** A label and its value in one row; nothing when there is no value. */
const Field: React.FC<{ label: string; children?: React.ReactNode; testId?: string }> = ({ label, children, testId }) =>
  children === undefined || children === null || children === "" ? null : (
    <Box sx={{ display: "flex", gap: 2, py: 0.5 }} data-testid={testId}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 170, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>{typeof children === "string" ? <Typography variant="body2">{children}</Typography> : children}</Box>
    </Box>
  );

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
    {children}
  </Typography>
);

export const ComponentsView: React.FC<ComponentsViewProps> = ({ items, onShowInDfd }) => {
  const { t } = useTranslation();
  // The first component open; with several the analyst opens the next.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(items.slice(0, 1).map((i) => i.importId)));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("overviewComponents.intro", {
          defaultValue:
            "The components this TARA imports, as their platform teams describe them at the imported commit. Read-only — the texts change with an update of the component.",
        })}
      </Typography>
      <Box sx={{ maxHeight: "calc(100vh - 230px)", overflowY: "auto", pr: 1 }} data-testid="components-view-scroll">
        {items.map((item) => {
          const tags = item.tags ? [...item.tags.domain, ...item.tags.platform, ...item.tags.regulation, ...item.tags.custom] : [];
          const o = item.origin;
          return (
            <Accordion
              key={item.importId}
              expanded={open.has(item.importId)}
              onChange={() => toggle(item.importId)}
              disableGutters
              variant="outlined"
              sx={{ mb: 1, "&:before": { display: "none" } }}
              data-testid={`component-overview-${item.importId}`}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {item.name}
                  </Typography>
                  {item.version && (
                    <Typography variant="body2" color="text.secondary">
                      {t("overviewComponents.version", { version: item.version, defaultValue: "v{{version}}" })}
                    </Typography>
                  )}
                  {item.instances.map((i) => (
                    <Chip key={i.id} size="small" variant="outlined" label={i.quantity > 1 ? `${i.prefix} ×${i.quantity}` : i.prefix} />
                  ))}
                  {item.drift && <Chip size="small" color={DRIFT_COLOR[item.drift.kind]} label={item.drift.text} data-testid="component-overview-drift" />}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {item.aboutMissing && (
                  <Alert severity="info" sx={{ mb: 1 }} data-testid="component-overview-about-missing">
                    {t("overviewComponents.aboutMissing", {
                      defaultValue: "Imported before the component's overview was taken along — \"Refresh stored state…\" in the component section (DFD) brings description, responsible and sources.",
                    })}
                  </Alert>
                )}
                <Field label={t("overviewComponents.description", { defaultValue: "Description" })}>
                  {item.description ? (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }} data-testid="component-overview-description">
                      {item.description}
                    </Typography>
                  ) : undefined}
                </Field>
                <Field label={t("overviewComponents.responsible", { defaultValue: "Responsible" })}>{item.responsible}</Field>
                <Field label={t("overviewComponents.tags", { defaultValue: "Tags" })}>
                  {tags.length > 0 ? (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                      {tags.map((tag) => (
                        <Chip key={tag} size="small" label={tag} />
                      ))}
                    </Stack>
                  ) : undefined}
                </Field>
                <Field label={t("overviewComponents.safety", { defaultValue: "Safety-relevant" })}>
                  {item.safetyRelevant ? t("overviewComponents.yes", { defaultValue: "yes" }) : undefined}
                </Field>

                {/* Where the component TARA comes from */}
                <Heading>{t("overviewComponents.origin", { defaultValue: "Component TARA" })}</Heading>
                <Field label={t("overviewComponents.repository", { defaultValue: "Repository" })} testId="component-overview-repo">
                  {o.repoUrl ?? (o.sameRepo ? t("overviewComponents.sameRepo", { defaultValue: "this repository" }) : undefined)}
                </Field>
                <Field label={t("overviewComponents.path", { defaultValue: "File" })}>{o.path}</Field>
                <Field label={t("overviewComponents.ref", { defaultValue: "Branch / tag" })}>
                  {[o.branch, o.tag && t("overviewComponents.tag", { tag: o.tag, defaultValue: "tag {{tag}}" })].filter(Boolean).join(" · ") || undefined}
                </Field>
                <Field label={t("overviewComponents.commit", { defaultValue: "Commit" })}>
                  {o.unpinned ? (
                    t("overviewComponents.unpinned", { defaultValue: "not pinned to a commit" })
                  ) : o.commit ? (
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }} title={o.commit}>
                      {short(o.commit)}
                    </Typography>
                  ) : undefined}
                </Field>
                <Field label={t("overviewComponents.importedAt", { defaultValue: "Imported on" })}>{day(o.importedAt)}</Field>
                <Field label={t("overviewComponents.lastUpdate", { defaultValue: "Last update" })}>{o.lastUpdateAt ? day(o.lastUpdateAt) : undefined}</Field>
                <Field label={t("overviewComponents.methodology", { defaultValue: "Methodology" })}>
                  {item.methodologyMatches === undefined
                    ? undefined
                    : item.methodologyMatches
                      ? t("overviewComponents.methodologySame", { defaultValue: "same likelihood method and factor scales as this TARA" })
                      : t("overviewComponents.methodologyDiffers", { defaultValue: "differs from this TARA — the component's factor values are not taken over" })}
                </Field>

                {/* The component's own source references */}
                {item.sourceBindings.length > 0 && (
                  <>
                    <Heading>{t("overviewComponents.sources", { defaultValue: "Sources of the component" })}</Heading>
                    {item.sourceBindings.map((b, idx) => (
                      <Box key={`${b.repoUrl}|${idx}`} sx={{ py: 0.5 }} data-testid="component-overview-source">
                        <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                          {b.repoUrl}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {b.refType} {b.refLabel}
                          {b.commit ? ` · ${short(b.commit)}` : ""}
                        </Typography>
                      </Box>
                    ))}
                  </>
                )}

                {/* Instances in this machine */}
                <Heading>{t("overviewComponents.instances", { defaultValue: "Instances in this TARA" })}</Heading>
                {item.instances.map((i) => (
                  <Stack key={i.id} direction="row" spacing={2} alignItems="center" sx={{ py: 0.25 }} data-testid={`component-overview-instance-${i.prefix}`}>
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 80 }}>
                      {i.quantity > 1 ? `${i.prefix} ×${i.quantity}` : i.prefix}
                    </Typography>
                    <Typography variant="body2" color={i.assumptionsNotFulfilled > 0 ? "error" : i.assumptionsDecided < i.assumptionsTotal ? "warning.main" : "text.secondary"} sx={{ flexGrow: 1 }}>
                      {i.assumptionsTotal === 0
                        ? t("overviewComponents.noAssumptions", { defaultValue: "no assumptions of use" })
                        : t("overviewComponents.assumptions", {
                            decided: i.assumptionsDecided,
                            total: i.assumptionsTotal,
                            notFulfilled: i.assumptionsNotFulfilled,
                            defaultValue: "assumptions of use: {{decided}} of {{total}} decided, {{notFulfilled}} not fulfilled",
                          })}
                    </Typography>
                    {onShowInDfd && (
                      <Button size="small" onClick={() => onShowInDfd(i.multiprocessTfId)} data-testid={`component-overview-show-${i.prefix}`}>
                        {t("overviewComponents.showInDfd", { defaultValue: "Show in DFD" })}
                      </Button>
                    )}
                  </Stack>
                ))}

                {/* Item Definition of the component */}
                {(item.sections.length > 0 || item.functions.length > 0) && (
                  <>
                    <Heading>{t("overviewComponents.definition", { defaultValue: "Item Definition of the component" })}</Heading>
                    {item.sections.map((s) => (
                      <Field key={s.id} label={t(`itemDefinition.sections.${s.id}.title`, { defaultValue: s.id })}>
                        <Box>
                          {s.text && (
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                              {s.text}
                            </Typography>
                          )}
                          {s.source && (
                            <Typography variant="caption" color="text.secondary">
                              {t("overviewComponents.sourceDocument", { source: s.source, defaultValue: "Source: {{source}}" })}
                            </Typography>
                          )}
                        </Box>
                      </Field>
                    ))}
                    {item.functions.length > 0 && (
                      <Field label={t("itemDefinition.functions.title", { defaultValue: "Functions over the lifecycle" })}>
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          {item.functions.map((f, idx) => (
                            <li key={`${f.name}|${idx}`}>
                              <Typography variant="body2">
                                {f.name}
                                {f.description ? ` — ${f.description}` : ""}
                                {f.lifecyclePhases.length > 0 && (
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    {" "}
                                    ({f.lifecyclePhases.map((p) => t(`itemDefinition.lifecycle.${p}`, { defaultValue: p })).join(", ")})
                                  </Typography>
                                )}
                              </Typography>
                            </li>
                          ))}
                        </Box>
                      </Field>
                    )}
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};
