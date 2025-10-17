import { createClient } from "@supabase/supabase-js";
import { serverEnv, ensureServerEnv } from "./env-server";

ensureServerEnv();

export const supabaseAdmin = createClient(
  serverEnv.supabaseUrl,
  serverEnv.supabaseServiceRoleKey,
  {
    auth: { persistSession: false }
  }
);

