import { auditLogs, projectEvents, type DbTx } from '@glasswork/db';

/** Writes the activity-feed event and the audit row for one state change, inside the caller's transaction. */
export async function recordChange(
  tx: DbTx,
  p: {
    projectId: string;
    actorId: string | null;
    type: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    payload?: Record<string, unknown>;
  },
) {
  await tx.insert(projectEvents).values({
    projectId: p.projectId,
    actorId: p.actorId,
    type: p.type,
    payload: p.payload ?? {},
  });
  await tx.insert(auditLogs).values({
    actorId: p.actorId,
    action: p.type,
    entityType: p.entityType,
    entityId: p.entityId,
    before: (p.before ?? null) as object | null,
    after: (p.after ?? null) as object | null,
  });
}
