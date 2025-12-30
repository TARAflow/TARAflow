// ==================== ASSET EXPORT/IMPORT DIALOG ====================
// Dialog for exporting and importing asset configuration and data
// Allows selection of what to export/import: configuration and/or data

import React, { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  Divider,
  Chip,
  Stack,
  Radio,
  RadioGroup,
} from "@mui/material";
import {
  Download as ExportIcon,
  Upload as UploadIcon,
  Settings as ConfigIcon,
  Storage as DataIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";

import {
  AssetData,
  AssetConfiguration,
  Asset,
  AssetExportData,
  AssetExportOptions,
  AssetImportOptions,
} from "../models/asset-types";

// ==================== TYPES ====================

export type ExportImportMode = "export" | "import";

interface AssetExportImportDialogProps {
  open: boolean;
  mode: ExportImportMode;
  assetData: AssetData;
  projectName?: string;
  onExport?: (options: AssetExportOptions) => void;
  onImport?: (data: AssetExportData, options: AssetImportOptions) => void;
  onClose: () => void;
}

// ==================== CONSTANTS ====================

const EXPORT_VERSION = "1.0.0";

// ==================== COMPONENT ====================

export const AssetExportImportDialog: React.FC<AssetExportImportDialogProps> = ({
  open,
  mode,
  assetData,
  projectName,
  onExport,
  onImport,
  onClose,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export options state
  const [exportConfig, setExportConfig] = useState(true);
  const [exportAssets, setExportAssets] = useState(true);

  // Import options state
  const [importConfig, setImportConfig] = useState(true);
  const [importAssets, setImportAssets] = useState(true);
  const [mergeAssets, setMergeAssets] = useState(false);

  // Import file state
  const [importedData, setImportedData] = useState<AssetExportData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // ==================== EXPORT HANDLERS ====================

  const handleExport = useCallback(() => {
    if (!onExport) return;

    const options: AssetExportOptions = {
      includeConfiguration: exportConfig,
      includeAssets: exportAssets,
    };

    // Create export data
    const exportData: AssetExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      projectName: projectName,
    };

    if (exportConfig) {
      exportData.configuration = assetData.configuration;
    }

    if (exportAssets) {
      exportData.assets = assetData.assets;
    }

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = (projectName || "assets").replace(/[^a-z0-9]/gi, "_");
    const suffix = exportConfig && exportAssets ? "full" : exportConfig ? "config" : "data";
    const filename = `${safeName}_assets_${suffix}_${timestamp}.json`;

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onExport(options);
    onClose();
  }, [exportConfig, exportAssets, assetData, projectName, onExport, onClose]);

  // ==================== IMPORT HANDLERS ====================

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setImportError(null);
      setImportedData(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content) as AssetExportData;

          // Validate basic structure
          if (!data.version || !data.exportedAt) {
            throw new Error(
              t("tabs.assets.exportImport.invalidFormat", {
                defaultValue: "Invalid file format - missing required fields",
              })
            );
          }

          // Check what's in the file
          const hasConfig = Boolean(data.configuration);
          const hasAssets = Boolean(data.assets && data.assets.length > 0);

          if (!hasConfig && !hasAssets) {
            throw new Error(
              t("tabs.assets.exportImport.emptyFile", {
                defaultValue: "File contains no configuration or asset data",
              })
            );
          }

          // Update import options based on file content
          setImportConfig(hasConfig);
          setImportAssets(hasAssets);

          setImportedData(data);
        } catch (err) {
          setImportError(
            err instanceof Error
              ? err.message
              : t("tabs.assets.exportImport.parseError", {
                  defaultValue: "Failed to parse file",
                })
          );
        }
      };
      reader.onerror = () => {
        setImportError(
          t("tabs.assets.exportImport.readError", {
            defaultValue: "Failed to read file",
          })
        );
      };
      reader.readAsText(file);
    },
    [t]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback(() => {
    if (!onImport || !importedData) return;

    const options: AssetImportOptions = {
      importConfiguration: importConfig && Boolean(importedData.configuration),
      importAssets: importAssets && Boolean(importedData.assets?.length),
      mergeAssets: mergeAssets,
    };

    onImport(importedData, options);
    onClose();
  }, [importedData, importConfig, importAssets, mergeAssets, onImport, onClose]);

  // ==================== COMPUTED ====================

  const hasConfigInFile = importedData?.configuration !== undefined;
  const hasAssetsInFile =
    importedData?.assets !== undefined && importedData.assets.length > 0;
  const assetCountInFile = importedData?.assets?.length ?? 0;
  const existingAssetCount = assetData.assets.length;

  const canExport = exportConfig || exportAssets;
  const canImport =
    importedData &&
    (importConfig || importAssets) &&
    ((importConfig && hasConfigInFile) || (importAssets && hasAssetsInFile));

  // ==================== RENDER: EXPORT MODE ====================

  if (mode === "export") {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <ExportIcon color="primary" />
            <Typography variant="h6">
              {t("tabs.assets.exportImport.exportTitle", {
                defaultValue: "Export Asset Data",
              })}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Alert severity="info">
              {t("tabs.assets.exportImport.exportInfo", {
                defaultValue:
                  "Select what you want to export. The file can be imported into another project.",
              })}
            </Alert>

            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1.5 }}>
                {t("tabs.assets.exportImport.selectContent", {
                  defaultValue: "Select Content to Export",
                })}
              </FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportConfig}
                      onChange={(e) => setExportConfig(e.target.checked)}
                      icon={<ConfigIcon color="action" />}
                      checkedIcon={<ConfigIcon color="primary" />}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        variant="body2"
                        color={exportConfig ? "text.primary" : "text.disabled"}
                        sx={{ fontWeight: exportConfig ? 500 : 400 }}
                      >
                        {t("tabs.assets.exportImport.configuration", {
                          defaultValue: "Configuration",
                        })}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={
                          exportConfig ? "text.secondary" : "text.disabled"
                        }
                      >
                        {t("tabs.assets.exportImport.configurationDesc", {
                          defaultValue:
                            "Impact criteria, scale, and calculation settings",
                        })}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportAssets}
                      onChange={(e) => setExportAssets(e.target.checked)}
                      icon={<DataIcon color="action" />}
                      checkedIcon={<DataIcon color="primary" />}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        variant="body2"
                        color={exportAssets ? "text.primary" : "text.disabled"}
                        sx={{ fontWeight: exportAssets ? 500 : 400 }}
                      >
                        {t("tabs.assets.exportImport.assetData", {
                          defaultValue: "Asset Data",
                        })}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={
                          exportAssets ? "text.secondary" : "text.disabled"
                        }
                      >
                        {t("tabs.assets.exportImport.assetDataDesc", {
                          count: assetData.assets.length,
                          defaultValue: `${assetData.assets.length} assets with impact ratings and security goals`,
                        })}
                      </Typography>
                    </Box>
                  }
                />
              </FormGroup>
            </FormControl>

            {!canExport && (
              <Alert severity="warning">
                {t("tabs.assets.exportImport.selectAtLeastOne", {
                  defaultValue: "Please select at least one option to export.",
                })}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            startIcon={<ExportIcon />}
            disabled={!canExport}
          >
            {t("common.export", { defaultValue: "Export" })}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // ==================== RENDER: IMPORT MODE ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <UploadIcon color="primary" />
          <Typography variant="h6">
            {t("tabs.assets.exportImport.importTitle", {
              defaultValue: "Import Asset Data",
            })}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* File Selection */}
          <Box>
            <input
              aria-label={t("tabs.asset.importFile")}
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <Button
              variant="outlined"
              onClick={handleBrowseClick}
              startIcon={<UploadIcon />}
              fullWidth
              sx={{ py: 2 }}
            >
              {fileName ||
                t("tabs.assets.exportImport.selectFile", {
                  defaultValue: "Select JSON File",
                })}
            </Button>
          </Box>

          {importError && <Alert severity="error">{importError}</Alert>}

          {importedData && (
            <>
              {/* File Info */}
              <Alert severity="success">
                <Typography variant="body2">
                  {t("tabs.assets.exportImport.fileLoaded", {
                    defaultValue: "File loaded successfully",
                  })}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {hasConfigInFile && (
                    <Chip
                      size="small"
                      icon={<ConfigIcon />}
                      label={t("tabs.assets.exportImport.hasConfig", {
                        defaultValue: "Configuration",
                      })}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {hasAssetsInFile && (
                    <Chip
                      size="small"
                      icon={<DataIcon />}
                      label={t("tabs.assets.exportImport.hasAssets", {
                        count: assetCountInFile,
                        defaultValue: `${assetCountInFile} Assets`,
                      })}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Stack>
                {importedData.projectName && (
                  <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                    {t("tabs.assets.exportImport.fromProject", {
                      name: importedData.projectName,
                      defaultValue: `From project: ${importedData.projectName}`,
                    })}
                  </Typography>
                )}
              </Alert>

              <Divider />

              {/* Import Options */}
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1.5 }}>
                  {t("tabs.assets.exportImport.selectImportContent", {
                    defaultValue: "Select Content to Import",
                  })}
                </FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={importConfig && hasConfigInFile}
                        onChange={(e) => setImportConfig(e.target.checked)}
                        disabled={!hasConfigInFile}
                      />
                    }
                    label={
                      <Box>
                        <Typography
                          variant="body2"
                          color={hasConfigInFile ? "inherit" : "text.disabled"}
                        >
                          {t("tabs.assets.exportImport.configuration", {
                            defaultValue: "Configuration",
                          })}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={
                            hasConfigInFile ? "text.secondary" : "text.disabled"
                          }
                        >
                          {hasConfigInFile
                            ? t("tabs.assets.exportImport.willReplaceConfig", {
                                defaultValue:
                                  "Will replace current configuration",
                              })
                            : t("tabs.assets.exportImport.notInFile", {
                                defaultValue: "Not available in file",
                              })}
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={importAssets && hasAssetsInFile}
                        onChange={(e) => setImportAssets(e.target.checked)}
                        disabled={!hasAssetsInFile}
                      />
                    }
                    label={
                      <Box>
                        <Typography
                          variant="body2"
                          color={hasAssetsInFile ? "inherit" : "text.disabled"}
                        >
                          {t("tabs.assets.exportImport.assetData", {
                            defaultValue: "Asset Data",
                          })}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={
                            hasAssetsInFile ? "text.secondary" : "text.disabled"
                          }
                        >
                          {hasAssetsInFile
                            ? t("tabs.assets.exportImport.assetsInFile", {
                                count: assetCountInFile,
                                defaultValue: `${assetCountInFile} assets in file`,
                              })
                            : t("tabs.assets.exportImport.notInFile", {
                                defaultValue: "Not available in file",
                              })}
                        </Typography>
                      </Box>
                    }
                  />
                </FormGroup>
              </FormControl>

              {/* Merge Option (only when importing assets) */}
              {importAssets && hasAssetsInFile && existingAssetCount > 0 && (
                <>
                  <Divider />
                  <FormControl component="fieldset">
                    <FormLabel component="legend" sx={{ mb: 1.5 }}>
                      {t("tabs.assets.exportImport.importMode", {
                        defaultValue: "Import Mode",
                      })}
                    </FormLabel>
                    <RadioGroup
                      value={mergeAssets ? "merge" : "replace"}
                      onChange={(e) =>
                        setMergeAssets(e.target.value === "merge")
                      }
                    >
                      <FormControlLabel
                        value="replace"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="body2">
                              {t("tabs.assets.exportImport.replaceAll", {
                                defaultValue: "Replace All",
                              })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t("tabs.assets.exportImport.replaceAllDesc", {
                                count: existingAssetCount,
                                defaultValue: `Delete existing ${existingAssetCount} assets and import new ones`,
                              })}
                            </Typography>
                          </Box>
                        }
                      />
                      <FormControlLabel
                        value="merge"
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="body2">
                              {t("tabs.assets.exportImport.merge", {
                                defaultValue: "Merge",
                              })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t("tabs.assets.exportImport.mergeDesc", {
                                defaultValue:
                                  "Add imported assets, update existing by ID",
                              })}
                            </Typography>
                          </Box>
                        }
                      />
                    </RadioGroup>
                  </FormControl>
                </>
              )}

              {/* Warning for replace mode */}
              {importAssets &&
                hasAssetsInFile &&
                !mergeAssets &&
                existingAssetCount > 0 && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    {t("tabs.assets.exportImport.replaceWarning", {
                      count: existingAssetCount,
                      defaultValue: `This will delete all ${existingAssetCount} existing assets.`,
                    })}
                  </Alert>
                )}

              {!canImport && (
                <Alert severity="info">
                  {t("tabs.assets.exportImport.selectAtLeastOneImport", {
                    defaultValue:
                      "Please select at least one option to import.",
                  })}
                </Alert>
              )}
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          startIcon={<UploadIcon />}
          disabled={!canImport}
        >
          {t("common.import", { defaultValue: "Import" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetExportImportDialog;