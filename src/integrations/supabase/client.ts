import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://eaaelaaclzuidhdwsjsq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhYWVsYWFjbHp1aWRoZHdzanNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjcwMTMsImV4cCI6MjA4NzQwMzAxM30.BtGiLFvIVO76E6mwY-6blH_bRFbEJsNTA4V-xjbQO2k";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
