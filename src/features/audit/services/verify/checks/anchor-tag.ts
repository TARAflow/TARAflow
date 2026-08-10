// ============ AUDIT VERIFICATION — CHECK: anchor tag ============
// The `audit-root` tag, if present, is a CONVENIENCE pointer to the anchor — it
// is checked AGAINST the pinned hash, never trusted as the source of it. A tag
// that points elsewhere is a finding (someone moved it), not a new truth. An
// absent tag is fine (the pin is the source of truth).

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";

export const checkAnchorTag: Check = async ({ reader, anchor }) => {
  const tagged = await reader.resolveRef("audit-root");
  if (tagged !== null && tagged !== anchor) {
    return [
      makeFinding("ANCHOR_TAG_MOVED", {
        context: { expected: anchor, actual: tagged },
      }),
    ];
  }
  return [];
};
