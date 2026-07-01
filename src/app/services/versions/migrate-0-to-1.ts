/**
 * Migrate schema version 0 → 1.
 *
 * Version 0 = all projects saved before Release 1 (no schemaVersion field).
 * Changes introduced in v1:
 *   - riskMitigationMappings: new field, default []
 *   - platformContext per DFD element: default { runtime: 'unknown', deployment: 'unknown' }
 *   - rejectionRecord on rejected mitigations: scaffolded with migration notice
 *   - schemaVersion field itself added
 */
export function migrate_0_to_1(data: any): any {
  // riskMitigationMappings — new in v1
  if (!data.riskMitigationMappings) {
    data = { ...data, riskMitigationMappings: [] };
  }

  // platformContext per DFD element — new in v1
  if (data.dfd?.elements?.length) {
    data = {
      ...data,
      dfd: {
        ...data.dfd,
        elements: data.dfd.elements.map((el: any) =>
          el.platformContext
            ? el
            : {
                ...el,
                platformContext: {
                  runtime: "unknown",
                  deployment: "unknown",
                },
              },
        ),
      },
    };
  }

  // rejectionRecord on rejected mitigations — new in v1
  // Scaffolded with a migration notice so the analyst can complete it later.
  const migrateRejection = (m: any) => {
    if (m.status === "rejected" && !m.rejectionRecord) {
      return {
        ...m,
        rejectionRecord: {
          mitigationId: m.id,
          rejectedAt: null,
          rejectedBy: "unknown",
          reason:
            "(migrated from pre-release project — reason unknown, please complete)",
          decisionType: "risk_accepted",
        },
      };
    }
    return m;
  };

  if (data.threats?.perElementTables) {
    data = {
      ...data,
      threats: {
        ...data.threats,
        perElementTables: data.threats.perElementTables.map((t: any) => ({
          ...t,
          threats: t.threats?.map((th: any) => ({
            ...th,
            mitigations: th.mitigations?.map(migrateRejection) ?? [],
          })),
        })),
      },
    };
  }

  data = { ...data, schemaVersion: 1 };
  return data;
}