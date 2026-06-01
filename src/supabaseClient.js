import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawUrl) {
  const value = rawUrl?.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let supabase = null;
let supabaseReady = false;

try {
  if (supabaseUrl && supabaseAnonKey) {
    new URL(supabaseUrl);
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabaseReady = true;
  }
} catch {
  supabase = null;
  supabaseReady = false;
}

export { supabase, supabaseReady };
