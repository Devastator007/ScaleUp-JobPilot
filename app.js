const cfg = window.SCALEUP_CONFIG || {};
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
const supabaseClient = isConfigured
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

const statusOrder = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"];
let autoSearchTimer = null;
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
  resendConfirmationBtn: document.getElementById("resend-confirmation-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
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
  els.resendConfirmationBtn.addEventListener("click", resendConfirmation);
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
  els.signOutBtn.addEventListener("click", signOut);
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
  scheduleAutoSearch();
}

function showAuth(message) {
  els.authView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  els.signOutBtn.classList.add("hidden");
  els.authMessage.textContent = message || "";
}

function showApp() {
  els.authView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.signOutBtn.classList.remove("hidden");
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
  showAuthMessage(
    "If this address needs confirmation, an email has been requested. Already registered? Sign in or reset your password.",
    "success"
  );
}

async function resendConfirmation() {
  clearAuthMessage();
  const email = els.authEmail.value.trim();
  if (!email) {
    showAuthMessage("Enter your email address first.", "error");
    els.authEmail.focus();
    return;
  }
  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  showAuthMessage(
    error
      ? error.message
      : "If this address has an unconfirmed account, a confirmation email has been requested. Check your inbox and spam folder.",
    error ? "error" : "success"
  );
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
  applyPasswordConstraints(mode);
  els.authSubmitBtn.textContent =
    mode === "signup" ? "Create account" :
    mode === "reset" ? "Send reset email" :
    mode === "recovery" ? "Update password" :
    "Sign in";
  els.signupBtn.textContent = mode === "signup" ? "I already have an account" : "Create account";
  els.forgotPasswordBtn.classList.toggle("hidden", mode === "reset" || mode === "recovery");
  els.resendConfirmationBtn.classList.toggle("hidden", mode === "reset" || mode === "recovery");
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

function applyPasswordConstraints(mode) {
  const requiresNewPassword = mode === "signup" || mode === "recovery";
  [els.authPassword, els.authConfirmPassword].forEach((input) => {
    if (requiresNewPassword) {
      input.setAttribute("minlength", "12");
      input.setAttribute("maxlength", "128");
    } else {
      input.removeAttribute("minlength");
      input.removeAttribute("maxlength");
    }
  });
}

function passwordPolicyError(password) {
  const value = String(password ?? "");
  if (value.length < 12 || value.length > 128) {
    return "Password must be 12 to 128 characters.";
  }
  if (!/\p{L}/u.test(value) || !/\p{N}/u.test(value)) {
    return "Password must include at least one letter and one number.";
  }
  return "";
}

function passwordsMatch() {
  const policyError = passwordPolicyError(els.authPassword.value);
  if (policyError) {
    showAuthMessage(policyError, "error");
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
    jobs: ["Jobs", "Review discovered opportunities and manage their application status."],
    searches: ["Find Jobs", "Run discovery using the criteria saved once in Candidate Setup."],
    profile: ["Candidate Setup", "Save your CV, job criteria, platforms, and reusable application answers."],
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
          <tr><td>Search setup</td><td>${candidateSetupReady() ? "Ready" : "Incomplete"}</td></tr>
          <tr><td>Average CV fit score</td><td>${avgScore ? `${avgScore}%` : "No scores yet"}</td></tr>
          <tr><td>Best platform</td><td>${bestPlatform()}</td></tr>
        </table>
        <p class="muted small">Keep one Candidate Setup, run Find Jobs, then review outside-portal actions in the Jobs tab.</p>
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
  const scraped = state.jobs.filter((job) => job.source_key).length;
  const candidateActions = state.jobs.filter((job) => job.action_status === "candidate_action_required").length;
  document.getElementById("pipeline-view").innerHTML = `
    <div class="metrics-grid">
      ${metric("Jobs scraped", scraped)}
      ${metric("Candidate action", candidateActions)}
      ${metric("Applications submitted", countByStatus("Applied"))}
    </div>
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
      <h2>Discovered jobs</h2>
      ${
        state.jobs.length
          ? `<table class="table">
              <thead><tr><th>Role</th><th>Platform</th><th>Status</th><th>Next action</th><th>Score</th><th></th></tr></thead>
              <tbody>${state.jobs.map(jobRow).join("")}</tbody>
            </table>`
          : empty("No jobs found yet. Complete Candidate Setup, then use Find Jobs.")
      }
    </section>
  `;
}

function renderSearches() {
  const p = state.profile || {};
  const prefs = profilePreferences();
  const outsideCount = state.jobs.filter((job) => job.action_status === "candidate_action_required").length;
  document.getElementById("searches-view").innerHTML = `
    <section class="panel">
      <h2>Find jobs for ${escapeHtml(p.target_title || "your target role")}</h2>
      <p class="muted">Location: ${escapeHtml(p.location || "Not set")} · Platforms: ${escapeHtml((prefs.platforms || []).join(", ") || "Not set")}</p>
      <p>JobPilot searches supported public feeds, removes duplicate source jobs, and prepares reusable answers from Candidate Setup. A third-party application page is always marked <strong>Candidate action required</strong>; JobPilot does not claim submission on an outside portal.</p>
      <div class="panel-actions">
        <button class="button primary" type="button" id="start-search-btn" ${candidateSetupReady() ? "" : "disabled"}>Start search</button>
        <button class="button secondary" type="button" data-view-profile>Update Candidate Setup</button>
      </div>
      <p id="search-run-result" class="form-message" role="status" aria-live="polite"></p>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Search result workflow</h2>
      <div class="metrics-grid">
        ${metric("Discovered jobs", state.jobs.length)}
        ${metric("Candidate action", outsideCount)}
      </div>
      <p class="muted small">LinkedIn, Indeed, Wuzzuf, and Bayt remain outside portals unless an approved direct integration is available. Remotive and Arbeitnow are searchable public feeds.</p>
    </section>
  `;
  document.getElementById("start-search-btn")?.addEventListener("click", startSearch);
  document.querySelector("[data-view-profile]")?.addEventListener("click", () => setView("profile"));
}

function renderProfile() {
  const p = state.profile || {};
  const prefs = profilePreferences();
  const answers = p.application_answers || {};
  const platforms = ["LinkedIn", "Indeed", "Wuzzuf", "Bayt", "Remotive", "Arbeitnow"];
  document.getElementById("profile-view").innerHTML = `
    <section class="panel">
      <h2>Candidate profile, search and apply setup</h2>
      <form id="profile-form" class="form-grid">
        <label>Full name<input id="profile-name" value="${escapeAttr(p.full_name || "")}" /></label>
        <label>Email<input id="profile-email" value="${escapeAttr(p.email || state.user.email || "")}" /></label>
        <label>Target title<input id="profile-title" value="${escapeAttr(p.target_title || "")}" /></label>
        <label>Location<input id="profile-location" value="${escapeAttr(p.location || "")}" /></label>
        <label>LinkedIn URL<input id="profile-linkedin" value="${escapeAttr(p.linkedin_url || "")}" /></label>
        <label>Portfolio URL<input id="profile-portfolio" value="${escapeAttr(p.portfolio_url || "")}" /></label>
        <fieldset class="platform-fieldset" style="grid-column:1/-1">
          <legend>Platforms to search</legend>
          <div class="platform-options">
            ${platforms.map((platform) => `<label><input type="checkbox" name="profile-platform" value="${platform}" ${(prefs.platforms || []).includes(platform) ? "checked" : ""} /> ${platform}</label>`).join("")}
          </div>
          <p class="muted small">Remotive and Arbeitnow provide searchable public feeds. Other platforms open as outside-portal candidate actions.</p>
        </fieldset>
        <label>Must-have keywords<input id="profile-keywords" value="${escapeAttr(prefs.must_have_keywords || "")}" placeholder="SaaS, customer success" /></label>
        <label>Exclude keywords<input id="profile-exclusions" value="${escapeAttr(prefs.exclude_keywords || "")}" placeholder="internship, unpaid" /></label>
        <label>Minimum match %<input id="profile-min-score" type="number" min="0" max="100" value="${Number(prefs.minimum_match_score) || 70}" /></label>
        <label>Jobs per search<input id="profile-daily-limit" type="number" min="1" max="30" value="${Number(prefs.daily_apply_limit) || 10}" /></label>
        <label>Automatic search
          <select id="profile-auto-search-interval">
            ${[
              ["0", "Off"],
              ["1", "Every hour"],
              ["3", "Every 3 hours"],
              ["6", "Every 6 hours"],
              ["12", "Every 12 hours"],
              ["24", "Every 24 hours"]
            ].map(([value, label]) => `<option value="${value}" ${String(prefs.auto_search_interval_hours || 0) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label style="grid-column:1/-1">Application mode
          <select id="profile-application-mode">
            <option value="review" ${prefs.application_mode === "review" ? "selected" : ""}>Review every match first</option>
            <option value="auto_apply" ${["auto_apply", "auto_prepare"].includes(prefs.application_mode) ? "selected" : ""}>Auto apply where supported; prepare answers for outside portals</option>
          </select>
          <span class="muted small">Auto apply never bypasses an outside portal or claims submission without confirmation.</span>
        </label>
        <h3 style="grid-column:1/-1">Reusable application answers</h3>
        <label>Work authorization<input id="answer-authorization" value="${escapeAttr(answers.work_authorization || "")}" placeholder="Authorized to work in…" /></label>
        <label>Sponsorship required?<select id="answer-sponsorship"><option value="">Choose</option><option value="No" ${answers.sponsorship_required === "No" ? "selected" : ""}>No</option><option value="Yes" ${answers.sponsorship_required === "Yes" ? "selected" : ""}>Yes</option></select></label>
        <label>Notice period<input id="answer-notice" value="${escapeAttr(answers.notice_period || "")}" placeholder="30 days" /></label>
        <label>Salary expectation<input id="answer-salary" value="${escapeAttr(answers.salary_expectation || "")}" placeholder="Optional" /></label>
        <label>Phone number<input id="answer-phone" value="${escapeAttr(answers.phone || "")}" autocomplete="tel" placeholder="+20…" /></label>
        <label>Years of relevant experience<input id="answer-experience" type="number" min="0" max="60" value="${escapeAttr(answers.years_experience || "")}" /></label>
        <label>Remote preference<input id="answer-remote" value="${escapeAttr(answers.remote_preference || "")}" placeholder="Remote / Hybrid / On-site" /></label>
        <label style="grid-column:1/-1">General application note<textarea id="answer-note" rows="4" placeholder="Reusable facts JobPilot may use when preparing answers.">${escapeHtml(answers.general_note || "")}</textarea></label>
        <label style="grid-column:1/-1">Upload CV or resume<input id="profile-cv-file" type="file" accept=".txt,.md,.pdf,.doc,.docx" /></label>
        <label style="grid-column:1/-1">CV text used for matching<textarea id="profile-summary" rows="8" placeholder="Paste the CV text here, or upload a TXT/MD resume so JobPilot can read it for matching.">${escapeHtml(p.resume_summary || "")}</textarea></label>
        <div class="notice-box" style="grid-column:1/-1">
          <strong>Why CV text is required</strong>
          <p>JobPilot compares job requirements with the candidate CV before preparing applications. PDF/DOCX upload is accepted for record keeping, but paste or upload text for best matching accuracy.</p>
        </div>
        <div class="form-actions" style="grid-column:1/-1">
          <button class="button primary" type="submit">Save candidate setup</button>
          <button class="button secondary" type="button" id="sync-browser-assistant">Sync with Browser Assistant</button>
          <a class="button ghost" href="./jobpilot-browser-assistant.zip" download>Download browser assistant</a>
        </div>
        <p id="browser-assistant-message" class="form-message" role="status" aria-live="polite"></p>
      </form>
    </section>
  `;
  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("profile-cv-file").addEventListener("change", handleCvUpload);
  document.getElementById("sync-browser-assistant").addEventListener("click", syncBrowserAssistant);
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
    <section class="panel" style="margin-top:16px">
      <h2>Account security</h2>
      <form id="account-password-form" class="form-grid">
        <label>New password
          <div class="password-field">
            <input id="account-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
            <button class="password-toggle" type="button" data-password-toggle="account-new-password" aria-controls="account-new-password" aria-label="Show new password" aria-pressed="false">Show</button>
          </div>
        </label>
        <label>Confirm new password
          <div class="password-field">
            <input id="account-confirm-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
            <button class="password-toggle" type="button" data-password-toggle="account-confirm-password" aria-controls="account-confirm-password" aria-label="Show confirmed password" aria-pressed="false">Show</button>
          </div>
        </label>
        <button class="button primary" type="submit" id="account-password-submit">Change password</button>
        <p id="account-password-message" class="form-message" aria-live="polite"></p>
      </form>
      <p class="muted small">Use 12–128 characters with at least one letter and one number. Existing sign-in passwords remain valid until you complete this change.</p>
    </section>
  `;
}

async function changeAccountPassword(event) {
  event.preventDefault();
  const password = document.getElementById("account-new-password");
  const confirmation = document.getElementById("account-confirm-password");
  const submit = document.getElementById("account-password-submit");
  const message = document.getElementById("account-password-message");
  const policyError = passwordPolicyError(password.value);
  message.classList.remove("success");
  if (policyError) {
    message.textContent = policyError;
    return;
  }
  if (password.value !== confirmation.value) {
    message.textContent = "Passwords do not match.";
    return;
  }

  submit.disabled = true;
  const { error } = await supabaseClient.auth.updateUser({ password: password.value });
  submit.disabled = false;
  if (error) {
    message.textContent = error.message;
    return;
  }

  password.value = "";
  confirmation.value = "";
  document.querySelectorAll("#account-password-form [data-password-toggle]").forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (input) input.type = "password";
    button.textContent = "Show";
    button.setAttribute("aria-pressed", "false");
  });
  message.textContent = "Password changed successfully.";
  message.classList.add("success");
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
      <td><span class="badge action-${escapeAttr(job.action_status || "review")}">${escapeHtml(titleCase(job.action_status || "review"))}</span></td>
      <td>${job.match_score ?? "-"}</td>
      <td>${job.url ? `<a class="button ghost" href="${escapeAttr(job.url)}" target="_blank" rel="noopener noreferrer">Open outside portal</a>` : ""}</td>
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
  document.querySelectorAll("[data-edit-search]").forEach((button) => {
    button.addEventListener("click", () => editSearchSetup(button.dataset.editSearch));
  });
  document.querySelectorAll("[data-clear-activity]").forEach((button) => {
    button.addEventListener("click", clearActivity);
  });
  const accountPasswordForm = document.getElementById("account-password-form");
  if (accountPasswordForm) accountPasswordForm.addEventListener("submit", changeAccountPassword);
  document.querySelectorAll("#account-password-form [data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
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
    resume_summary: document.getElementById("profile-summary").value.trim(),
    job_preferences: {
      platforms: [...document.querySelectorAll('input[name="profile-platform"]:checked')].map((input) => input.value),
      must_have_keywords: document.getElementById("profile-keywords").value.trim(),
      exclude_keywords: document.getElementById("profile-exclusions").value.trim(),
      minimum_match_score: Number(document.getElementById("profile-min-score").value) || 70,
      daily_apply_limit: Number(document.getElementById("profile-daily-limit").value) || 10,
      application_mode: document.getElementById("profile-application-mode").value,
      auto_search_interval_hours: Number(document.getElementById("profile-auto-search-interval").value) || 0,
      last_search_at: state.profile?.job_preferences?.last_search_at || null
    },
    application_answers: {
      work_authorization: document.getElementById("answer-authorization").value.trim(),
      sponsorship_required: document.getElementById("answer-sponsorship").value,
      notice_period: document.getElementById("answer-notice").value.trim(),
      salary_expectation: document.getElementById("answer-salary").value.trim(),
      phone: document.getElementById("answer-phone").value.trim(),
      years_experience: document.getElementById("answer-experience").value.trim(),
      remote_preference: document.getElementById("answer-remote").value.trim(),
      general_note: document.getElementById("answer-note").value.trim()
    }
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
  scheduleAutoSearch();
}

function syncBrowserAssistant() {
  const message = document.getElementById("browser-assistant-message");
  const payload = {
    version: 1,
    synced_at: new Date().toISOString(),
    candidate: {
      full_name: state.profile?.full_name || "",
      email: state.profile?.email || state.user?.email || "",
      target_title: state.profile?.target_title || "",
      location: state.profile?.location || "",
      linkedin_url: state.profile?.linkedin_url || "",
      portfolio_url: state.profile?.portfolio_url || "",
      resume_summary: state.profile?.resume_summary || ""
    },
    answers: state.profile?.application_answers || {}
  };
  let bridge = document.getElementById("jobpilot-extension-payload");
  if (!bridge) {
    bridge = document.createElement("script");
    bridge.id = "jobpilot-extension-payload";
    bridge.type = "application/json";
    document.body.appendChild(bridge);
  }
  bridge.textContent = JSON.stringify(payload).replaceAll("<", "\\u003c");
  document.dispatchEvent(new CustomEvent("jobpilot-sync-candidate"));
  message.textContent = "Candidate setup sent to the JobPilot Browser Assistant. If the extension is not installed, download and load it first.";
  message.classList.add("success");
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
    ["Setup", candidateSetupReady(), "Add target role, location, and platforms"],
    ["Jobs", state.jobs.length > 0, "Run Find Jobs"]
  ];
  return `<section class="panel readiness-panel"><h2>Setup checklist</h2><div class="checklist">${steps.map(([label, done, text]) => `<div class="check-item ${done ? "done" : ""}"><strong>${label}</strong><span>${text}</span></div>`).join("")}</div></section>`;
}

function profilePreferences() {
  return state.profile?.job_preferences || {
    platforms: [],
    must_have_keywords: "",
    exclude_keywords: "",
    minimum_match_score: 70,
    daily_apply_limit: 10,
    application_mode: "review",
    auto_search_interval_hours: 0,
    last_search_at: null
  };
}

function candidateSetupReady() {
  const prefs = profilePreferences();
  return Boolean(
    state.profile?.target_title?.trim()
    && state.profile?.location?.trim()
    && hasResume()
    && Array.isArray(prefs.platforms)
    && prefs.platforms.length
  );
}

async function startSearch(options = {}) {
  const automatic = options.automatic === true;
  const button = document.getElementById("start-search-btn");
  const result = document.getElementById("search-run-result");
  if (button) button.disabled = true;
  if (result) {
    result.textContent = automatic
      ? "Running scheduled search…"
      : "Searching supported job feeds and removing duplicates…";
    result.classList.remove("success");
  }
  const { data, error } = await supabaseClient.functions.invoke("search-jobs", { body: {} });
  if (error) {
    if (result) result.textContent = error.message;
    if (button) button.disabled = false;
    scheduleAutoSearch();
    return;
  }
  const searchedAt = new Date().toISOString();
  const jobPreferences = { ...profilePreferences(), last_search_at: searchedAt };
  const { data: updatedProfile } = await supabaseClient
    .from("profiles")
    .update({ job_preferences: jobPreferences })
    .eq("id", state.user.id)
    .select("*")
    .single();
  if (updatedProfile) state.profile = updatedProfile;
  await logEvent("job_search_run", `Search found ${data.found || 0} jobs and added ${data.added || 0} new opportunities.`);
  await loadData();
  render();
  const next = document.getElementById("search-run-result");
  if (next) {
    next.textContent = `${data.message} Found ${data.found || 0}; added ${data.added || 0} new jobs.`;
    next.classList.add("success");
  }
  scheduleAutoSearch();
}

function scheduleAutoSearch() {
  if (autoSearchTimer) window.clearTimeout(autoSearchTimer);
  autoSearchTimer = null;
  if (!state.user || !hasActiveAccess() || !candidateSetupReady()) return;
  const prefs = profilePreferences();
  const hours = Number(prefs.auto_search_interval_hours) || 0;
  if (!hours) return;
  const intervalMs = hours * 60 * 60 * 1000;
  const lastRun = Date.parse(prefs.last_search_at || "") || 0;
  const delay = Math.max(1000, lastRun + intervalMs - Date.now());
  autoSearchTimer = window.setTimeout(() => startSearch({ automatic: true }), delay);
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
