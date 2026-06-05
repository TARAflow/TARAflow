// Shared threat i18n — method-agnostic (interface, physical, gap)
import threatsGap from "./threats-gap.json";
import threatsInterface from "./threats-interface.json";
import threatsPhysical from "./threats-physical.json";

export const SHARED_ELEMENT_THREATS = {
  gap: threatsGap.gap,
  interface: threatsInterface.interface,
  physical: threatsPhysical.physical,
};
