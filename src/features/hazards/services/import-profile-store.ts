// features/hazards/services/import-profile-store.ts
//
// Hazard import HI-9 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): the project's import profiles. Pure — the hazard tab keeps
// the list in HazardData.importProfiles.

import { cellStr } from "./apply-import-profile";
import type {
  ImportProfile,
  ImportProfileSource,
  StoredImportProfile,
  WorkbookPreview,
} from "../models/import-profile-types";

/** The header row of the profile's sheet as it reads now. */
export function headerSnapshot(workbook: WorkbookPreview, profile: ImportProfile): string[] {
  const sheet = profile.sheetName
    ? workbook.sheets.find((s) => s.name === profile.sheetName)
    : workbook.sheets[0];
  return (sheet?.rows[profile.headerRow] ?? []).map((c) => cellStr(c) ?? "");
}

/** The profile without the stored bookkeeping (source, last use). */
function mappingOf(profile: ImportProfile | StoredImportProfile): ImportProfile {
  const { source: _source, lastUsed: _lastUsed, ...mapping } = profile as StoredImportProfile;
  return mapping;
}

/** Insert or replace by id, keeping the list order (new ones at the end). */
function upsert(list: readonly StoredImportProfile[], entry: StoredImportProfile): StoredImportProfile[] {
  return list.some((p) => p.id === entry.id)
    ? list.map((p) => (p.id === entry.id ? entry : p))
    : [...list, entry];
}

/** "Save profile" in the dialog: the mapping, keeping where it was last used. */
export function saveProfile(
  list: readonly StoredImportProfile[] | undefined,
  profile: ImportProfile,
): StoredImportProfile[] {
  const previous = (list ?? []).find((p) => p.id === profile.id);
  return upsert(list ?? [], {
    ...mappingOf(profile),
    ...(previous?.source ? { source: previous.source } : {}),
    ...(previous?.lastUsed ? { lastUsed: previous.lastUsed } : {}),
  });
}

/** An import ran with this profile: store it with its source and the time. */
export function recordProfileUse(
  list: readonly StoredImportProfile[] | undefined,
  profile: ImportProfile,
  source: ImportProfileSource,
  now: string,
): StoredImportProfile[] {
  return upsert(list ?? [], { ...mappingOf(profile), source, lastUsed: now });
}
