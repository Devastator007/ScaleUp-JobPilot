(() => {
  const cfg = window.SCALEUP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) return;

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const googleEnabled = cfg.GOOGLE_AUTH_ENABLED !== false;

  document.addEventListener("DOMContentLoaded", () => {
    mountGoogleSignIn();
    observeAccountView();
  });

  function redirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function mountGoogleSignIn() {
    const form = document.getElementById("auth-form");
    if (!form || document.getElementById("google-auth-btn")) return;

    const divider = document.createElement("div");
    divider.className = "auth-divider";
    divider.setAttribute("aria-hidden", "true");
    divider.innerHTML = "<span>or</span>";

    const button = document.createElement("button");
    button.id = "google-auth-btn";
    button.type = "button";
    button.className = "button secondary account-provider-button";
    button.textContent = "Continue with Google";
    button.disabled = !googleEnabled;
    button.addEventListener("click", signInWithGoogle);

    const note = document.createElement("p");
    note.className = "muted small provider-note";
    note.textContent = googleEnabled
      ? "Use an existing Google account without creating another password."
      : "Google sign-in is being configured.";

    form.append(divider, button, note);
  }

  async function signInWithGoogle() {
    const message = document.getElementById("auth-message");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl(),
        queryParams: { access_type: "offline", prompt: "consent" }
      }
    });
    if (error && message) message.textContent = error.message;
  }

  function observeAccountView() {
    const target = document.getElementById("billing-view");
    if (!target) return;
    const observer = new MutationObserver(() => mountConnectedAccounts(target));
    observer.observe(target, { childList: true, subtree: true });
    mountConnectedAccounts(target);
  }

  async function mountConnectedAccounts(target) {
    if (!target || target.querySelector("[data-connected-accounts]")) return;
    const { data } = await client.auth.getUser();
    const user = data?.user;
    if (!user) return;

    const identities = Array.isArray(user.identities) ? user.identities : [];
    const providers = new Set(identities.map((identity) => identity.provider));
    const googleLinked = providers.has("google");
    const emailLinked = providers.has("email") || Boolean(user.email);

    const section = document.createElement("section");
    section.className = "panel connected-accounts-panel";
    section.dataset.connectedAccounts = "true";
    section.innerHTML = `
      <h2>Connected sign-in accounts</h2>
      <p class="muted">Link a trusted sign-in provider so you can access the same JobPilot workspace without creating a separate account.</p>
      <div class="connected-account-row">
        <div><strong>Email</strong><div class="muted small">${escapeHtml(user.email || "Not available")}</div></div>
        <span class="badge ${emailLinked ? "Offer" : "Rejected"}">${emailLinked ? "Connected" : "Not connected"}</span>
      </div>
      <div class="connected-account-row">
        <div><strong>Google</strong><div class="muted small">Secure OAuth sign-in</div></div>
        ${googleLinked
          ? '<span class="badge Offer">Connected</span>'
          : `<button type="button" class="button secondary" data-link-google ${googleEnabled ? "" : "disabled"}>Link Google account</button>`}
      </div>
      <div class="notice-box">
        <strong>Job-board accounts</strong>
        <p>LinkedIn, Indeed, Wuzzuf, Bayt, and similar platforms require approved provider APIs. JobPilot does not collect or store job-board passwords. Applications remain user-reviewed and are opened on the official provider site unless an approved integration is available.</p>
      </div>
      <p class="form-message" data-account-link-message></p>
    `;
    target.append(section);
    section.querySelector("[data-link-google]")?.addEventListener("click", linkGoogleIdentity);
  }

  async function linkGoogleIdentity() {
    const message = document.querySelector("[data-account-link-message]");
    const { error } = await client.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: redirectUrl() }
    });
    if (error && message) message.textContent = error.message;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
