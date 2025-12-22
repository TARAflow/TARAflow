import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X, Plus } from "lucide-react";

// ==================== PROJECT INFO ====================
// Displays and allows editing of project metadata
//
// Note: Uses Interface Segregation - only receives what it needs

export interface ProjectInfoData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: string[];
  team: string[];
}

interface ProjectInfoProps {
  /** Project info data */
  info: ProjectInfoData;
  /** Callback when info is updated */
  onUpdate: (info: ProjectInfoData) => void;
}

// Predefined tags for quick selection
const PREDEFINED_TAGS = [
  "Web",
  "Mobile",
  "Cloud",
  "Embedded",
  "Desktop",
  "System",
  "IoT",
  "high-priority",
  "critical",
];

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ info, onUpdate }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectInfoData>(info);
  const [tagInput, setTagInput] = useState("");
  const [teamInput, setTeamInput] = useState("");

  const handleEdit = () => {
    setEditData(info);
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(info);
    setIsEditing(false);
    setTagInput("");
    setTeamInput("");
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

  // ==================== TAG HANDLERS ====================

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !editData.tags.includes(trimmedTag)) {
      setEditData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // ==================== TEAM HANDLERS ====================

  const addTeamMember = (member: string) => {
    const trimmedMember = member.trim();
    if (trimmedMember && !editData.team.includes(trimmedMember)) {
      setEditData((prev) => ({
        ...prev,
        team: [...prev.team, trimmedMember],
      }));
      setTeamInput("");
    }
  };

  const removeTeamMember = (memberToRemove: string) => {
    setEditData((prev) => ({
      ...prev,
      team: prev.team.filter((member) => member !== memberToRemove),
    }));
  };

  const handleTeamKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTeamMember(teamInput);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
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

      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label
            htmlFor="project-name"
            className="block text-sm font-medium text-gray-500 mb-1"
          >
            {t("project.name")}
          </label>
          {isEditing ? (
            <input
              id="project-name"
              type="text"
              value={editData.name}
              onChange={(e) =>
                setEditData({ ...editData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <p className="text-gray-900">{info.name}</p>
          )}
        </div>

        {/* Version */}
        <div>
          <label
            htmlFor="project-version"
            className="block text-sm font-medium text-gray-500 mb-1"
          >
            {t("project.version")}
          </label>
          {isEditing ? (
            <input
              id="project-version"
              type="text"
              value={editData.version}
              onChange={(e) =>
                setEditData({ ...editData, version: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <p className="text-gray-900">{info.version}</p>
          )}
        </div>

        {/* Responsible */}
        <div>
          <label
            htmlFor="project-responsible"
            className="block text-sm font-medium text-gray-500 mb-1"
          >
            {t("project.responsible")}
          </label>
          {isEditing ? (
            <input
              id="project-responsible"
              type="text"
              value={editData.responsible}
              onChange={(e) =>
                setEditData({ ...editData, responsible: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <p className="text-gray-900">{info.responsible || "-"}</p>
          )}
        </div>

        {/* Created */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">
            {t("project.created")}
          </label>
          <p className="text-gray-900">{formatDate(info.created)}</p>
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label
            htmlFor="project-description"
            className="block text-sm font-medium text-gray-500 mb-1"
          >
            {t("project.description")}
          </label>
          {isEditing ? (
            <textarea
              id="project-description"
              value={editData.description}
              onChange={(e) =>
                setEditData({ ...editData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <p className="text-gray-900">{info.description || "-"}</p>
          )}
        </div>

        {/* Tags */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-500 mb-1">
            {t("project.tags")}
          </label>
          {isEditing ? (
            <div className="space-y-2">
              {/* Current Tags */}
              {editData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900"
                        aria-label={t("common.remove")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Tag Input */}
              <div className="flex gap-2">
                <select
                  aria-label={t("projectInfo.selectPredefinedTag")}
                  value=""
                  onChange={(e) => e.target.value && addTag(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {t("projectInfo.predefinedTags", {
                      defaultValue: "Predefined tags...",
                    })}
                  </option>
                  {PREDEFINED_TAGS.filter(
                    (tag) => !editData.tags.includes(tag)
                  ).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  placeholder={t("projectInfo.customTagPlaceholder", {
                    defaultValue: "Custom tag...",
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                  aria-label={t("projectInfo.addTag", {
                    defaultValue: "Add tag",
                  })}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {info.tags.length > 0 ? (
                info.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">
                  {t("projectInfo.noTags", { defaultValue: "No tags" })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Team */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-500 mb-1">
            {t("project.team")}
          </label>
          {isEditing ? (
            <div className="space-y-2">
              {/* Current Team Members */}
              {editData.team.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editData.team.map((member) => (
                    <span
                      key={member}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                    >
                      {member}
                      <button
                        type="button"
                        onClick={() => removeTeamMember(member)}
                        className="hover:text-green-900"
                        aria-label={t("common.remove")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Team Member Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  onKeyPress={handleTeamKeyPress}
                  placeholder={t("projectInfo.teamMemberPlaceholder", {
                    defaultValue: "Add team member...",
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => addTeamMember(teamInput)}
                  disabled={!teamInput.trim()}
                  aria-label={t("projectInfo.addTeamMember", {
                    defaultValue: "Add team member",
                  })}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {info.team.length > 0 ? (
                info.team.map((member) => (
                  <span
                    key={member}
                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    {member}
                  </span>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">
                  {t("projectInfo.noTeamMembers", {
                    defaultValue: "No team members",
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Last Modified */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-500 mb-1">
            {t("project.lastModified")}
          </label>
          <p className="text-gray-900">{formatDate(info.lastModified)}</p>
        </div>
      </div>
    </div>
  );
};