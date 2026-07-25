const cfg = window.SCALEUP_CONFIG || {};
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
const supabaseClient = isConfigured
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

const statusOrder = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"];
const state = {
  user: null,
  profile: null,
  subscription: null,
  jobs: [],
  searches: [],
  events: [],
  view: "dashboard",
  authMode: "signin",
  runActive: false,
  runProgress: 0,
  runStage: "Ready",
  runTimer: null,
  editingSearchId: null
};

const els = {
  setupWarning: document.getElementById("setup-warning"),
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPasswordWrap: document.getElementById("auth-password-wrap"),
  authPassword: document.getElementById("auth-password"),
  authConfirmWrap: document.getElementById("auth-confirm-wrap"),
  authConfirmPassword: document.getElementById("auth-confirm-password"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authMessage: document.getElementById("auth-message"),
  signupBtn: document.getElementById("signup-btn"),
  forgotPasswordBtn: document.getElementById("forgot-password-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
  newJobBtn: document.getElementById("new-job-btn"),
  viewTitle: document.getElementById("view-title"),
  viewSubtitle: document.getElementById("view-subtitle"),
  planLabel: document.getElementById("plan-label"),
  licenseLabel: document.getElementById("license-label"),
  jobDialog: null,
  jobForm: null,
  jobDialogTitle: null,
  cancelJobBtn: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  els.setupWarning.classList.toggle("hidden", isConfigured);
  bindEvents();

  if (!isConfigured) {
    showAuth("Configure Supabase first, then refresh.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  state.user = data.session?.user || null;
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    state.user = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      setAuthMode("recovery", "Enter a new password to finish resetting your account.");
      showAuth(els.authMessage.textContent);
      return;
    }
    await refresh();
  });
  await refresh();
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.authMode === "signup") await signUp();
    else if (state.authMode === "reset") await requestPasswordReset();
    else if (state.authMode === "recovery") await updatePassword();
    else await signIn();
  });
  els.signupBtn.addEventListener("click", () => {
    setAuthMode(state.authMode === "signup" ? "signin" : "signup");
  });
  els.forgotPasswordBtn.addEventListener("click", () => setAuthMode("reset"));
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
  els.signOutBtn.addEventListener("click", signOut);
  els.newJobBtn.addEventListener("click", startSearchRun);
}

async function refresh() {
  if (!state.user) {
    showAuth("");
    return;
  }

  showApp();
  await ensureProfile();
  await loadData();
  setView(state.view);
}

function showAuth(message) {
  els.authView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  els.signOutBtn.classList.add("hidden");
  els.newJobBtn.classList.add("hidden");
  els.authMessage.textContent = message || "";
}

function showApp() {
  els.authView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.signOutBtn.classList.remove("hidden");
  els.newJobBtn.classList.remove("hidden");
}

async function signIn() {
  clearAuthMessage();
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value
  });
  if (error) els.authMessage.textContent = error.message;
}

async function signUp() {
  clearAuthMessage();
  if (!passwordsMatch()) return;
  const { error } = await supabaseClient.auth.signUp({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  if (error) {
    showAuthMessage(error.message, "error");
    return;
  }
  setAuthMode("signin");
  showAuthMessage("Account created. Please check your email to confirm your account before signing in.", "success");
}

async function requestPasswordReset() {
  clearAuthMessage();
  const email = els.authEmail.value.trim();
  if (!email) {
    showAuthMessage("Enter your email address first.", "error");
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl()
  });
  showAuthMessage(
    error ? error.message : "Password reset email sent. Please check your inbox.",
    error ? "error" : "success"
  );
}

async function updatePassword() {
  clearAuthMessage();
  if (!passwordsMatch()) return;
  const { error } = await supabaseClient.auth.updateUser({
    password: els.authPassword.value
  });
  if (error) {
    showAuthMessage(error.message, "error");
    return;
  }
  await supabaseClient.auth.signOut();
  setAuthMode("signin");
  showAuthMessage("Password updated. Sign in with your new password.", "success");
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

function clearAuthMessage() {
  showAuthMessage("", "error");
}

function showAuthMessage(message, type = "error") {
  els.authMessage.textContent = message || "";
  els.authMessage.classList.toggle("success", type === "success");
}

function setAuthMode(mode, message = "") {
  state.authMode = mode;
  resetPasswordVisibility();
  const needsPassword = mode !== "reset";
  const needsConfirm = mode === "signup" || mode === "recovery";
  els.authPasswordWrap.classList.toggle("hidden", !needsPassword);
  els.authPassword.required = needsPassword;
  els.authConfirmWrap.classList.toggle("hidden", !needsConfirm);
  els.authConfirmPassword.required = needsConfirm;
  els.authSubmitBtn.textContent =
    mode === "signup" ? "Create account" :
    mode === "reset" ? "Send reset email" :
    mode === "recovery" ? "Update password" :
    "Sign in";
  els.signupBtn.textContent = mode === "signup" ? "I already have an account" : "Create account";
  els.forgotPasswordBtn.classList.toggle("hidden", mode === "reset" || mode === "recovery");
  els.authMessage.textContent = message;
  els.authMessage.classList.remove("success");
}

function togglePasswordVisibility(button) {
  const input = document.getElementById(button.dataset.passwordToggle);
  if (!input) return;
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.textContent = visible ? "Hide" : "Show";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}

function resetPasswordVisibility() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (input) input.type = "password";
    button.textContent = "Show";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Show password");
  });
}

function passwordsMatch() {
  if (els.authPassword.value.length < 6) {
    showAuthMessage("Password must be at least 6 characters.", "error");
    return false;
  }
  if (els.authPassword.value !== els.authConfirmPassword.value) {
    showAuthMessage("Passwords do not match.", "error");
    return false;
  }
  return true;
}

function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function ensureProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    state.profile = data;
    return;
  }

  const payload = {
    id: state.user.id,
    email: state.user.email,
    full_name: "",
    target_title: "",
    location: "",
    plan: "JobPilot Access",
    license_status: "active"
  };
  const { data: created, error: createError } = await supabaseClient
    .from("profiles")
    .insert(payload)
    .select("*")
    .single();
  if (createError) throw createError;
  state.profile = created;
}

async function loadData() {
  const [jobs, searches, subscription, events] = await Promise.all([
    supabaseClient.from("jobs").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("saved_searches").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("subscriptions").select("*").eq("user_id", state.user.id).maybeSingle(),
    supabaseClient.from("activity_events").select("*").order("created_at", { ascending: false }).limit(12)
  ]);

  if (jobs.error) throw jobs.error;
  if (searches.error) throw searches.error;
  if (subscription.error) throw subscription.error;
  if (events.error) throw events.error;

  state.jobs = jobs.data || [];
  state.searches = searches.data || [];
  state.subscription = subscription.data || null;
  state.events = events.data || [];

  els.planLabel.textContent = displayPlan();
  els.licenseLabel.textContent = displayStatus();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.add("hidden"));
  document.getElementById(`${view}-view`).classList.remove("hidden");

  const meta = {
    dashboard: ["Dashboard", "Upload CV, configure search, then run CV-based matching."],
    pipeline: ["Pipeline", "Track applications from discovered to offer."],
    jobs: ["Matched Jobs", "Jobs found by search/apply runs and scored against the CV."],
    searches: ["Search & Apply", "Choose platforms, keywords, exclusions, match threshold, and daily limits."],
    profile: ["Candidate Setup", "Upload CV and save the details JobPilot uses to match and apply."],
    billing: ["Account", "Your account access and product setup status."]
  };
  els.viewTitle.textContent = meta[view][0];
  els.viewSubtitle.textContent = meta[view][1];
  render();
}

function render() {
  renderDashboard();
  renderPipeline();
  renderJobs();
  renderSearches();
  renderProfile();
  renderBilling();
  bindDynamicActions();
}

function renderDashboard() {
  const total = state.jobs.length;
  const applied = countByStatus("Applied");
  const interviews = countByStatus("Interviewing");
  const offers = countByStatus("Offer");
  const avgScore = averageScore();

  document.getElementById("dashboard-view").innerHTML = `
    ${readinessPanel()}
    <div class="metrics-grid">
      ${metric("Matched jobs", total)}
      ${metric("Applied", applied)}
      ${metric("Interviews", interviews)}
      ${metric("Offers", offers)}
    </div>
    <div class="grid-2">
      <section class="panel">
        <h2>JobPilot workflow</h2>
        <table class="table">
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>CV/profile ready</td><td>${hasResume() ? "Yes" : "Needs CV"}</td></tr>
          <tr><td>Search setups</td><td>${state.searches.length}</td></tr>
          <tr><td>Average CV fit score</td><td>${avgScore ? `${avgScore}%` : "No scores yet"}</td></tr>
          <tr><td>Best platform</td><td>${bestPlatform()}</td></tr>
        </table>
        ${progressPanel()}
        <div class="panel-actions">
          <button class="button primary" data-start-run>Start search</button>
          <button class="button secondary" data-stop-run ${state.runActive ? "" : "disabled"}>Stop</button>
        </div>
        <p class="muted small">JobPilot uses your CV and search entries to decide which roles should be reviewed or applied to. Platform sign-in and browser automation follow the same workflow as the Windows app.</p>
      </section>
      <section class="panel">
        <div class="panel-title-row">
          <h2>Recent activity</h2>
          <button class="button ghost" data-clear-activity ${state.events.length ? "" : "disabled"}>Clear activity</button>
        </div>
        ${state.events.length ? state.events.map(eventRow).join("") : empty("No activity yet.")}
      </section>
    </div>
  `;
}

function renderPipeline() {
  document.getElementById("pipeline-view").innerHTML = `
    <div class="pipeline">
      ${statusOrder
        .map((status) => {
          const jobs = state.jobs.filter((job) => job.status === status);
          return `
            <section class="lane">
              <div class="lane-title">${status} (${jobs.length})</div>
              ${jobs.length ? jobs.map(jobCard).join("") : empty("No jobs")}
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderJobs() {
  document.getElementById("jobs-view").innerHTML = `
    <section class="panel">
      <h2>All jobs</h2>
      ${
        state.jobs.length
          ? `<table class="table">
              <thead><tr><th>Role</th><th>Platform</th><th>Status</th><th>Score</th><th></th></tr></thead>
              <tbody>${state.jobs.map(jobRow).join("")}</tbody>
            </table>`
          : empty("No matched jobs yet. Upload the CV, create a search setup, then run search.")
      }
    </section>
  `;
}

function renderSearches() {
  document.getElementById("searches-view").innerHTML = `
    <section class="panel">
        <h2>Create search/apply setup</h2>
        <form id="search-form" class="form-grid">
          <input id="search-id" type="hidden" />
          <label>Target role<input id="search-name" placeholder="Customer Success Manager" required /></label>
          <label>Platforms<input id="search-platform" placeholder="LinkedIn, Indeed, Wuzzuf, Bayt" /></label>
          <label>Must-have keywords<input id="search-keywords" placeholder="customer success, SaaS, account management" /></label>
          <label>Location<input id="search-location" placeholder="Remote, Cairo" /></label>
          <label>Minimum CV match %<input id="search-min-score" type="number" min="0" max="100" value="70" /></label>
          <label>Daily apply limit<input id="search-daily-limit" type="number" min="1" max="50" value="10" /></label>
          <label style="grid-column:1/-1">Exclude words<input id="search-exclusions" placeholder="senior director, unpaid, internship" /></label>
          <label style="grid-column:1/-1">Application mode
            <select id="search-mode">
              <option value="review">Review matches before applying</option>
              <option value="auto">Prepare applications for jobs above threshold</option>
            </select>
          </label>
        <div class="form-actions">
          <button class="button primary" type="submit" id="search-save-btn">Save setup</button>
          <button class="button secondary hidden" type="button" id="search-cancel-edit-btn">Cancel edit</button>
        </div>
      </form>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Search setups</h2>
      ${
        state.searches.length
          ? `<table class="table"><tbody>${state.searches.map(searchRow).join("")}</tbody></table>`
          : empty("No search setup yet.")
      }
    </section>
  `;
  document.getElementById("search-form").addEventListener("submit", saveSearch);
  document.getElementById("search-cancel-edit-btn").addEventListener("click", resetSearchForm);
  if (state.editingSearchId) populateSearchForm(state.searches.find((item) => item.id === state.editingSearchId));
}

function renderProfile() {
  const p = state.profile || {};
  document.getElementById("profile-view").innerHTML = `
    <section class="panel">
      <h2>Candidate profile and CV</h2>
      <form id="profile-form" class="form-grid">
        <label>Full name<input id="profile-name" value="${escapeAttr(p.full_name || "")}" /></label>
        <label>Email<input id="profile-email" value="${escapeAttr(p.email || state.user.email || "")}" /></label>
        <label>Target title<input id="profile-title" value="${escapeAttr(p.target_title || "")}" /></label>
        <label>Location<input id="profile-location" value="${escapeAttr(p.location || "")}" /></label>
        <label>LinkedIn URL<input id="profile-linkedin" value="${escapeAttr(p.linkedin_url || "")}" /></label>
        <label>Portfolio URL<input id="profile-portfolio" value="${escapeAttr(p.portfolio_url || "")}" /></label>
        <label style="grid-column:1/-1">Upload CV or resume<input id="profile-cv-file" type="file" accept=".txt,.md,.pdf,.doc,.docx" /></label>
        <label style="grid-column:1/-1">CV text used for matching<textarea id="profile-summary" rows="8" placeholder="Paste the CV text here, or upload a TXT/MD resume so JobPilot can read it for matching.">${escapeHtml(p.resume_summary || "")}</textarea></label>
        <div class="notice-box" style="grid-column:1/-1">
          <strong>Why CV text is required</strong>
          <p>JobPilot compares job requirements with the candidate CV before preparing applications. PDF/DOCX upload is accepted for record keeping, but paste or upload text for best matching accuracy.</p>
        </div>
        <button class="button primary" type="submit">Save candidate setup</button>
      </form>
    </section>
  `;
  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("profile-cv-file").addEventListener("change", handleCvUpload);
}

function renderBilling() {
  document.getElementById("billing-view").innerHTML = `
    <section class="panel">
      <h2>Account access</h2>
      <table class="table">
        <tr><th>Account</th><td>${escapeHtml(state.user.email || "")}</td></tr>
        <tr><th>Product</th><td>${escapeHtml(displayPlan())}</td></tr>
        <tr><th>Status</th><td>${escapeHtml(displayStatus())}</td></tr>
      </table>
      <div class="notice-box"><strong>Setup status</strong><p>${hasResume() ? "CV is ready for matching." : "Upload or paste CV text before running search."} ${state.searches.length ? "Search setup is ready." : "Create at least one search/apply setup."}</p></div>
    </section>
  `;
}

function metric(label, value) {
  return `<section class="metric-card"><div class="muted small">${label}</div><div class="value">${value}</div></section>`;
}

function jobCard(job) {
  return `
    <article class="job-card">
      <h3>${escapeHtml(job.title)}</h3>
      <p>${escapeHtml(job.company || "Unknown")} · ${escapeHtml(job.platform || "Imported")}</p>
      <span class="badge ${escapeAttr(job.status)}">${escapeHtml(job.status)}</span>
    </article>
  `;
}

function jobRow(job) {
  return `
    <tr>
      <td><strong>${escapeHtml(job.title)}</strong><br><span class="muted small">${escapeHtml(job.company || "")}</span></td>
      <td>${escapeHtml(job.platform || "Imported")}</td>
      <td><span class="badge ${escapeAttr(job.status)}">${escapeHtml(job.status)}</span></td>
      <td>${job.match_score ?? "-"}</td>
      <td>${job.url ? `<a class="button ghost" href="${escapeAttr(job.url)}" target="_blank" rel="noreferrer">Open</a>` : ""}</td>
    </tr>
  `;
}

function searchRow(search) {
  return `
    <tr>
      <td><strong>${escapeHtml(search.name)}</strong><br><span class="muted small">${escapeHtml(search.keywords || "")}</span></td>
      <td>${escapeHtml(search.location || "")}</td>
      <td>${escapeHtml(search.platform || "Any")}</td>
      <td><button class="button secondary" data-edit-search="${search.id}">Edit</button></td>
    </tr>
  `;
}

function eventRow(event) {
  return `<p><strong>${escapeHtml(titleCase(event.event_type))}</strong><br><span class="muted small">${escapeHtml(event.message || "")}</span></p>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function countByStatus(status) {
  return state.jobs.filter((job) => job.status === status).length;
}

function averageScore() {
  const scored = state.jobs.filter((job) => Number.isFinite(job.match_score));
  if (!scored.length) return 0;
  return Math.round(scored.reduce((sum, job) => sum + job.match_score, 0) / scored.length);
}

function bestPlatform() {
  const counts = {};
  state.jobs.forEach((job) => {
    const key = job.platform || "Imported";
    counts[key] = (counts[key] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (${top[1]})` : "No jobs yet";
}

function bindDynamicActions() {
  document.querySelectorAll("[data-start-run]").forEach((button) => {
    button.addEventListener("click", startSearchRun);
  });
  document.querySelectorAll("[data-stop-run]").forEach((button) => {
    button.addEventListener("click", stopSearchRun);
  });
  document.querySelectorAll("[data-edit-search]").forEach((button) => {
    button.addEventListener("click", () => editSearchSetup(button.dataset.editSearch));
  });
  document.querySelectorAll("[data-clear-activity]").forEach((button) => {
    button.addEventListener("click", clearActivity);
  });
}

async function startSearchRun() {
  if (!hasResume()) {
    await logEvent("cv_required", "Upload or paste CV text before running JobPilot matching.");
    state.view = "profile";
    await loadData();
    setView("profile");
    return;
  }
  if (!state.searches.length) {
    await logEvent("search_setup_required", "Create a search/apply setup before running JobPilot.");
    state.view = "searches";
    await loadData();
    setView("searches");
    return;
  }
  state.runActive = true;
  state.runProgress = 0;
  state.runStage = "Preparing CV and search filters";
  startProgressTimer();
  const active = state.searches[0];
  await logEvent("search_started", `Searching ${active.platform || "selected platforms"} for ${active.name}. CV matching threshold and daily limits will be applied.`);
  await loadData();
  render();
  await runOnlineSearch(active);
}

async function stopSearchRun() {
  if (!state.runActive) return;
  state.runActive = false;
  stopProgressTimer("Stopped", state.runProgress);
  await logEvent("search_stopped", "Stop requested for the current JobPilot search/apply workflow.");
  await loadData();
  render();
}

function displayPlan() {
  const raw = state.subscription?.plan || state.profile?.plan || "JobPilot Access";
  return raw.toLowerCase() === "trial" ? "JobPilot Access" : raw;
}

function displayStatus() {
  const raw = state.subscription?.status || state.profile?.license_status || "active";
  return raw.toLowerCase() === "trial" ? "active" : raw;
}

async function saveSearch(event) {
  event.preventDefault();
  const id = document.getElementById("search-id").value;
  const keywords = document.getElementById("search-keywords").value.trim();
  const minScore = document.getElementById("search-min-score").value.trim() || "70";
  const dailyLimit = document.getElementById("search-daily-limit").value.trim() || "10";
  const exclusions = document.getElementById("search-exclusions").value.trim();
  const mode = document.getElementById("search-mode").value === "auto"
    ? "prepare applications above threshold"
    : "review matches before applying";
  const payload = {
    user_id: state.user.id,
    name: document.getElementById("search-name").value.trim(),
    platform: document.getElementById("search-platform").value.trim(),
    keywords: [
      keywords && `keywords: ${keywords}`,
      `minimum CV match: ${minScore}%`,
      `daily apply limit: ${dailyLimit}`,
      exclusions && `exclude: ${exclusions}`,
      `mode: ${mode}`
    ].filter(Boolean).join("\n"),
    location: document.getElementById("search-location").value.trim(),
    frequency: "manual"
  };
  const result = id
    ? await supabaseClient.from("saved_searches").update(payload).eq("id", id)
    : await supabaseClient.from("saved_searches").insert(payload);
  const { error } = result;
  if (error) {
    alert(error.message);
    return;
  }
  await logEvent(id ? "search_updated" : "search_created", `${id ? "Updated" : "Saved"} search/apply setup for ${payload.name}.`);
  state.editingSearchId = null;
  await loadData();
  renderSearches();
  renderDashboard();
}

function editSearchSetup(id) {
  state.editingSearchId = id;
  state.view = "searches";
  setView("searches");
}

function populateSearchForm(search) {
  if (!search) return;
  document.getElementById("search-id").value = search.id;
  document.getElementById("search-name").value = search.name || "";
  document.getElementById("search-platform").value = search.platform || "";
  document.getElementById("search-location").value = search.location || "";
  const parsed = parseSearchKeywords(search.keywords || "");
  document.getElementById("search-keywords").value = parsed.keywords;
  document.getElementById("search-min-score").value = parsed.minScore;
  document.getElementById("search-daily-limit").value = parsed.dailyLimit;
  document.getElementById("search-exclusions").value = parsed.exclusions;
  document.getElementById("search-mode").value = parsed.mode;
  document.getElementById("search-save-btn").textContent = "Update setup";
  document.getElementById("search-cancel-edit-btn").classList.remove("hidden");
}

function resetSearchForm() {
  state.editingSearchId = null;
  document.getElementById("search-form").reset();
  document.getElementById("search-id").value = "";
  document.getElementById("search-min-score").value = "70";
  document.getElementById("search-daily-limit").value = "10";
  document.getElementById("search-save-btn").textContent = "Save setup";
  document.getElementById("search-cancel-edit-btn").classList.add("hidden");
}

function parseSearchKeywords(value) {
  const lines = String(value).split(/\r?\n/);
  const read = (prefix, fallback = "") => {
    const line = lines.find((item) => item.toLowerCase().startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : fallback;
  };
  const modeText = read("mode:", "review matches before applying");
  return {
    keywords: read("keywords:"),
    minScore: read("minimum cv match:", "70").replace("%", ""),
    dailyLimit: read("daily apply limit:", "10"),
    exclusions: read("exclude:"),
    mode: modeText.includes("prepare") ? "auto" : "review"
  };
}

async function runOnlineSearch(search) {
  try {
    const parsed = parseSearchKeywords(search.keywords || "");
    state.runProgress = 18;
    state.runStage = "Calling JobPilot search service";
    renderDashboard();

    const response = await fetch("/api/jobpilot-search.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: parsed.keywords || search.name,
        platforms: search.platform || "LinkedIn, Indeed, Wuzzuf",
        location: search.location || state.profile?.location || "Remote",
        exclusions: parsed.exclusions,
        limit: parsed.dailyLimit || 10
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Search service failed");

    state.runProgress = 54;
    state.runStage = "Scoring jobs against CV";
    renderDashboard();

    const minScore = Number.parseInt(parsed.minScore || "70", 10);
    const existingUrls = new Set(state.jobs.map((job) => job.url).filter(Boolean));
    const matched = (payload.jobs || [])
      .map((job) => ({ ...job, match_score: scoreJob(job, state.profile?.resume_summary || "", parsed.keywords) }))
      .filter((job) => job.match_score >= minScore && !existingUrls.has(job.url));

    state.runProgress = 78;
    state.runStage = `Saving ${matched.length} matched job(s)`;
    renderDashboard();

    if (matched.length) {
      const rows = matched.map((job) => ({
        user_id: state.user.id,
        saved_search_id: search.id,
        title: job.title || "Untitled role",
        company: job.company || "Unknown",
        platform: job.platform || "Imported",
        status: "Saved",
        location: job.location || "",
        url: job.url || "",
        description: job.description || "",
        match_score: job.match_score,
        ai_summary: `Matched from ${search.name} using CV keywords.`
      }));
      const { error } = await supabaseClient.from("jobs").insert(rows);
      if (error) throw error;
    }

    state.runActive = false;
    stopProgressTimer("Search completed", 100);
    await logEvent("search_completed", `Found ${payload.jobs?.length || 0} job(s), saved ${matched.length} CV-matched job(s).`);
    await loadData();
    render();
  } catch (error) {
    state.runActive = false;
    stopProgressTimer("Search failed", state.runProgress || 0);
    await logEvent("search_failed", error.message || "Search failed");
    await loadData();
    render();
  }
}

function scoreJob(job, resumeText, keywordText) {
  const haystack = `${job.title || ""} ${job.company || ""} ${job.description || ""}`.toLowerCase();
  const resumeTerms = extractTerms(`${resumeText} ${keywordText}`);
  if (!resumeTerms.length) return 0;
  const matched = resumeTerms.filter((term) => haystack.includes(term)).length;
  return Math.min(100, Math.round((matched / Math.min(resumeTerms.length, 30)) * 100));
}

function extractTerms(text) {
  const stop = new Set(["and", "the", "for", "with", "from", "that", "this", "your", "you", "are", "was", "were", "have", "has", "will", "job", "role"]);
  return [...new Set(String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stop.has(term)))]
    .slice(0, 80);
}

async function clearActivity() {
  const { error } = await supabaseClient
    .from("activity_events")
    .delete()
    .eq("user_id", state.user.id);
  if (error) {
    alert(error.message);
    return;
  }
  state.events = [];
  renderDashboard();
}

async function saveProfile(event) {
  event.preventDefault();
  const payload = {
    full_name: document.getElementById("profile-name").value.trim(),
    email: document.getElementById("profile-email").value.trim(),
    target_title: document.getElementById("profile-title").value.trim(),
    location: document.getElementById("profile-location").value.trim(),
    linkedin_url: document.getElementById("profile-linkedin").value.trim(),
    portfolio_url: document.getElementById("profile-portfolio").value.trim(),
    resume_summary: document.getElementById("profile-summary").value.trim()
  };
  const { data, error } = await supabaseClient
    .from("profiles")
    .update(payload)
    .eq("id", state.user.id)
    .select("*")
    .single();
  if (error) {
    alert(error.message);
    return;
  }
  state.profile = data;
  await logEvent("profile_updated", hasResume() ? "Candidate profile and CV matching text updated." : "Candidate profile updated; CV text is still required.");
  renderProfile();
}

async function handleCvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const summary = document.getElementById("profile-summary");
  const plainText = /\.(txt|md)$/i.test(file.name);
  if (plainText) {
    const text = await file.text();
    summary.value = `CV file: ${file.name}\n\n${text}`;
    return;
  }
  summary.value = `CV file uploaded: ${file.name}\n\nPaste the CV text here so JobPilot can score jobs against the candidate profile.`;
}

function hasResume() {
  return Boolean((state.profile?.resume_summary || "").trim());
}

function readinessPanel() {
  const steps = [
    ["CV", hasResume(), "Upload or paste CV text"],
    ["Search", state.searches.length > 0, "Create search/apply setup"],
    ["Run", state.events.some((event) => event.event_type === "search_started"), "Run search"]
  ];
  return `<section class="panel readiness-panel"><h2>Setup checklist</h2><div class="checklist">${steps.map(([label, done, text]) => `<div class="check-item ${done ? "done" : ""}"><strong>${label}</strong><span>${text}</span></div>`).join("")}</div></section>`;
}

function progressPanel() {
  return `<div class="progress-wrap">
    <div class="progress-head"><strong>${state.runActive ? "Search running" : "Search progress"}</strong><span>${state.runProgress}%</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${state.runProgress}%"></div></div>
    <p class="muted small">${escapeHtml(state.runStage)}</p>
  </div>`;
}

function startProgressTimer() {
  clearInterval(state.runTimer);
  const stages = [
    [12, "Reading CV and profile"],
    [24, "Preparing platform search filters"],
    [38, "Checking search/apply setup"],
    [52, "Scoring candidate fit rules"],
    [68, "Waiting for scraping worker connection"],
    [82, "Ready to import matched jobs"],
    [95, "Run is still active"]
  ];
  state.runTimer = setInterval(() => {
    if (!state.runActive) return;
    const next = stages.find(([pct]) => pct > state.runProgress);
    if (next) {
      state.runProgress = next[0];
      state.runStage = next[1];
    }
    renderDashboard();
  }, 1200);
}

function stopProgressTimer(stage, progress = state.runProgress) {
  clearInterval(state.runTimer);
  state.runTimer = null;
  state.runProgress = progress;
  state.runStage = stage;
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function logEvent(eventType, message) {
  await supabaseClient.from("activity_events").insert({
    user_id: state.user.id,
    event_type: eventType,
    message
  });
}

function parseNullableInt(value) {
  if (value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
