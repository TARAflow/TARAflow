// ==================== REPORT SECTION ====================
// A format-neutral section of a "sectioned" chapter: title, paragraphs,
// label / value facts and an optional table. The item definition (A-5) and
// the goals / claims chapter (Phase 4) are built from these; the generators
// lay them out (formatSectionedChapter / formatReportSection).

export interface ReportSection {
  title: string;
  /** Text of the section, one entry per paragraph. */
  paragraphs: string[];
  /** Label / value lines. */
  facts: [string, string][];
  table?: { headers: string[]; rows: string[][] };
}
