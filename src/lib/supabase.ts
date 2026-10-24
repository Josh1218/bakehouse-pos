import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The anon key is meant to be public. It can only do what Row Level Security
// allows, and the rules in supabase/schema.sql require a signed-in user.
export const isSupabaseConfigured = Boolean(url && anonKey);

// createClient throws on an empty URL, so use a placeholder when .env is missing
// (App shows a setup screen in that case and never calls the client).
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});
