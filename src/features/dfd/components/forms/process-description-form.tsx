// ==================== PROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, R, I, D, E (all)
// Two tabs:
//   Tab 1 — General:  Execution context, advanced settings, description
//   Tab 2 — Asset:    Asset relations + Safety annotation summary

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Tab,
  Tabs,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  Paper,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  WarningAmber as WarningAmberIcon,
  Shield as ShieldIcon,
} from "@mui/icons-material";
import type {
  AssetGroup,
  DFDElement,
  AssetRelation,
} from "../../models/dfd-types";
import type { ProcessProperties } from "../../models/element-properties";
import {
  isIsAnRelation,
  hasQualifier,
} from "../../models/asset-relation-types";
import { RichTextEditor } from "../shared/rich-text-editor";
import {
  AssetRelationSelector,
  type AvailableAsset,
} from "./asset-relation-selector";
import {
  updateProcessProperties,
  getProcessDefaults,
} from "../../hooks/use-dfd-ui-state";

// ==================== PROPS ====================

interface ProcessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== TAB PANEL ====================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ==================== SAFETY SUMMARY ====================

const IMPACT_ORDER = [
  "fatality",
  "irreversible_injury",
  "reversible_injury",
  "none",
] as const;
const IMPACT_COLOR: Record<string, "error" | "warning" | "default"> = {
  fatality: "error",
  irreversible_injury: "error",
  reversible_injury: "warning",
  none: "default",
};
const RELEVANCE_COLOR: Record<string, "error" | "warning" | "default"> = {
  direct: "error",
  indirect: "warning",
  none: "default",
};

interface SafetySummaryProps {
  assetRelations: AssetRelation[];
  availableAssets: AvailableAsset[];
}

const SafetySummary: React.FC<SafetySummaryProps> = ({
  assetRelations,
  availableAssets,
}) => {
  const { t } = useTranslation();

  // Collect all relations that have safety relevance
  const safetyRels = assetRelations.filter(
    (r) => !isIsAnRelation(r) && r.safety && r.safety.relevance !== "none",
  );

  if (safetyRels.length === 0) return null;

  // Group by assetId
  const byAsset = new Map<string, AssetRelation[]>();
  for (const r of safetyRels) {
    byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r]);
  }

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="subtitle2" color="text.secondary">
          {t("tabs.dfd.element_description.process.safetyAnnotation.title", {
            defaultValue: "Safety Annotations",
          })}
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {[...byAsset.entries()].map(([assetId, rels]) => {
          const asset = availableAssets.find((a) => a.id === assetId);

          // Worst impact + relevance for this asset
          const worstImpact =
            IMPACT_ORDER.find((lvl) =>
              rels.some((r) => r.safety?.impact === lvl),
            ) ?? "none";
          const hasDirect = rels.some((r) => r.safety?.relevance === "direct");

          return (
            <Paper key={assetId} variant="outlined" sx={{ p: 1.25 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                flexWrap="wrap"
              >
                {/* Asset label */}
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ minWidth: 100 }}
                >
                  {asset ? `${asset.displayId} · ${asset.name}` : assetId}
                </Typography>

                {/* Per-relation safety chips */}
                <Box
                  sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, flex: 1 }}
                >
                  {rels.map((r) => {
                    const qualifier = hasQualifier(r) ? `[${r.qualifier}]` : "";
                    const relevance = r.safety!.relevance;
                    const impact = r.safety?.impact;

                    return (
                      <Stack
                        key={r.relationType}
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                      >
                        <Chip
                          label={`${r.relationType}${qualifier}`}
                          size="small"
                          sx={{ fontFamily: "monospace", fontSize: 10 }}
                        />
                        <Chip
                          icon={<WarningAmberIcon sx={{ fontSize: 11 }} />}
                          label={relevance}
                          size="small"
                          color={RELEVANCE_COLOR[relevance] ?? "default"}
                          variant="outlined"
                        />
                        {impact && impact !== "none" && (
                          <Chip
                            label={impact.replace(/_/g, " ")}
                            size="small"
                            color={IMPACT_COLOR[impact] ?? "default"}
                            variant="filled"
                          />
                        )}
                        {r.safety?.rationale && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={r.safety.rationale}
                          >
                            — {r.safety.rationale}
                          </Typography>
                        )}
                      </Stack>
                    );
                  })}
                </Box>

                {/* Overall severity badge */}
                {(hasDirect ||
                  worstImpact === "fatality" ||
                  worstImpact === "irreversible_injury") && (
                  <Chip
                    label={
                      hasDirect
                        ? "DIRECT"
                        : worstImpact.replace(/_/g, " ").toUpperCase()
                    }
                    size="small"
                    color="error"
                    sx={{ fontWeight: 700, fontSize: 10 }}
                  />
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};;;

// ==================== MAIN COMPONENT ====================

export const ProcessDescriptionForm = React.memo<ProcessFormProps>(
  ({ element, onChange, onCreateAsset, availableAssets = [] }) => {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState(0);

    const [localDescription, setLocalDescription] = React.useState(
      element.description || "",
    );
    const [localNotes, setLocalNotes] = React.useState(
      (element.properties as ProcessProperties).notes || "",
    );
    const [localSecurityControls, setLocalSecurityControls] = React.useState(
      (element.properties as ProcessProperties).securityControls || "",
    );
    const [localOwner, setLocalOwner] = React.useState(
      (element.properties as ProcessProperties).owner || "",
    );

    React.useEffect(() => {
      setLocalDescription(element.description || "");
    }, [element.description]);
    React.useEffect(() => {
      setLocalNotes((element.properties as ProcessProperties).notes || "");
    }, [(element.properties as ProcessProperties).notes]);
    React.useEffect(() => {
      setLocalSecurityControls(
        (element.properties as ProcessProperties).securityControls || "",
      );
    }, [(element.properties as ProcessProperties).securityControls]);
    React.useEffect(() => {
      setLocalOwner((element.properties as ProcessProperties).owner || "");
    }, [(element.properties as ProcessProperties).owner]);

    const props = element.properties as ProcessProperties;
    const assetRels = element.assetRelations ?? [];

    const handlePropertyChange = useCallback(
      (field: keyof ProcessProperties, value: unknown) => {
        const currentProps = element.properties as ProcessProperties;

        if (field === "runsAs") {
          if (!value) {
            const newProps: Partial<ProcessProperties> = {
              ...currentProps,
              runsAs: undefined,
              privilegeLevel: undefined,
            };
            if (!currentProps.technology)
              newProps.authenticationRequired = undefined;
            onChange({ properties: newProps });
            return;
          }
          onChange({
            properties: getProcessDefaults(currentProps, {
              runsAs: value as ProcessProperties["runsAs"],
            }),
          });
          return;
        }

        if (field === "technology") {
          if (!value) {
            const newProps: Partial<ProcessProperties> = {
              ...currentProps,
              technology: undefined,
              authorizationModel: undefined,
              inputValidation: undefined,
              errorHandling: undefined,
            };
            if (!currentProps.runsAs)
              newProps.authenticationRequired = undefined;
            onChange({ properties: newProps });
            return;
          }
          onChange({
            properties: getProcessDefaults(currentProps, {
              technology: value as ProcessProperties["technology"],
            }),
          });
          return;
        }

        onChange({
          properties: updateProcessProperties(currentProps, {
            [field]: value,
          } as Partial<ProcessProperties>),
        });
      },
      [element.properties, onChange],
    );

    // ==================== TAB 1: GENERAL ====================

    const renderGeneralTab = () => (
      <Stack spacing={3}>
        <Box sx={{ overflow: "hidden", pt: 1 }}>
          <Grid container rowSpacing={3} columnSpacing={2}>
            {/* runsAs */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.runsAs.label",
                  )}
                </InputLabel>
                <Select
                  value={props.runsAs ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "runsAs",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.runsAs.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.runsAs.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(
                    [
                      "user",
                      "admin_user",
                      "root",
                      "system",
                      "service",
                      "guest",
                      "anonymous",
                      "contractor",
                    ] as const
                  ).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.runsAs.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* technology */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.label",
                  )}
                </InputLabel>
                <Select
                  value={props.technology ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "technology",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.technology.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.technology.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(
                    [
                      "api",
                      "batch",
                      "ui",
                      "microservice",
                      "lambda",
                      "daemon",
                      "websocket",
                      "event",
                      "cli",
                      "database",
                      "cron",
                      "iot",
                    ] as const
                  ).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.technology.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* privilegeLevel */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.privilegeLevel.label",
                  )}
                </InputLabel>
                <Select
                  value={props.privilegeLevel ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "privilegeLevel",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.privilegeLevel.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.privilegeLevel.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(["low", "medium", "high", "root"] as const).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.privilegeLevel.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* authenticationRequired */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.authenticationRequired.label",
                  )}
                </InputLabel>
                <Select
                  value={props.authenticationRequired ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "authenticationRequired",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.authenticationRequired.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.authenticationRequired.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(
                    [
                      "no",
                      "yes",
                      "optional",
                      "oauth",
                      "saml",
                      "certificate",
                      "apikey",
                      "jwt",
                      "mtls",
                    ] as const
                  ).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.authenticationRequired.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* authorizationModel */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.authorizationModel.label",
                  )}
                </InputLabel>
                <Select
                  value={props.authorizationModel ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "authorizationModel",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.authorizationModel.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.authorizationModel.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(["none", "rbac", "abac", "acl", "custom"] as const).map(
                    (opt) => (
                      <MenuItem key={opt} value={opt}>
                        {t(
                          `tabs.dfd.element_description.process.fields.authorizationModel.options.${opt}`,
                        )}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* inputValidation */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.inputValidation.label",
                  )}
                </InputLabel>
                <Select
                  value={props.inputValidation ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "inputValidation",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.inputValidation.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.inputValidation.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(["none", "basic", "strict", "schema"] as const).map(
                    (opt) => (
                      <MenuItem key={opt} value={opt}>
                        {t(
                          `tabs.dfd.element_description.process.fields.inputValidation.options.${opt}`,
                        )}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* errorHandling */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.errorHandling.label",
                  )}
                </InputLabel>
                <Select
                  value={props.errorHandling ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "errorHandling",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.errorHandling.label",
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.errorHandling.options.not_specified",
                      )}
                    </em>
                  </MenuItem>
                  {(["silent", "verbose", "sanitized"] as const).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.errorHandling.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* exposedToInternet */}
            <Grid
              item
              xs={12}
              sm={6}
              sx={{ display: "flex", alignItems: "center" }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={props.exposedToInternet || false}
                    onChange={(e) =>
                      handlePropertyChange(
                        "exposedToInternet",
                        e.target.checked,
                      )
                    }
                  />
                }
                label={t(
                  "tabs.dfd.element_description.process.fields.exposedToInternet.label",
                )}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Advanced */}
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" color="text.secondary">
              {t("tabs.dfd.element_description.process.sections.advanced")}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label={t(
                  "tabs.dfd.element_description.process.fields.securityControls.label",
                )}
                value={localSecurityControls}
                onChange={(e) => setLocalSecurityControls(e.target.value)}
                onBlur={() => {
                  if (localSecurityControls !== props.securityControls)
                    handlePropertyChange(
                      "securityControls",
                      localSecurityControls,
                    );
                }}
                placeholder={t(
                  "tabs.dfd.element_description.process.fields.securityControls.placeholder",
                )}
              />
              <TextField
                fullWidth
                size="small"
                label={t(
                  "tabs.dfd.element_description.process.fields.owner.label",
                )}
                value={localOwner}
                onChange={(e) => setLocalOwner(e.target.value)}
                onBlur={() => {
                  if (localOwner !== props.owner)
                    handlePropertyChange("owner", localOwner);
                }}
                placeholder={t(
                  "tabs.dfd.element_description.process.fields.owner.placeholder",
                )}
              />
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label={t(
                  "tabs.dfd.element_description.process.fields.notes.label",
                )}
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={() => {
                  if (localNotes !== props.notes)
                    handlePropertyChange("notes", localNotes);
                }}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Divider />
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t("tabs.dfd.element_description.process.fields.description.label")}
          </Typography>
          <RichTextEditor
            label={t(
              "tabs.dfd.element_description.process.fields.description.label",
            )}
            value={localDescription}
            onChange={setLocalDescription}
            onBlur={() => {
              if (localDescription !== element.description)
                onChange({ description: localDescription });
            }}
          />
        </Box>
      </Stack>
    );

    // ==================== TAB 2: ASSET ====================

    const renderAssetTab = () => (
      <Stack spacing={3}>
        <AssetRelationSelector
          assetRelations={assetRels}
          elementType={element.type}
          availableAssets={availableAssets}
          onChange={(relations) => onChange({ assetRelations: relations })}
          onCreateAsset={onCreateAsset}
        />

        {/* Safety annotation summary — only shown when there are annotated relations */}
        <SafetySummary
          assetRelations={assetRels}
          availableAssets={availableAssets}
        />
      </Stack>
    );

    // ==================== RENDER ====================

    return (
      <Box p={1}>
        <Tabs
          value={activeTab}
          onChange={(_, v: number) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("tabs.dfd.element_description.tabs.general")} />
          <Tab
            label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <span>{t("tabs.dfd.element_description.tabs.relations")}</span>
                {/* Badge: count of assets with safety annotations */}
                {assetRels.some(
                  (r) => !isIsAnRelation(r) && r.safety?.relevance !== "none",
                ) && (
                  <WarningAmberIcon
                    sx={{ fontSize: 14, color: "warning.main" }}
                  />
                )}
              </Stack>
            }
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {renderGeneralTab()}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {renderAssetTab()}
        </TabPanel>
      </Box>
    );
  },
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default ProcessDescriptionForm;