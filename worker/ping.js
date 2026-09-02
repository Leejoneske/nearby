/**
 * Tiny Cloudflare Worker that pings the nearby Supabase database every 5 min.
 * Deployed separately from the Pages site — it's its own Worker with a cron trigger.
 */
export default {
  async scheduled(event, env, ctx) {
    const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      console.error("[ping] Missing Supabase config in worker env vars");
      return;
    }

    try {
      const res = await fetch(`${url}/rest/v1/businesses?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      console.log(`[ping] DB ${res.ok ? "OK" : "FAIL"} (${res.status})`);
    } catch (error) {
      console.error("[ping] DB ping failed:", error);
    }
  },
};
