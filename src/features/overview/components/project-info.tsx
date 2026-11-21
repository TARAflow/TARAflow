import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X } from "lucide-react";
import type { ProjectInfoData, RatingLoss } from "../models/overview-types";
import type { ProjectTags } from "shared";
import { ProjectInfoFields } from "./project-info-fields";
import { RatingLossDialog } from "./rating-loss-dialog";

// ==================== PROJECT INFO ====================
// Displays and allows editing of project metadata. The fields themselves are
// ProjectInfoFields (shared with the New Project dialog); this component adds
// the view/edit toggle and the read-only Created / Last Modified row.

interface ProjectInfoProps {
  info: ProjectInfoData;
  onUpdate: (info: ProjectInfoData) => void;
  /**
   * The ratings a tag change would delete (app layer). Absent or undefined
   * result → saved without asking.
   */
  ratingLossOf?: (tags: ProjectTags) => RatingLoss | undefined;
}

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ info, onUpdate, ratingLossOf }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectInfoData>(info);
  // A tag change that deletes ratings waits for the analyst's answer.
  const [pendingLoss, setPendingLoss] = useState<RatingLoss | null>(null);

  const handleEdit = () => {
    setEditData(info);
    setIsEditing(true);
  };

  const save = () => {
    setPendingLoss(null);
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleSave = () => {
    const tagsChanged = JSON.stringify(editData.tags) !== JSON.stringify(info.tags);
    const loss = tagsChanged ? ratingLossOf?.(editData.tags) : undefined;
    if (loss) {
      setPendingLoss(loss);
      return;
    }
    save();
  };

  const handleCancel = () => {
    setEditData(info);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("projectInfo.title")}
        </h3>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {t("common.edit")}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {t("common.save")}
            </button>
          </div>
        )}
      </div>

      <ProjectInfoFields
        value={isEditing ? editData : info}
        editing={isEditing}
        onChange={(patch) => setEditData((d) => ({ ...d, ...patch }))}
        // The description is "Purpose and functions" in the Definition view.
        showDescription={false}
        afterDescription={
          /* Created (1/2) | Last Modified (1/2) - always read-only */
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("project.created")}
              </label>
              <p className="text-gray-900 py-2">{formatDate(info.created)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("project.lastModified")}
              </label>
              <p className="text-gray-900 py-2">
                {formatDate(info.lastModified)}
              </p>
            </div>
          </div>
        }
      />
      {pendingLoss && (
        <RatingLossDialog loss={pendingLoss} onConfirm={save} onCancel={() => setPendingLoss(null)} />
      )}
    </div>
  );
};
