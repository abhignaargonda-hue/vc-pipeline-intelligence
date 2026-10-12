// Runs db/schema.sql against DATABASE_URL (Neon). Usage: npm run migrate
import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
const { rows } = await pool.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
console.log('Migrated. Tables:', rows.map(r => r.table_name).join(', '));
await pool.end();
