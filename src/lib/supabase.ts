import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Admin client — persists session for admin UI authentication
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Game client — always anonymous, never inherits admin session
// Prevents admin login from breaking the game for users who visit both
export const supabaseGame = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})
