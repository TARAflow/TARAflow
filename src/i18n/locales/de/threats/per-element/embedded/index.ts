// embedded element threat i18n
import threatsSpoofing from "./threats-spoofing.json";
import threatsTampering from "./threats-tampering.json";
import threatsRepudiation from "./threats-repudiation.json";
import threatsInformation from "./threats-information.json";
import threatsDenial from "./threats-denial.json";
import threatsElevation from "./threats-elevation.json";

export const EMBEDDED_ELEMENT_THREATS = {
  embedded: {
    ...threatsSpoofing.embedded,
    ...threatsTampering.embedded,
    ...threatsRepudiation.embedded,
    ...threatsInformation.embedded,
    ...threatsDenial.embedded,
    ...threatsElevation.embedded,
  },
};