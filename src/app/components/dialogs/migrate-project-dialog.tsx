import React from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "shared";
import type { MigrationPrompt } from "../../services/project-migration-open";

// ==================== MIGRATE PROJECT DIALOG ====================
// Shown when opening a project saved with an older schema. Nothing on disk
// changes before the user confirms; then a backup is written first.

/** Target schema versions a conversion from → to passes through. */
export function migrationSteps(fromVersion: number, toVersion: number): number[] {
  const steps: number[] = [];
  for (let v = Math.max(fromVersion + 1, 1); v <= toVersion; v++) steps.push(v);
  return steps;
}

interface MigrateProjectDialogProps {
  prompt: MigrationPrompt;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MigrateProjectDialog: React.FC<MigrateProjectDialogProps> = ({
  prompt,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const steps = migrationSteps(prompt.fromVersion, prompt.toVersion);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="migrate-project-title"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <RefreshCw className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="min-w-0">
            <h3
              id="migrate-project-title"
              className="text-lg font-semibold text-gray-900"
            >
              {t("dialogs.migrateProject.title")}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {t("dialogs.migrateProject.intro", {
                name: prompt.projectName,
                from: prompt.fromVersion,
                to: prompt.toVersion,
              })}
            </p>

            <p className="text-gray-900 text-sm font-medium mt-3">
              {t("dialogs.migrateProject.reasonsTitle")}
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-sm text-gray-600">
              {steps.map((v) => (
                <li key={v}>
                  <span className="font-mono text-xs text-gray-500">v{v}</span>{" "}
                  {t(`dialogs.migrateProject.reasons.v${v}`)}
                </li>
              ))}
            </ul>

            <p className="text-gray-600 text-sm mt-3">
              {t("dialogs.migrateProject.backup")}
            </p>
            <p className="font-mono text-xs text-gray-700 break-all mt-1">
              {prompt.backupPath}
            </p>

            <p className="text-sm text-yellow-800 bg-yellow-50 rounded p-2 mt-3">
              {t("dialogs.migrateProject.warning")}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={onConfirm} className="flex-1">
            {t("dialogs.migrateProject.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};
