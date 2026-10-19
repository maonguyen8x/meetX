import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { env } from '../src/config/env.js';
import { postgres } from '../src/db/postgres.js';
import { logger } from '../src/utils/logger.js';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const migrationsPath = resolve(process.cwd(), 'prisma/migrations');

async function getAppliedEmbeddingDimension(): Promise<number | null> {
  const result = await postgres.query<{ migrationTable: string | null }>(
    'SELECT to_regclass(\'public._prisma_migrations\')::text AS "migrationTable"',
  );
  if (!result.rows[0]?.migrationTable) return null;

  const migrations = await postgres.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM public._prisma_migrations',
  );
  if (Number(migrations.rows[0]?.count ?? 0) === 0) return null;

  const column = await postgres.query<{ dataType: string | null }>(
    `SELECT format_type(atttypid, atttypmod) AS "dataType"
     FROM pg_attribute
     WHERE attrelid = to_regclass('public.document_chunks')
       AND attname = 'embedding'
       AND NOT attisdropped`,
  );
  const match = column.rows[0]?.dataType?.match(/^vector\((\d+)\)$/);
  if (!match?.[1]) {
    throw new Error('The database has migrations but no supported document embedding column.');
  }
  return Number(match[1]);
}

function updateDimension(source: string, dimension: number, label: string): string {
  const updated = source.replace(/vector\(\d+\)/g, `vector(${dimension})`);
  if (updated === source && !source.includes(`vector(${dimension})`)) {
    throw new Error(`Could not find a vector dimension in ${label}.`);
  }
  return updated;
}

async function main(): Promise<void> {
  const appliedDimension = await getAppliedEmbeddingDimension();
  if (appliedDimension !== null) {
    if (appliedDimension !== env.EMBEDDING_DIM) {
      throw new Error(
        `The database uses vector(${appliedDimension}); changing it requires a new migration.`,
      );
    }
    logger.info(
      { embeddingDimension: appliedDimension },
      'Database already uses this embedding dimension',
    );
    return;
  }

  const migrationFolders = await readdir(migrationsPath, { withFileTypes: true });
  const initialMigration = migrationFolders.find(
    (entry) => entry.isDirectory() && entry.name.endsWith('_initial'),
  );
  if (!initialMigration) {
    throw new Error(
      'Initial Prisma migration is missing; regenerate it before setting the embedding size.',
    );
  }

  const migrationPath = resolve(migrationsPath, initialMigration.name, 'migration.sql');
  const [schema, migration] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(migrationPath, 'utf8'),
  ]);
  await Promise.all([
    writeFile(schemaPath, updateDimension(schema, env.EMBEDDING_DIM, schemaPath), 'utf8'),
    writeFile(migrationPath, updateDimension(migration, env.EMBEDDING_DIM, migrationPath), 'utf8'),
  ]);
  logger.info({ embeddingDimension: env.EMBEDDING_DIM }, 'Updated initial vector column dimension');
}

main()
  .catch((error: unknown) => {
    logger.fatal({ err: error }, 'Failed to set the embedding dimension');
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
