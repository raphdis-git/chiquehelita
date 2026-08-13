import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zkwwfjinhbrjhebeasac.supabase.co';
const supabasePublishableKey = 'sb_publishable_8rHVJ55mtltj1yhXOaJXOA_K-yQhvy_';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
