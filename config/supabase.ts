import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl: string | undefined = process.env.SUPABASE_URL
const supabaseKey: string | undefined = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

