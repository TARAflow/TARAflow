/**
 * Migrate schema version 3 → 4.
 * Drops DataFlow.properties.direction.
 *
 * Rationale: direction ("unidirectional" | "requestresponse" | deprecated
 * "bidirectional") duplicated information already fully carried by the DF
 * label verb + tag (see dataflow-labeling-convention_v3.md — the label IS
 * the source of truth: pull[req|resp|req_resp], push[cmd|event|event_ack],
 * write, read, stream[stream]?). No downstream consumer read the field's
 * VALUE for a decision — threat-catalog-service.matchesContext never
 * referenced it, and both cross-validators (dataflow-property-validator.ts
 * C1/C2/C6/C6r/C7/C8, dataflow-label-property-validator.ts's disabled
 * runLP1) existed solely to catch the two representations drifting apart.
 * Removing the field removes the drift risk instead of guarding against it.
 *
 * The key is simply dropped — no replacement value needed, since coverage
 * and validation now derive "does this flow have a complete label" directly
 * from the label via dataflow-label-validator.ts's parseLabel(). Idempotent.
 */
export function migrate_3_to_4(data: any): any {
  const migrateConnection = (conn: any): any => {
    const props = conn?.properties;
    if (!props || !("direction" in props)) return conn; // already migrated / never set

    const { direction: _drop, ...restProps } = props;
    return { ...conn, properties: restProps };
  };

  if (data.dfd?.connections?.length) {
    data = {
      ...data,
      dfd: {
        ...data.dfd,
        connections: data.dfd.connections.map(migrateConnection),
      },
    };
  }
  return { ...data, schemaVersion: 4 };
}
