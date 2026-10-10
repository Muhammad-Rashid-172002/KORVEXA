import { and, desc, eq, lt } from 'drizzle-orm';
import type { Database } from '../client';
import { files } from '../schema';

/** The authenticated principal every repository call is scoped to. */
export interface Actor {
  userId: string;
}

export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;

/**
 * Files repository. Every read/write is scoped by the actor — there is deliberately no
 * unscoped `findById` (brief §5 Authorization: "repository functions always scope by the current user").
 */
export function filesRepository(db: Database) {
  return {
    async create(actor: Actor, row: Omit<NewFileRow, 'ownerId'>): Promise<FileRow> {
      const [created] = await db
        .insert(files)
        .values({ ...row, ownerId: actor.userId })
        .returning();
      if (!created) throw new Error('insert failed');
      return created;
    },

    async findOwned(actor: Actor, id: string): Promise<FileRow | undefined> {
      const [row] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, id), eq(files.ownerId, actor.userId)))
        .limit(1);
      return row;
    },

    async listOwned(actor: Actor, opts: { cursor?: string; limit: number }): Promise<FileRow[]> {
      return db
        .select()
        .from(files)
        .where(and(eq(files.ownerId, actor.userId), opts.cursor ? lt(files.id, opts.cursor) : undefined))
        .orderBy(desc(files.id))
        .limit(opts.limit);
    },

    async updateOwned(
      actor: Actor,
      id: string,
      patch: Partial<Pick<NewFileRow, 'status' | 'uploadedAt' | 'sha256'>>,
    ): Promise<FileRow | undefined> {
      const [row] = await db
        .update(files)
        .set(patch)
        .where(and(eq(files.id, id), eq(files.ownerId, actor.userId)))
        .returning();
      return row;
    },
  };
}
export type FilesRepository = ReturnType<typeof filesRepository>;
