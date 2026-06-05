// per-interaction threat i18n — all domains
import { GENERAL_INTERACTION_THREATS as general } from "./general/index";
import { EMBEDDED_INTERACTION_THREATS as embedded } from "./embedded/index";
import { CLOUD_INTERACTION_THREATS as cloud } from "./cloud/index";

export const PER_INTERACTION_THREATS = {
  ...general,
  ...embedded,
  ...cloud,
};