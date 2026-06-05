// general element threat i18n
import threatsSpoofing from "./threats-spoofing.json";
import threatsTampering from "./threats-tampering.json";
import threatsRepudiation from "./threats-repudiation.json";
import threatsInformation from "./threats-information.json";
import threatsDenial from "./threats-denial.json";
import threatsElevation from "./threats-elevation.json";

export const GENERAL_ELEMENT_THREATS = {
  general: {
    ...threatsSpoofing.general,
    ...threatsTampering.general,
    ...threatsRepudiation.general,
    ...threatsInformation.general,
    ...threatsDenial.general,
    ...threatsElevation.general,
  },
};