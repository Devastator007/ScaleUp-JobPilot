import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

type Job = {
  title: string;
  company: string;
  location: string;
  platform: string;
  url: string;
  description: string;
  source_key: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authorization } } }
    );
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("target_title, location, resume_summary, job_preferences, application_answers")
      .eq("id", authData.user.id)
      .single();
    if (profileError) throw profileError;
    if (!profile.target_title?.trim()) return json({ error: "Complete Target title in Candidate Setup first." }, 400);

    const prefs = profile.job_preferences || {};
    const selected = new Set((prefs.platforms || []).map((item: string) => item.toLowerCase()));
    const limit = Math.max(1, Math.min(Number(prefs.daily_apply_limit) || 10, 30));
    const jobs: Job[] = [];

    if (selected.has("remotive")) jobs.push(...await searchRemotive(profile.target_title));
    if (selected.has("arbeitnow")) jobs.push(...await searchArbeitnow(profile.target_title));

    const filtered = jobs
      .filter((job, index, list) => list.findIndex((item) => item.source_key === job.source_key) === index)
      .filter((job) => matches(job, prefs.must_have_keywords, prefs.exclude_keywords))
      .slice(0, limit);

    const rows = filtered.map((job) => ({
      user_id: authData.user.id,
      ...job,
      status: "Saved",
      action_status: "candidate_action_required",
      application_route: "outside_portal",
      notes: "Application is available on an outside portal. Review the prepared answers, then complete submission on the source website."
    }));

    let saved: Array<Record<string, unknown>> = [];
    if (rows.length) {
      const { data, error } = await supabase
        .from("jobs")
        .upsert(rows, { onConflict: "user_id,source_key", ignoreDuplicates: true })
        .select("id,title,company,platform,url,action_status");
      if (error) throw error;
      saved = data || [];

      if (prefs.application_mode === "auto_prepare" && saved.length) {
        const applications = saved.map((job) => ({
          user_id: authData.user.id,
          job_id: job.id,
          status: "candidate_action_required",
          submission_method: "outside_portal",
          answer_pack: profile.application_answers || {},
          notes: "Answers prepared from Candidate Setup. Candidate must review and submit on the outside portal."
        }));
        const { error } = await supabase.from("applications").upsert(applications, { onConflict: "user_id,job_id" });
        if (error) throw error;
      }
    }

    const unsupported = [...selected].filter((platform) => !["remotive", "arbeitnow"].includes(platform));
    return json({
      found: filtered.length,
      added: saved.length,
      unsupported,
      message: unsupported.length
        ? "Supported public feeds were searched. Other selected portals require candidate action on their own websites."
        : "Search completed."
    });
  } catch (error) {
    console.error("search-jobs", error);
    return json({ error: error instanceof Error ? error.message : "Search failed" }, 500);
  }
});

async function searchRemotive(query: string): Promise<Job[]> {
  const response = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=30`);
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.jobs || []).map((job: Record<string, unknown>) => ({
    title: String(job.title || ""),
    company: String(job.company_name || ""),
    location: String(job.candidate_required_location || "Remote"),
    platform: "Remotive",
    url: String(job.url || ""),
    description: stripHtml(String(job.description || "")).slice(0, 8000),
    source_key: `remotive:${job.id}`
  }));
}

async function searchArbeitnow(query: string): Promise<Job[]> {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!response.ok) return [];
  const payload = await response.json();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (payload.data || [])
    .filter((job: Record<string, unknown>) => words.some((word) => String(job.title || "").toLowerCase().includes(word)))
    .map((job: Record<string, unknown>) => ({
      title: String(job.title || ""),
      company: String(job.company_name || ""),
      location: String(job.location || ""),
      platform: "Arbeitnow",
      url: String(job.url || ""),
      description: stripHtml(String(job.description || "")).slice(0, 8000),
      source_key: `arbeitnow:${job.slug || job.url}`
    }));
}

function matches(job: Job, required = "", excluded = "") {
  const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  const includes = splitTerms(required);
  const excludes = splitTerms(excluded);
  return (!includes.length || includes.some((term) => text.includes(term)))
    && !excludes.some((term) => text.includes(term));
}

function splitTerms(value: string) {
  return String(value || "").toLowerCase().split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
