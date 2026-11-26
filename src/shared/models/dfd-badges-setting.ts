// src/shared/models/dfd-badges-setting.ts
//
// Whether the diagram shows the EL badges (0.20 patch 24, review 2026-11-21).
// EL / PEL are EN 50742 vocabulary: without a choice of the analyst the
// badges follow the project's EN 50742 tag (A or B, any spelling) — they
// appear when the tag is set and go when it is removed. An explicit choice
// in the project settings (settings.dfdBadges true / false) stays fixed.
// One rule for the editor, the report legend and the settings checkbox.

/** The badges are shown: the analyst's choice, else on in EN 50742 projects. */
export function dfdBadgesShown(setting: boolean | undefined, en50742: boolean): boolean {
  return setting ?? en50742;
}
