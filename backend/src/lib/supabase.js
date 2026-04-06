import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

let supabaseClient = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}
