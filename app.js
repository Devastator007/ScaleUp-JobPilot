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
  runActive: false
};

const els = {
  setupWarning: document.getElementById("setup-warning"),
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
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
  jobDialog: document.getElementById("job-dialog"),
  jobForm: document.getElementById("job-form"),
  jobDialogTitle: document.getElementById("job-dialog-title"),
  cancelJobBtn: document.getElementById("cancel-job-btn")
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
  els.signOutBtn.addEventListener("click", signOut);
  els.newJobBtn.addEventListener("click", startSearchRun);
  els.cancelJobBtn.addEventListener("click", () => els.jobDialog.close());
  els.jobForm.addEventListener("submit", saveJob);
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
  const needsPassword = mode !== "reset";
  const needsConfirm = mode === "signup" || mode === "recovery";
  els.authPassword.parentElement.classList.toggle("hidden", !needsPassword);
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
    dashboard: ["Dashboard", "Search, score, review, and apply with a guided workflow."],
    pipeline: ["Pipeline", "Track applications from discovered to offer."],
    jobs: ["Opportunities", "Jobs discovered or reviewed by your JobPilot workflow."],
    searches: ["Search Setup", "Choose platforms, keywords, filters, and daily limits."],
    profile: ["Profile", "Your candidate profile and application defaults."],
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
    <div class="metrics-grid">
      ${metric("Tracked jobs", total)}
      ${metric("Applied", applied)}
      ${metric("Interviews", interviews)}
      ${metric("Offers", offers)}
    </div>
    <div class="grid-2">
      <section class="panel">
        <h2>JobPilot workflow</h2>
        <table class="table">
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Search setups</td><td>${state.searches.length}</td></tr>
          <tr><td>Average CV fit score</td><td>${avgScore ? `${avgScore}%` : "No scores yet"}</td></tr>
          <tr><td>Best platform</td><td>${bestPlatform()}</td></tr>
        </table>
        <div class="panel-actions">
          <button class="button primary" data-start-run>Start search</button>
          <button class="button secondary" data-stop-run ${state.runActive ? "" : "disabled"}>Stop</button>
        </div>
        <p class="muted small">The hosted app prepares and tracks your search workflow. Browser-based platform automation runs from the Windows desktop app where normal browser sessions and resume files are available.</p>
      </section>
      <section class="panel">
        <h2>Recent activity</h2>
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
          : empty("No opportunities yet. Create a search setup, then start a search run.")
      }
    </section>
  `;
  bindDynamicActions();
}

function renderSearches() {
  document.getElementById("searches-view").innerHTML = `
    <section class="panel">
        <h2>Create search setup</h2>
        <form id="search-form" class="form-grid">
          <label>Name<input id="search-name" placeholder="Customer Success Manager - Cairo" required /></label>
        <label>Platforms<input id="search-platform" placeholder="LinkedIn, Indeed, Wuzzuf, Bayt" /></label>
          <label>Keywords<input id="search-keywords" placeholder="customer success, account manager" /></label>
          <label>Location<input id="search-location" placeholder="Remote, Cairo" /></label>
        <button class="button primary" type="submit">Save setup</button>
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
}

function renderProfile() {
  const p = state.profile || {};
  document.getElementById("profile-view").innerHTML = `
    <section class="panel">
      <h2>Candidate profile</h2>
      <form id="profile-form" class="form-grid">
        <label>Full name<input id="profile-name" value="${escapeAttr(p.full_name || "")}" /></label>
        <label>Email<input id="profile-email" value="${escapeAttr(p.email || state.user.email || "")}" /></label>
        <label>Target title<input id="profile-title" value="${escapeAttr(p.target_title || "")}" /></label>
        <label>Location<input id="profile-location" value="${escapeAttr(p.location || "")}" /></label>
        <label>LinkedIn URL<input id="profile-linkedin" value="${escapeAttr(p.linkedin_url || "")}" /></label>
        <label>Portfolio URL<input id="profile-portfolio" value="${escapeAttr(p.portfolio_url || "")}" /></label>
        <label style="grid-column:1/-1">Resume summary<textarea id="profile-summary" rows="5">${escapeHtml(p.resume_summary || "")}</textarea></label>
        <button class="button primary" type="submit">Save profile</button>
      </form>
    </section>
  `;
  document.getElementById("profile-form").addEventListener("submit", saveProfile);
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
      <div class="notice-box">
        <strong>Windows automation required for platform applications.</strong>
        <p>Use the desktop app to sign in to LinkedIn and other platforms, run the normal browser automation, apply Stop safely, and keep resume files on your computer. This cloud workspace keeps account, profile, search setup, and opportunity tracking online.</p>
      </div>
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
      <p>${escapeHtml(job.company || "Unknown")} · ${escapeHtml(job.platform || "Manual")}</p>
      <span class="badge ${escapeAttr(job.status)}">${escapeHtml(job.status)}</span>
    </article>
  `;
}

function jobRow(job) {
  return `
    <tr>
      <td><strong>${escapeHtml(job.title)}</strong><br><span class="muted small">${escapeHtml(job.company || "")}</span></td>
      <td>${escapeHtml(job.platform || "Manual")}</td>
      <td><span class="badge ${escapeAttr(job.status)}">${escapeHtml(job.status)}</span></td>
      <td>${job.match_score ?? "-"}</td>
      <td class="row-actions">
        <button class="button secondary" data-edit-job="${job.id}">Edit</button>
        ${job.url ? `<a class="button ghost" href="${escapeAttr(job.url)}" target="_blank" rel="noreferrer">Open</a>` : ""}
      </td>
    </tr>
  `;
}

function searchRow(search) {
  return `
    <tr>
      <td><strong>${escapeHtml(search.name)}</strong><br><span class="muted small">${escapeHtml(search.keywords || "")}</span></td>
      <td>${escapeHtml(search.location || "")}</td>
      <td>${escapeHtml(search.platform || "Any")}</td>
    </tr>
  `;
}

function eventRow(event) {
  return `<p><strong>${escapeHtml(event.event_type)}</strong><br><span class="muted small">${escapeHtml(event.message || "")}</span></p>`;
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
    const key = job.platform || "Manual";
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
  document.querySelectorAll("[data-edit-job]").forEach((button) => {
    button.addEventListener("click", () => {
      const job = state.jobs.find((item) => item.id === button.dataset.editJob);
      openJobDialog(job);
    });
  });
}

function openJobDialog(job = null) {
  if (!job) return;
  els.jobDialogTitle.textContent = "Review opportunity";
  document.getElementById("job-id").value = job?.id || "";
  document.getElementById("job-title").value = job?.title || "";
  document.getElementById("job-company").value = job?.company || "";
  document.getElementById("job-platform").value = job?.platform || "";
  document.getElementById("job-status").value = job?.status || "Saved";
  document.getElementById("job-location").value = job?.location || "";
  document.getElementById("job-score").value = job?.match_score ?? "";
  document.getElementById("job-url").value = job?.url || "";
  document.getElementById("job-notes").value = job?.notes || "";
  els.jobDialog.showModal();
}

async function startSearchRun() {
  if (!state.searches.length) {
    state.view = "searches";
    setView("searches");
    return;
  }
  state.runActive = true;
  await logEvent("search_started", `Prepared ${state.searches.length} search setup(s) for JobPilot desktop automation.`);
  await loadData();
  render();
}

async function stopSearchRun() {
  if (!state.runActive) return;
  state.runActive = false;
  await logEvent("search_stopped", "Stop requested for the current JobPilot workflow.");
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

async function saveJob(event) {
  event.preventDefault();
  const id = document.getElementById("job-id").value;
  const payload = {
    user_id: state.user.id,
    title: document.getElementById("job-title").value.trim(),
    company: document.getElementById("job-company").value.trim(),
    platform: document.getElementById("job-platform").value.trim() || "Manual",
    status: document.getElementById("job-status").value,
    location: document.getElementById("job-location").value.trim(),
    match_score: parseNullableInt(document.getElementById("job-score").value),
    url: document.getElementById("job-url").value.trim(),
    notes: document.getElementById("job-notes").value.trim()
  };

  const result = id
    ? await supabaseClient.from("jobs").update(payload).eq("id", id)
    : await supabaseClient.from("jobs").insert(payload);
  if (result.error) {
    alert(result.error.message);
    return;
  }

  await logEvent(id ? "job_updated" : "job_created", `${payload.title} at ${payload.company}`);
  els.jobDialog.close();
  await loadData();
  render();
}

async function saveSearch(event) {
  event.preventDefault();
  const payload = {
    user_id: state.user.id,
    name: document.getElementById("search-name").value.trim(),
    platform: document.getElementById("search-platform").value.trim(),
    keywords: document.getElementById("search-keywords").value.trim(),
    location: document.getElementById("search-location").value.trim(),
    frequency: "manual"
  };
  const { error } = await supabaseClient.from("saved_searches").insert(payload);
  if (error) {
    alert(error.message);
    return;
  }
  await logEvent("search_created", payload.name);
  await loadData();
  renderSearches();
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
  await logEvent("profile_updated", "Profile information updated");
  renderProfile();
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
