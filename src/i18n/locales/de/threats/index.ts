// Threat i18n root index — entry point for i18n.ts
import { SHARED_ELEMENT_THREATS } from "./shared/index";
import { GENERAL_ELEMENT_THREATS as general } from "./per-element/general/index";
import { EMBEDDED_ELEMENT_THREATS as embedded } from "./per-element/embedded/index";
import { CLOUD_ELEMENT_THREATS as cloud } from "./per-element/cloud/index";
import { MOBILE_ELEMENT_THREATS as mobile } from "./per-element/mobile/index";
import { GENERAL_INTERACTION_THREATS as generalInt } from "./per-interaction/general/index";
import { EMBEDDED_INTERACTION_THREATS as embeddedInt } from "./per-interaction/embedded/index";
import { CLOUD_INTERACTION_THREATS as cloudInt } from "./per-interaction/cloud/index";

export const ELEMENT_THREAT_TEXTS = {
  ...SHARED_ELEMENT_THREATS,
  ...general,
  ...embedded,
  ...cloud,
  ...mobile,
};

export const INTERACTION_THREAT_TEXTS = {
  ...SHARED_ELEMENT_THREATS,
  ...generalInt,
  ...embeddedInt,
  ...cloudInt,
};