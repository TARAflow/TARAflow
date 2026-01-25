// ==================== XML PARSER ====================
// Single Responsibility: Low-level XML parsing and DOM utilities

/**
 * Parse XML string to DOM Document
 */
export function parseXmlString(xml: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xml, "text/xml");
}

/**
 * Extract XML from DrawioMsg JSON format
 */
export function extractXmlFromDrawioMsg(drawioMsg: string): string | null {
  try {
    const parsed = JSON.parse(drawioMsg);
    return parsed.xml || null;
  } catch {
    return null;
  }
}

/**
 * Clean HTML from label (DrawIO sometimes wraps text in divs)
 */
export function cleanLabel(label: string): string {
  if (!label) return "";

  // Remove HTML tags and decode entities
  const cleaned = label
    .replace(/<[^>]*>/g, " ") // Replace HTML tags with space
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  return cleaned;
}

/**
 * Extract geometry point from mxGeometry element
 */
export function extractPoint(
  geometry: Element | undefined,
  as: string
): { x: number; y: number } | undefined {
  if (!geometry) return undefined;
  const p = geometry.querySelector(`mxPoint[as="${as}"]`);
  if (!p) return undefined;
  return {
    x: parseFloat(p.getAttribute("x") || "0"),
    y: parseFloat(p.getAttribute("y") || "0"),
  };
}

/**
 * Parse curved attribute from style string
 */
export function parseCurved(style: string): boolean | undefined {
  const m = /curved=([01])/.exec(style);
  if (!m) return undefined;
  return m[1] === "1";
}

/**
 * Parse arrow configuration from style string
 */
export function parseArrow(style: string): {
  start?: string;
  end?: string;
  bidirectional?: boolean;
} {
  const start = /startArrow=([^;]+)/.exec(style)?.[1];
  const end = /endArrow=([^;]+)/.exec(style)?.[1];
  return {
    start,
    end,
    bidirectional: !!(start && end),
  };
}

/**
 * Check if cell ID is a root cell
 */
export function isRootCell(id: string): boolean {
  return id === "0" || id === "1";
}

/**
 * Get element type from DrawIO cell
 * Checks both 'type' (lowercase) and 'Type' (uppercase) attributes
 */
export function getElementType(element: Element): string {
  return (
    element.getAttribute("type") ||
    element.getAttribute("Type") ||
    ""
  ).toLowerCase();
}

/**
 * Get geometry data from element
 */
export function getGeometry(element: Element): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const geometry = element.getElementsByTagName("mxGeometry")[0];
  if (!geometry) return null;

  return {
    x: parseFloat(geometry.getAttribute("x") || "0"),
    y: parseFloat(geometry.getAttribute("y") || "0"),
    width: parseFloat(geometry.getAttribute("width") || "100"),
    height: parseFloat(geometry.getAttribute("height") || "100"),
  };
}

/**
 * Get waypoints from connection geometry
 */
export function getWaypoints(geometry: Element): Array<{ x: number; y: number }> {
  const waypoints: Array<{ x: number; y: number }> = [];
  const points = geometry.getElementsByTagName("mxPoint");

  Array.from(points).forEach((point) => {
    const as = point.getAttribute("as");
    if (as !== "sourcePoint" && as !== "targetPoint" && as !== "offset") {
      const x = parseFloat(point.getAttribute("x") || "0");
      const y = parseFloat(point.getAttribute("y") || "0");
      waypoints.push({ x, y });
    }
  });

  return waypoints;
}