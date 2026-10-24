// ==================== CALCULATION STAMP ====================
// ISO/SAE 21434 conformance plan 0c (decision 17). Records WITH WHAT a stored
// value was computed: the method, the version of the calculation code and a
// hash of the tables it ran through. Lives in shared because both
// features/risks (Risk) and features/attacktree (PathAnalysis) carry it.
//
// Written only under iso-21434, only by the app layer (commitCalcStamps) and
// only when a value was actually (re)computed. No timestamp — recomputing with
// unchanged inputs must not change the file. Absent = computed before 0c.

export interface CalcStamp {
  /** Calculation method, e.g. "iso-21434". */
  method: string;
  /** Versions of the calculation cores the value ran through, e.g.
   * "risk-1+feasibility-1". Bumped by hand; golden tests guard it. */
  calcVersion: string;
  /** 12-hex FNV-1a over the canonical JSON of the tables used. */
  mappingVersion: string;
}
