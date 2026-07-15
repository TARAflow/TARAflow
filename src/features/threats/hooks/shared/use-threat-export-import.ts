// ==================== USE THREATS EXPORT/IMPORT ====================
// Hook for exporting and importing threat data

import { useCallback } from "react";
import type { ThreatData, ThreatTable } from "../../models/threat-types";
import type { StrideMethod } from "shared";

// ==================== TYPES ====================

export interface ExportData {
  version: string;
  exportedAt: string;
  projectId: string;
  projectName: string;
  activeMethod: StrideMethod;
  perElementTables: ThreatTable[];
  perInteractionTables: ThreatTable[];
}

export interface ImportData {
  perElementTables: ThreatTable[];
  perInteractionTables: ThreatTable[];
}

export interface ImportValidationResult {
  success: boolean;
  data?: ImportData;
  error?: string;
  message?: string;
  stats?: {
    perElementTables: number;
    perInteractionTables: number;
    totalThreats: number;
  };
}

export interface UseThreatsExportImportOptions {
  projectId: string;
  projectName: string;
  activeMethod: StrideMethod;
  threatData: ThreatData;
}

export interface UseThreatsExportImportResult {
  exportThreats: () => void;
  validateImportData: (jsonString: string) => ImportValidationResult;
}

// ==================== HOOK ====================

export function useThreatsExportImport({
  projectId,
  projectName,
  activeMethod,
  threatData,
}: UseThreatsExportImportOptions): UseThreatsExportImportResult {
  
  const exportThreats = useCallback(() => {
    const exportData: ExportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      projectId,
      projectName,
      activeMethod,
      perElementTables: threatData.perElementTables,
      perInteractionTables: threatData.perInteractionTables,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_threats.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectId, projectName, activeMethod, threatData]);

  const validateImportData = useCallback((jsonString: string): ImportValidationResult => {
    try {
      const data = JSON.parse(jsonString);
      return validateImportObject(data);
    } catch {
      return {
        success: false,
        error: "parse_error",
        message: "Failed to parse JSON.",
      };
    }
  }, []);

  return {
    exportThreats,
    validateImportData,
  };
}

// ==================== HELPERS ====================

function validateImportObject(data: unknown): ImportValidationResult {
  if (!data || typeof data !== "object") {
    return {
      success: false,
      error: "invalid_format",
      message: "Expected a JSON object.",
    };
  }

  const obj = data as Record<string, unknown>;
  const hasPerElement = Array.isArray(obj.perElementTables);
  const hasPerInteraction = Array.isArray(obj.perInteractionTables);

  if (!hasPerElement && !hasPerInteraction) {
    return {
      success: false,
      error: "missing_tables",
      message: "File must contain perElementTables or perInteractionTables.",
    };
  }

  const perElementTables = hasPerElement
    ? validateThreatTables(obj.perElementTables as unknown[])
    : [];
  const perInteractionTables = hasPerInteraction
    ? validateThreatTables(obj.perInteractionTables as unknown[])
    : [];

  const totalThreats =
    perElementTables.reduce((sum, t) => sum + t.threats.length, 0) +
    perInteractionTables.reduce((sum, t) => sum + t.threats.length, 0);

  return {
    success: true,
    data: { perElementTables, perInteractionTables },
    stats: {
      perElementTables: perElementTables.length,
      perInteractionTables: perInteractionTables.length,
      totalThreats,
    },
  };
}

function validateThreatTables(tables: unknown[]): ThreatTable[] {
  return tables
    .filter(
      (t): t is Record<string, unknown> =>
        !!t &&
        typeof t === "object" &&
        typeof (t as Record<string, unknown>).trustBoundaryName === "string" &&
        Array.isArray((t as Record<string, unknown>).threats)
    )
    .map((t) => t as unknown as ThreatTable);
}