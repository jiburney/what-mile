import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .config folder when running locally
// On Vercel, process.env is populated automatically at runtime
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV })
}

// Server-side only Supabase client using service key (bypasses RLS)
// NEVER import this in frontend components — it uses process.env, not import.meta.env
// Used by: serverless functions, Node.js scripts, admin API routes

// Why process.env vs import.meta.env?
// - import.meta.env: Vite's browser-safe env vars, baked into the frontend bundle at build time
// - process.env: Node.js runtime env vars, available server-side in Vercel Functions and scripts

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
