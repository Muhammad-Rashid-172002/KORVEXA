export * from './client';
export * from './password';
export * from './repositories/files';
export { runMigrations, MIGRATIONS_DIR } from './migrate';
export * from './schema';

/** Query helpers re-exported so apps never import a second drizzle-orm instance directly. */
export { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
