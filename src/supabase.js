
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigurado = Boolean(
  supabaseUrl?.startsWith('https://') && !supabaseUrl.includes('TU-PROYECTO')
    && supabaseKey && !supabaseKey.startsWith('TU_'),
)
export const supabase = supabaseConfigurado
  ? createClient(supabaseUrl, supabaseKey)
  : null
