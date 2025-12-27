import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from .env file (if it exists)
// In production, environment variables are set via Render dashboard, but this won't cause errors
dotenv.config()

const supabaseUrl: string | undefined = process.env.SUPABASE_URL
// Backend uses SERVICE_ROLE_KEY to bypass RLS (Row Level Security)
// This is required for backend operations like inserting logs, reading contact messages, etc.
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file. Backend requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY as fallback).')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch (error) {
  throw new Error(`Invalid SUPABASE_URL format: ${supabaseUrl}. It should be a valid URL (e.g., https://xxxxx.supabase.co)`)
}

// Warn if using ANON_KEY instead of SERVICE_ROLE_KEY
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY - RLS will be bypassed for backend operations')
} else {
  console.warn('⚠️  WARNING: Using SUPABASE_ANON_KEY instead of SUPABASE_SERVICE_ROLE_KEY. Backend operations may fail with RLS enabled. Please set SUPABASE_SERVICE_ROLE_KEY in your .env file.')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

