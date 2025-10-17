export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

export function ensureServerEnv() {
  if (!serverEnv.supabaseUrl) throw new Error("SUPABASE_URL is not configured");
  if (!serverEnv.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
}

