// ==================== DOCUMENTATION CONFIG DIALOG ====================
// Configuration dialog for document template settings
// - Organization name
// - Header/Footer
// - Classification
// - Date format
// - TOC and page numbers

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  Divider,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";

import type {
  DocConfiguration,
  DocTemplateConfig,
} from "../models/doc-types";
import { DEFAULT_TEMPLATE_CONFIG } from "../models/doc-types";

// ==================== TYPES ====================

interface DocConfigDialogProps {
  open: boolean;
  configuration: DocConfiguration;
  onSave: (config: DocConfiguration) => void;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ==================== COMPONENT ====================

export const DocConfigDialog: React.FC<DocConfigDialogProps> = ({
  open,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Local state
  const [tabValue, setTabValue] = useState(0);
  const [template, setTemplate] = useState<DocTemplateConfig>(
    configuration.template
  );

  // ==================== HANDLERS ====================

  const handleSave = () => {
    onSave({
      ...configuration,
      template,
    });
  };

  const handleReset = () => {
    setTemplate({ ...DEFAULT_TEMPLATE_CONFIG });
  };

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("tabs.doc.config.title", {
          defaultValue: "Document Template Settings",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            label={t("tabs.doc.config.general", { defaultValue: "General" })}
          />
          <Tab
            label={t("tabs.doc.config.headerFooter", {
              defaultValue: "Header & Footer",
            })}
          />
          <Tab
            label={t("tabs.doc.config.options", { defaultValue: "Options" })}
          />
        </Tabs>

        {/* General Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Organization Name */}
            <TextField
              label={t("tabs.doc.config.organization", {
                defaultValue: "Organization Name",
              })}
              value={template.organizationName}
              onChange={(e) =>
                setTemplate({ ...template, organizationName: e.target.value })
              }
              fullWidth
              helperText={t("tabs.doc.config.organizationHelp", {
                defaultValue: "Appears in document header metadata",
              })}
            />

            {/* Logo Path */}
            <TextField
              label={t("tabs.doc.config.logoPath", {
                defaultValue: "Logo Path",
              })}
              value={template.logoPath || ""}
              onChange={(e) =>
                setTemplate({ ...template, logoPath: e.target.value || undefined })
              }
              fullWidth
              placeholder="./images/logo.png"
              helperText={t("tabs.doc.config.logoPathHelp", {
                defaultValue: "Relative path to logo image file",
              })}
            />

            <Divider />

            {/* Classification */}
            <FormControl component="fieldset">
              <FormLabel>
                {t("tabs.doc.config.classification", {
                  defaultValue: "Document Classification",
                })}
              </FormLabel>
              <RadioGroup
                row
                value={template.classification || ""}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    classification: e.target.value as DocTemplateConfig["classification"] || undefined,
                  })
                }
              >
                <FormControlLabel
                  value=""
                  control={<Radio />}
                  label={t("tabs.doc.config.noClassification", {
                    defaultValue: "None",
                  })}
                />
                <FormControlLabel
                  value="public"
                  control={<Radio />}
                  label={isGerman ? "Öffentlich" : "Public"}
                />
                <FormControlLabel
                  value="internal"
                  control={<Radio />}
                  label={isGerman ? "Intern" : "Internal"}
                />
                <FormControlLabel
                  value="confidential"
                  control={<Radio />}
                  label={isGerman ? "Vertraulich" : "Confidential"}
                />
                <FormControlLabel
                  value="restricted"
                  control={<Radio />}
                  label={isGerman ? "Eingeschränkt" : "Restricted"}
                />
              </RadioGroup>
            </FormControl>

            <Divider />

            {/* Version */}
            <FormControl component="fieldset">
              <FormLabel>
                {t("tabs.doc.config.version", {
                  defaultValue: "Document Version",
                })}
              </FormLabel>
              <RadioGroup
                value={template.versionMode}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    versionMode: e.target.value as "auto" | "custom",
                  })
                }
              >
                <FormControlLabel
                  value="auto"
                  control={<Radio />}
                  label={t("tabs.doc.config.versionAuto", {
                    defaultValue: "Use project version",
                  })}
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography>
                        {t("tabs.doc.config.versionCustom", {
                          defaultValue: "Custom version:",
                        })}
                      </Typography>
                      <TextField
                        size="small"
                        value={template.customVersion || ""}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            customVersion: e.target.value,
                          })
                        }
                        disabled={template.versionMode !== "custom"}
                        placeholder="1.0.0"
                        sx={{ width: 120 }}
                      />
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </TabPanel>

        {/* Header & Footer Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Alert severity="info">
              {t("tabs.doc.config.headerFooterInfo", {
                defaultValue:
                  "Header and footer text will appear in PDF exports. For Markdown/AsciiDoc, they are included as comments.",
              })}
            </Alert>

            {/* Header Text */}
            <TextField
              label={t("tabs.doc.config.headerText", {
                defaultValue: "Header Text",
              })}
              value={template.headerText || ""}
              onChange={(e) =>
                setTemplate({ ...template, headerText: e.target.value || undefined })
              }
              fullWidth
              multiline
              rows={2}
              placeholder={
                isGerman
                  ? "z.B. Firmenname - Vertraulich"
                  : "e.g. Company Name - Confidential"
              }
            />

            {/* Footer Text */}
            <TextField
              label={t("tabs.doc.config.footerText", {
                defaultValue: "Footer Text",
              })}
              value={template.footerText || ""}
              onChange={(e) =>
                setTemplate({ ...template, footerText: e.target.value || undefined })
              }
              fullWidth
              multiline
              rows={2}
              placeholder={
                isGerman
                  ? "z.B. © 2024 Firma GmbH - Alle Rechte vorbehalten"
                  : "e.g. © 2024 Company Inc. - All rights reserved"
              }
            />
          </Box>
        </TabPanel>

        {/* Options Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Date Format */}
            <FormControl fullWidth>
              <InputLabel>
                {t("tabs.doc.config.dateFormat", {
                  defaultValue: "Date Format",
                })}
              </InputLabel>
              <Select
                value={template.dateFormat}
                label={t("tabs.doc.config.dateFormat", {
                  defaultValue: "Date Format",
                })}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    dateFormat: e.target.value as DocTemplateConfig["dateFormat"],
                  })
                }
              >
                <MenuItem value="iso">
                  ISO (2024-01-15)
                </MenuItem>
                <MenuItem value="eu">
                  {isGerman ? "Europäisch" : "European"} (15.01.2024)
                </MenuItem>
                <MenuItem value="us">
                  US (01/15/2024)
                </MenuItem>
              </Select>
            </FormControl>

            <Divider />

            {/* TOC */}
            <FormControlLabel
              control={
                <Switch
                  checked={template.includeToc}
                  onChange={(e) =>
                    setTemplate({ ...template, includeToc: e.target.checked })
                  }
                />
              }
              label={
                <Box>
                  <Typography>
                    {t("tabs.doc.config.includeToc", {
                      defaultValue: "Include Table of Contents",
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.config.includeTocHelp", {
                      defaultValue:
                        "Generates a clickable table of contents at the beginning",
                    })}
                  </Typography>
                </Box>
              }
            />

            {/* Page Numbers */}
            <FormControlLabel
              control={
                <Switch
                  checked={template.includePageNumbers}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      includePageNumbers: e.target.checked,
                    })
                  }
                />
              }
              label={
                <Box>
                  <Typography>
                    {t("tabs.doc.config.includePageNumbers", {
                      defaultValue: "Include Page Numbers (PDF)",
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.config.includePageNumbersHelp", {
                      defaultValue: "Adds page numbers in PDF exports",
                    })}
                  </Typography>
                </Box>
              }
            />
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} color="inherit">
          {t("common.reset", { defaultValue: "Reset" })}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocConfigDialog;