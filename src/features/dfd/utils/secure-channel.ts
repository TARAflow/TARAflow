// ==================== SECURE CHANNEL CONTEXT ====================
// Whether an element has a flow that can carry a secure channel such as TLS
// (user 2026-11-06): a flow over a network or bus. Human input, in-process
// calls and electrical signals carry none — an element with only such flows
// gets no TLS termination field. Unset protocol = unknown, so it counts; an
// element without flows (still being drawn) shows the field too.

import type { VisibilityContext } from "shared";
import { NO_TRANSPORT_MEDIUM_PROTOCOLS } from "../models/element-property-defaults";
import { PROTOCOL_META } from "../models/protocol-registry";

export function hasChannelCapableFlow(context: VisibilityContext | undefined): boolean {
  if (!context) return true;
  const links = [...context.incoming, ...context.outgoing];
  if (links.length === 0) return true;
  return links.some(({ flow }) => {
    const protocol = flow.properties?.protocol as string | undefined;
    if (!protocol) return true;
    if (NO_TRANSPORT_MEDIUM_PROTOCOLS.has(protocol as never)) return false;
    return PROTOCOL_META[protocol as keyof typeof PROTOCOL_META]?.group !== "electrical";
  });
}
