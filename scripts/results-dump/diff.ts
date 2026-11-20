// scripts/results-dump/diff.ts
//
// Structural difference of two results dumps, one line per changed leaf:
//   + threats.methods.per-element.threats.<key>          (new)
//   - risks.risks.<id>                                   (gone)
//   ~ compliance.iec-62443-4-2.achieved.rows.CR 1.1.status: "met" → "unknown"
// The header (versions, commits, file hash) is not compared — it names the
// inputs, it is not a result.

const IGNORED_TOP = new Set(["header"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const show = (v: unknown): string => {
  const s = JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 120 ? `${s.slice(0, 117)}…` : s;
};

export function diffDumps(before: unknown, after: unknown): string[] {
  const out: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (isObject(a) && isObject(b)) {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) {
        if (!path && IGNORED_TOP.has(key)) continue;
        const p = path ? `${path}.${key}` : key;
        if (!(key in b)) out.push(`- ${p}`);
        else if (!(key in a)) out.push(`+ ${p}`);
        else walk(a[key], b[key], p);
      }
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      if (Array.isArray(a) && Array.isArray(b) && a.every((x) => typeof x !== "object") && b.every((x) => typeof x !== "object")) {
        const gone = a.filter((x) => !b.includes(x));
        const added = b.filter((x) => !a.includes(x));
        if (gone.length || added.length) {
          out.push(`~ ${path}: ${gone.length ? `-${show(gone)} ` : ""}${added.length ? `+${show(added)}` : ""}`.trimEnd());
          return;
        }
      }
      out.push(`~ ${path}: ${show(a)} → ${show(b)}`);
    }
  };
  walk(before, after, "");
  return out;
}
