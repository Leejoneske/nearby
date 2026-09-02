// Keep-alive ping for the Supabase database.
// Triggered by a Vercel cron every 5 minutes.
// Uses the Supabase REST API directly — no SDK dependency needed.

export default async function handler(req, res) {
  const startedAt = Date.now();

  // The same project is referenced under several env var names depending on
  // which part of the app set it. Check them all.
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.VITE_SUPABASE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const elapsed = Date.now() - startedAt;
    return res.status(500).json({
      ok: false,
      error: "missing_supabase_config",
      ms: elapsed,
      at: new Date().toISOString(),
    });
  }

  try {
    // Minimal query — head request on the businesses table, no rows returned.
    const response = await fetch(`${supabaseUrl}/rest/v1/businesses?select=id&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
        Prefer: "count=exact",
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status}`);
    }

    const elapsed = Date.now() - startedAt;
    return res.status(200).json({
      ok: true,
      db: "awake",
      ms: elapsed,
      at: new Date().toISOString(),
    });
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    console.error("[ping] DB check failed:", error);
    return res.status(502).json({
      ok: false,
      db: "error",
      ms: elapsed,
      at: new Date().toISOString(),
    });
  }
}
