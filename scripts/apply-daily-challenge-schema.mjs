#!/usr/bin/env node

/**
 * Apply Daily Challenge schema migration (v6)
 * Creates daily_challenges and daily_scores tables, adds last_daily_used_at to photos
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Applying Daily Challenge schema (v6)...\n');

  // Read the SQL file
  const sqlPath = join(__dirname, '..', 'supabase', 'schema-v6.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split into individual statements (simple split on semicolons outside comments)
  const statements = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))  // Remove comment lines
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    // Show what we're executing (first 80 chars)
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ') + '...';
    console.log(`▶ ${preview}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

      if (error) {
        // If exec_sql RPC doesn't exist, try direct execution (won't work for DDL)
        console.warn(`  ⚠️  RPC method not available: ${error.message}`);
        console.warn(`  ℹ️  You may need to run this migration manually via Supabase SQL Editor`);
        errorCount++;
      } else {
        console.log(`  ✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   ✅ ${successCount} successful`);
  console.log(`   ❌ ${errorCount} failed`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. You may need to run the migration manually:');
    console.log(`   1. Open Supabase Dashboard → SQL Editor`);
    console.log(`   2. Paste contents of: supabase/schema-v6.sql`);
    console.log(`   3. Execute`);
  } else {
    console.log('\n🎉 Schema migration applied successfully!');
  }
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
