// per-element threat i18n — all domains
import { GENERAL_ELEMENT_THREATS as general } from "./general/index";
import { EMBEDDED_ELEMENT_THREATS as embedded } from "./embedded/index";
import { CLOUD_ELEMENT_THREATS as cloud } from "./cloud/index";
import { MOBILE_ELEMENT_THREATS as mobile } from "./mobile/index";

export const PER_ELEMENT_THREATS = {
  ...general,
  ...embedded,
  ...cloud,
  ...mobile,
};