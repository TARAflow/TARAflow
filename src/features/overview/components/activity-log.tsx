import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from "react-i18next";
import type { ActivityLogEntry } from "shared";

// ==================== ACTIVITY LOG ====================
// Displays a list of activity entries
//
// Note: This component receives entries as props (Dependency Inversion)
//       It imports ActivityLogEntry type from project-types for consistency

// Re-export for convenience
export type { ActivityLogEntry };

interface ActivityLogProps {
  /** List of activity entries to display */
  entries: ActivityLogEntry[];
  /** Maximum number of entries to show (default: 5) */
  maxEntries?: number;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  entries,
  maxEntries = 5,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t("activity.title")}
      </h3>
      <div className="space-y-3">
        {entries.slice(0, maxEntries).map((entry, idx) => (
          <div key={idx} className="flex items-start gap-3 text-sm">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-gray-900">{entry.description}</div>
              <div className="text-gray-500 text-xs">
                {new Date(entry.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-gray-500 text-sm">
            {t("activity.noActivity")}
          </div>
        )}
      </div>
    </div>
  );
};