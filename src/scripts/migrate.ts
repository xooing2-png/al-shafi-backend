import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { migrationDatabaseConfig } from '@/config/database';

const SKIP_ERRNOS = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME
  1061, // ER_DUP_KEYNAME
  1062, // ER_DUP_ENTRY
]);

function stripLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

function splitSqlStatements(schema: string): string[] {
  return stripLineComments(schema)
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function statementSummary(statement: string): string {
  const first = statement.replace(/\s+/g, ' ').trim();
  if (first.length <= 72) return first;
  return `${first.slice(0, 69)}...`;
}

function getMysqlErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const errno = (error as { errno?: unknown }).errno;
  return typeof errno === 'number' ? errno : undefined;
}

export async function runMigrations() {
  console.log('Running migrations...');
  const connection = await mysql.createConnection(migrationDatabaseConfig);
  let applied = 0;
  let skipped = 0;

  try {
    const schemaPath = resolve(__dirname, '../../schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    const statements = splitSqlStatements(schema);

    for (const statement of statements) {
      try {
        await connection.query(statement);
        applied += 1;
      } catch (error) {
        const errno = getMysqlErrorCode(error);
        if (errno !== undefined && SKIP_ERRNOS.has(errno)) {
          skipped += 1;
          continue;
        }
        console.error(`✗ Migration failed on: ${statementSummary(statement)}`);
        throw error;
      }
    }

    console.log(`✓ Migrations completed (${applied} applied, ${skipped} skipped)`);
  } catch (error) {
    console.error('⚠ Migration warning (non-fatal):', error);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✓ Migration script done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('⚠ Migration script warning:', error);
      process.exit(0);
    });
}