import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    console.warn('[Supabase] No URL configured — running in localStorage-only mode');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

/** True when real Supabase credentials are configured */
export const isSupabaseReady = () =>
    !!supabaseUrl && !supabaseUrl.includes('your-project-id');
