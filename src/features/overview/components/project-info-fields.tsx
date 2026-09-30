import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import {
  SafetyAnalysisToggle,
  ProjectTagsEditor,
  regulationPresetFromTags,
} from "shared";
import type { ProjectInfoData } from "../models/overview-types";
import { WindowOfOpportunitySelector } from "./window-of-opportunity-selector";

// ==================== PROJECT INFO FIELDS ====================
// The project metadata form body, shared by the Overview tab (ProjectInfo,
// view/edit toggle) and the New Project dialog (always editing). Owning the
// fields in ONE place keeps the two from drifting apart again.
//
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Safety Switch (1/2) | Window of Opportunity (1/2)
//     -> WoO only for EN 50742 Approach A; otherwise Safety takes the row
//   Description (1/1)
//   [afterDescription slot — e.g. Created / Last Modified]
//   Tags (1/1)
//
// Header, save/cancel, validation and any surrounding chrome stay with the
// caller; this component only renders fields and reports patches.

export type ProjectInfoFieldsValue = Pick<
  ProjectInfoData,
  | "name"
  | "version"
  | "responsible"
  | "description"
  | "tags"
  | "safetyRelevant"
  | "windowOfOpportunity"
>;

export type ProjectInfoRequiredField = "name" | "responsible" | "description";

interface ProjectInfoFieldsProps {
  value: ProjectInfoFieldsValue;
  editing: boolean;
  onChange: (patch: Partial<ProjectInfoFieldsValue>) => void;
  /** Fields marked with a red asterisk (validation stays with the caller). */
  required?: readonly ProjectInfoRequiredField[];
  /** Per-field validation messages; a message also turns the border red. */
  errors?: Partial<Record<ProjectInfoRequiredField, string>>;
  autoFocusName?: boolean;
  /** Rendered between Description and Tags. */
  afterDescription?: React.ReactNode;
}

const INPUT =
  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

export const ProjectInfoFields: React.FC<ProjectInfoFieldsProps> = ({
  value,
  editing,
  onChange,
  required = [],
  errors = {},
  autoFocusName = false,
  afterDescription,
}) => {
  const { t } = useTranslation();

  const star = (f: ProjectInfoRequiredField) =>
    editing && required.includes(f) ? (
      <>
        {" "}
        <span className="text-red-500">*</span>
      </>
    ) : null;

  const border = (f?: ProjectInfoRequiredField) =>
    f && errors[f] ? "border-red-500" : "border-gray-300";

  const error = (f: ProjectInfoRequiredField) =>
    editing && errors[f] ? (
      <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        {errors[f]}
      </div>
    ) : null;

  const wooRelevant = regulationPresetFromTags(value.tags) === "en-50742-a";

  return (
    <div className="space-y-4">
      {/* Project Name (1/1) */}
      <div>
        <label htmlFor="project-name" className={LABEL}>
          {t("project.name")}
          {star("name")}
        </label>
        {editing ? (
          <input
            id="project-name"
            type="text"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t("projectInfo.namePlaceholder", {
              defaultValue: "Enter project name...",
            })}
            className={`${INPUT} ${border("name")}`}
            autoFocus={autoFocusName}
          />
        ) : (
          <p className="text-gray-900 py-2">{value.name}</p>
        )}
        {error("name")}
      </div>

      {/* Version (1/2) | Responsible (1/2) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="project-version" className={LABEL}>
            {t("project.version")}
          </label>
          {editing ? (
            <input
              id="project-version"
              type="text"
              value={value.version}
              onChange={(e) => onChange({ version: e.target.value })}
              placeholder={t("projectInfo.versionPlaceholder", {
                defaultValue: "1.0",
              })}
              className={`${INPUT} ${border()}`}
            />
          ) : (
            <p className="text-gray-900 py-2">{value.version}</p>
          )}
        </div>

        <div>
          <label htmlFor="project-responsible" className={LABEL}>
            {t("project.responsible")}
            {star("responsible")}
          </label>
          {editing ? (
            <input
              id="project-responsible"
              type="text"
              value={value.responsible}
              onChange={(e) => onChange({ responsible: e.target.value })}
              placeholder={t("projectInfo.responsiblePlaceholder", {
                defaultValue: "Person responsible...",
              })}
              className={`${INPUT} ${border("responsible")}`}
            />
          ) : (
            <p className="text-gray-900 py-2">{value.responsible || "-"}</p>
          )}
          {error("responsible")}
        </div>
      </div>

      {/* Safety Switch (1/2) | Window of Opportunity (1/2) — WoO only for
          EN 50742 Approach A; Safety takes the full row otherwise, so there's
          never an empty half. */}
      <div
        className={wooRelevant ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"}
      >
        <SafetyAnalysisToggle
          tags={value.tags}
          safetyRelevant={value.safetyRelevant ?? false}
          editing={editing}
          onChange={(v) => onChange({ safetyRelevant: v })}
        />
        {wooRelevant && (
          <WindowOfOpportunitySelector
            tags={value.tags}
            value={value.windowOfOpportunity}
            editing={editing}
            onChange={(v) => onChange({ windowOfOpportunity: v })}
          />
        )}
      </div>

      {/* Description (1/1) */}
      <div>
        <label htmlFor="project-description" className={LABEL}>
          {t("project.description")}
          {star("description")}
        </label>
        {editing ? (
          <textarea
            id="project-description"
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={4}
            placeholder={t("projectInfo.descriptionPlaceholder", {
              defaultValue: "Describe your project...",
            })}
            className={`${INPUT} ${border("description")} resize-none`}
          />
        ) : (
          <p className="text-gray-900 py-2 whitespace-pre-wrap">
            {value.description || "-"}
          </p>
        )}
        {error("description")}
      </div>

      {afterDescription}

      {/* Tags (1/1) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("project.tags")}
        </label>
        <ProjectTagsEditor
          tags={value.tags}
          editing={editing}
          onChange={(tags) => onChange({ tags })}
        />
      </div>
    </div>
  );
};
