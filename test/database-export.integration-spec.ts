import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

describe('database/database.sql export (integration)', () => {
  it('imports all assessment tables into an empty PostgreSQL schema', async () => {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    const schema = `phase4_export_${process.pid}_${Date.now()}`;
    const client = new Client({ connectionString });
    await client.connect();

    try {
      const existing = await client.query<{ exists: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists',
        [schema],
      );
      expect(existing.rows[0]?.exists).toBe(false);

      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);

      const exportSql = await readFile(
        resolve(process.cwd(), 'database/database.sql'),
        'utf8',
      );
      const statements = exportSql
        .replace(/^\s*BEGIN;\s*/i, '')
        .replace(/\s*COMMIT;\s*$/i, '');
      await client.query(statements);

      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
         ORDER BY table_name`,
        [schema],
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        'order_items',
        'orders',
        'payments',
      ]);

      const foreignKeys = await client.query<{ constraint_name: string }>(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE constraint_schema = $1
           AND constraint_type = 'FOREIGN KEY'
         ORDER BY constraint_name`,
        [schema],
      );
      expect(foreignKeys.rows.map((row) => row.constraint_name)).toEqual([
        'order_items_order_id_fkey',
        'payments_order_id_fkey',
      ]);
    } finally {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });
});
