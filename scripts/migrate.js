#!/usr/bin/env node
// Applies any neon/migrations/*.sql files not yet recorded in schema_migrations,
// in filename order. Deliberately a plain script, not a framework (CLAUDE.md §6:
// "no ORM, no migration framework — overkill for one user").
//
// Deliberately NOT wired into the Vercel build. Preview and Production share one
// Neon database here (confirmed 2026-07-16 shipping the Travel redesign), so
// auto-running migrations on every build would apply an unmerged/unreviewed PR's
// schema change to the live database. Run this explicitly instead:
//   npm run migrate
// after merging a PR that adds a neon/migrations/*.sql file.

import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'neon', 'migrations');

// Splits a .sql file into individual statements on top-level `;` boundaries,
// while staying inside `'...'` string literals, `$tag$...$tag$` dollar-quoted
// function bodies (see 001_initial.sql's set_updated_at()), and `--` line
// comments — none of which may be split on. The Neon serverless driver only
// accepts one statement per call, so this replaces what a real Postgres client
// would do internally.
export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inLineComment = false;
  let inSingleQuote = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += sql[i + 1];
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += ch;
      i++;
      continue;
    }

    if (sql[i] === '-' && sql[i + 1] === '-') {
      inLineComment = true;
      current += '--';
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      i++;
      continue;
    }
    if (ch === '$') {
      const match = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ';') {
      statements.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(Boolean);
}

async function main() {
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'DATABASE_URL (or NEON_DATABASE_URL) is not set — nothing to migrate against.'
    );
    process.exit(1);
  }
  const sql = neon(databaseUrl);

  await sql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = await sql('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.filename));

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('Up to date — no pending migrations.');
    return;
  }

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const text = readFileSync(filePath, 'utf8');
    const statements = splitStatements(text);

    console.log(`Applying ${filename} (${statements.length} statements)...`);
    for (const statement of statements) {
      await sql(statement);
    }
    await sql('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      filename,
    ]);
    console.log(`  ✓ ${filename}`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

// Only run when executed directly (`node scripts/migrate.js` / `npm run
// migrate`), not when imported — e.g. by a test exercising splitStatements().
if (path.resolve(process.argv[1] || '') === path.resolve(__filename)) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
