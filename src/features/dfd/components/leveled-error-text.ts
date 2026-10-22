// The user-facing text of a leveled action error (review finding 2).
import type { TFunction } from "i18next";
import { leveledErrorKey, type LeveledActionError } from "../models/leveled-errors";

export function leveledErrorText(code: LeveledActionError, t: TFunction): string {
  return String(t(leveledErrorKey(code), { defaultValue: code }));
}
