// cloud interaction threat i18n
import threatsSpoofing from "./threats-spoofing.json";
import threatsTampering from "./threats-tampering.json";
import threatsRepudiation from "./threats-repudiation.json";
import threatsInformation from "./threats-information.json";
import threatsDenial from "./threats-denial.json";
import threatsElevation from "./threats-elevation.json";

export const CLOUD_INTERACTION_THREATS = {
  ...threatsSpoofing.cloud,
  ...threatsTampering.cloud,
  ...threatsRepudiation.cloud,
  ...threatsInformation.cloud,
  ...threatsDenial.cloud,
  ...threatsElevation.cloud,
};