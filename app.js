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
  els.newJobBtn.addEventListener("click", openJobEntry);
}

async function refresh() {
  if (!state.user) {
    showAuth("");
    return;
  }

  showApp();
  await ensureProfile();
  await loadData();
  applyEntitlementState();
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
    plan: "trial",
    license_status: "trial"
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
  state.view = hasActiveAccess() ? view : "billing";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.add("hidden"));
  document.getElementById(`${state.view}-view`).classList.remove("hidden");

  const meta = {
    dashboard: ["Dashboard", "Organize target roles, record opportunities, and manage applications."],
    pipeline: ["Pipeline", "Track applications from discovered to offer."],
    jobs: ["Jobs", "Record opportunities and manage their application status."],
    searches: ["Search Plans", "Save target roles, platforms, locations, and review criteria."],
    profile: ["Candidate Setup", "Upload CV and save the details JobPilot uses to match and apply."],
    billing: ["Account", "Your account access and product setup status."]
  };
  els.viewTitle.textContent = meta[state.view][0];
  els.viewSubtitle.textContent = meta[state.view][1];
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
        <div class="panel-actions">
          <button class="button primary" data-add-job>Add job</button>
        </div>
        <p class="muted small">Use search plans to keep your criteria consistent, then record suitable opportunities and move them through the application pipeline.</p>
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
      <h2>Add a job</h2>
      <form id="job-form" class="form-grid">
        <label>Role title<input id="job-title" required placeholder="Customer Success Manager" /></label>
        <label>Company<input id="job-company" placeholder="Company name" /></label>
        <label>Platform<input id="job-platform" placeholder="LinkedIn, Wuzzuf, referral" /></label>
        <label>Location<input id="job-location" placeholder="Cairo, Remote" /></label>
        <label>Status
          <select id="job-status">
            ${statusOrder.map((status) => `<option value="${status}">${status}</option>`).join("")}
          </select>
        </label>
        <label>CV fit score %<input id="job-score" type="number" min="0" max="100" placeholder="Optional" /></label>
        <label style="grid-column:1/-1">Job URL<input id="job-url" type="url" placeholder="https://…" /></label>
        <label style="grid-column:1/-1">Notes<textarea id="job-notes" rows="4" placeholder="Requirements, contact, next step…"></textarea></label>
        <button class="button primary" type="submit">Save job</button>
        <p id="job-form-result" class="form-message" aria-live="polite"></p>
      </form>
    </section>
    <section class="panel">
      <h2>All jobs</h2>
      ${
        state.jobs.length
          ? `<table class="table">
              <thead><tr><th>Role</th><th>Platform</th><th>Status</th><th>Score</th><th></th></tr></thead>
              <tbody>${state.jobs.map(jobRow).join("")}</tbody>
            </table>`
          : empty("No jobs yet. Add the first opportunity above.")
      }
    </section>
  `;
  document.getElementById("job-form").addEventListener("submit", saveJob);
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
        <tr><th>Access until</th><td>${subscriptionExpiresAt() ? escapeHtml(subscriptionExpiresAt().toLocaleDateString()) : "Not activated"}</td></tr>
      </table>
      ${hasActiveAccess()
        ? `<div class="notice-box"><strong>Setup status</strong><p>${hasResume() ? "CV is ready for matching." : "Upload or paste CV text before running search."} ${state.searches.length ? "Search setup is ready." : "Create at least one search/apply setup."}</p></div>`
        : `<div class="notice-box"><strong>Activation required</strong><p>JobPilot access starts after manual InstaPay or bank-transfer verification. Contact ${escapeHtml(cfg.SUPPORT_EMAIL || "support@scaleuptech.org")} with your transfer reference for approval or renewal.</p></div>`}
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
  document.querySelectorAll("[data-add-job]").forEach((button) => {
    button.addEventListener("click", openJobEntry);
  });
  document.querySelectorAll("[data-edit-search]").forEach((button) => {
    button.addEventListener("click", () => editSearchSetup(button.dataset.editSearch));
  });
  document.querySelectorAll("[data-clear-activity]").forEach((button) => {
    button.addEventListener("click", clearActivity);
  });
}

function openJobEntry() {
  if (!hasActiveAccess()) {
    setView("billing");
    return;
  }
  setView("jobs");
  document.getElementById("job-title")?.focus();
}

function subscriptionExpiresAt() {
  const value = state.subscription?.current_period_end;
  if (!value) return null;
  const expiresAt = new Date(value);
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt;
}

function hasActiveAccess() {
  if (state.subscription) {
    const expiresAt = subscriptionExpiresAt();
    return ["active", "approved"].includes(String(state.subscription.status || "").toLowerCase())
      && expiresAt
      && expiresAt.getTime() > Date.now();
  }
  return ["active", "approved"].includes(String(state.profile?.license_status || "").toLowerCase());
}

function displayPlan() {
  return state.subscription?.plan || state.profile?.plan || "trial";
}

function displayStatus() {
  if (state.subscription && subscriptionExpiresAt()?.getTime() <= Date.now()) return "expired";
  return state.subscription?.status || state.profile?.license_status || "trial";
}

function applyEntitlementState() {
  const active = hasActiveAccess();
  els.newJobBtn.classList.toggle("hidden", !active);
  document.querySelectorAll(".nav-item").forEach((button) => {
    const disabled = !active && button.dataset.view !== "billing";
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
  });
  if (!active) state.view = "billing";
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

async function saveJob(event) {
  event.preventDefault();
  const result = document.getElementById("job-form-result");
  result.textContent = "";
  const payload = {
    user_id: state.user.id,
    title: document.getElementById("job-title").value.trim(),
    company: document.getElementById("job-company").value.trim(),
    platform: document.getElementById("job-platform").value.trim() || "Manual",
    status: document.getElementById("job-status").value,
    location: document.getElementById("job-location").value.trim(),
    url: document.getElementById("job-url").value.trim(),
    notes: document.getElementById("job-notes").value.trim(),
    match_score: parseNullableInt(document.getElementById("job-score").value)
  };
  const { error } = await supabaseClient.from("jobs").insert(payload);
  if (error) {
    result.textContent = error.message;
    return;
  }
  await logEvent("job_added", `Added ${payload.title} at ${payload.company || "an unspecified company"}.`);
  await loadData();
  render();
  document.getElementById("job-form-result").textContent = "Job saved.";
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
    ["Jobs", state.jobs.length > 0, "Add an opportunity"]
  ];
  return `<section class="panel readiness-panel"><h2>Setup checklist</h2><div class="checklist">${steps.map(([label, done, text]) => `<div class="check-item ${done ? "done" : ""}"><strong>${label}</strong><span>${text}</span></div>`).join("")}</div></section>`;
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
