"use strict";

if (isTrustedJobPilotPage()) {
  document.addEventListener("jobpilot-sync-candidate", syncCandidateSetup);
  syncCandidateSetup();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "jobpilot:fill") {
    fillApplication(Boolean(message.submit)).then(sendResponse);
    return true;
  }
  if (message?.type === "jobpilot:capture-linkedin") {
    sendResponse(captureLinkedInJobs());
    return false;
  }
  return false;
});

function captureLinkedInJobs() {
  if (!/(^|\.)linkedin\.com$/i.test(location.hostname) || !location.pathname.startsWith("/jobs")) {
    return { jobs: [], message: "Open a LinkedIn Jobs search-results page first." };
  }
  const cards = uniqueElements([
    ...document.querySelectorAll("li[data-occludable-job-id]"),
    ...document.querySelectorAll("[data-job-id]"),
    ...document.querySelectorAll(".jobs-search-results__list-item"),
    ...document.querySelectorAll(".job-card-container")
  ]);
  const jobs = cards.map(linkedInJobFromCard).filter(Boolean);
  const deduplicated = jobs.filter((job, index, list) =>
    list.findIndex((candidate) => candidate.source_key === job.source_key) === index
  );
  return {
    jobs: deduplicated.slice(0, 50),
    message: deduplicated.length
      ? `Captured ${deduplicated.length} visible LinkedIn jobs.`
      : "No visible LinkedIn jobs were found. Scroll the results list, then retry."
  };
}

function linkedInJobFromCard(card) {
  const link = card.querySelector("a[href*='/jobs/view/']");
  if (!link) return null;
  const url = new URL(link.href, location.origin);
  const id = card.getAttribute("data-occludable-job-id")
    || card.getAttribute("data-job-id")
    || url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (!id) return null;
  url.search = "";
  url.hash = "";
  const title = textOf(card, [
    ".job-card-list__title",
    ".job-card-container__link",
    ".artdeco-entity-lockup__title",
    "a[href*='/jobs/view/'] strong",
    "a[href*='/jobs/view/']"
  ]);
  if (!title) return null;
  return {
    title,
    company: textOf(card, [
      ".artdeco-entity-lockup__subtitle",
      ".job-card-container__primary-description",
      ".job-card-container__company-name"
    ]),
    location: textOf(card, [
      ".job-card-container__metadata-item",
      ".artdeco-entity-lockup__caption"
    ]),
    platform: "LinkedIn",
    url: url.href,
    description: textOf(card, [".job-card-container__footer-wrapper", ".job-card-list__insight"]),
    source_key: `linkedin:${id}`
  };
}

function textOf(root, selectors) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return "";
}

function uniqueElements(elements) {
  return [...new Set(elements)];
}

async function fillApplication(shouldSubmit) {
  const { candidateSetup } = await chrome.storage.local.get("candidateSetup");
  if (!candidateSetup?.candidate) {
    return { message: "No candidate setup is synced." };
  }

  const fields = [...document.querySelectorAll("input, textarea, select")]
    .filter(isFillable);
  let filled = 0;
  const unresolved = [];
  const blockers = detectBlockers();

  for (const field of fields) {
    const question = fieldQuestion(field);
    const answer = resolveAnswer(question, field, candidateSetup);
    if (answer === null || answer === "") {
      if (field.required && !field.value) unresolved.push(question || field.name || "Required field");
      continue;
    }
    if (applyAnswer(field, answer)) filled += 1;
  }

  let submitted = false;
  if (shouldSubmit && !blockers.length && !unresolved.length) {
    const submit = findSubmitButton();
    if (submit) {
      submit.click();
      submitted = true;
    } else {
      blockers.push("No unambiguous submit button was found");
    }
  }

  const parts = [`Filled ${filled} field${filled === 1 ? "" : "s"}.`];
  if (unresolved.length) parts.push(`Needs answers: ${unique(unresolved).slice(0, 8).join("; ")}.`);
  if (blockers.length) parts.push(`Candidate action: ${unique(blockers).join("; ")}.`);
  if (submitted) parts.push("Submission button clicked after your explicit approval.");
  else if (shouldSubmit) parts.push("Not submitted.");
  else parts.push("Review the answers before submitting.");
  return { filled, unresolved, blockers, submitted, message: parts.join("\n") };
}

function isFillable(field) {
  if (field.disabled || field.readOnly || field.closest("[hidden]")) return false;
  const type = String(field.type || "").toLowerCase();
  return !["hidden", "password", "submit", "button", "reset", "image", "file"].includes(type);
}

function fieldQuestion(field) {
  const labels = field.labels ? [...field.labels].map((label) => label.innerText) : [];
  const labelledBy = String(field.getAttribute("aria-labelledby") || "")
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.innerText || "");
  const nearby = field.closest("label, fieldset, [role='group'], .form-group, .field, .fb-dash-form-element, .jobs-easy-apply-form-section__grouping")?.innerText || "";
  return [
    ...labels,
    ...labelledBy,
    field.getAttribute("aria-label"),
    field.placeholder,
    field.name,
    nearby.slice(0, 300)
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function resolveAnswer(question, field, setup) {
  const q = question.toLowerCase();
  const c = setup.candidate || {};
  const a = setup.answers || {};
  const rules = [
    [/first.?name/, firstName(c.full_name)],
    [/last.?name|surname|family.?name/, lastName(c.full_name)],
    [/full.?name|candidate.?name|your.?name/, c.full_name],
    [/e-?mail/, c.email],
    [/phone|mobile|telephone/, a.phone],
    [/linkedin/, c.linkedin_url],
    [/portfolio|website|personal.?site/, c.portfolio_url],
    [/current.?location|city|country|location/, c.location],
    [/desired.?role|target.?title|position.?seeking/, c.target_title],
    [/work.?authori[sz]ation|authorized to work/, a.work_authorization],
    [/sponsor|visa/, a.sponsorship_required],
    [/notice|available.?to.?start|start.?date/, a.notice_period],
    [/salary|compensation|expected.?pay/, a.salary_expectation],
    [/years?.*(experience)|experience.*years?/, a.years_experience],
    [/completed.*(education|degree)|level of education|education requirement/, educationAnswer(q, a.education_level, c.resume_summary)],
    [/commut(e|ing)|travel to.*(job|work|office)/, a.willing_to_commute],
    [/relocat(e|ion)/, a.willing_to_relocate],
    [/remote|hybrid|on.?site/, a.remote_preference],
    [/cover.?letter|why.*(role|company|join|interested)|additional.?information|summary/, a.general_note || excerpt(c.resume_summary)]
  ];
  for (const [pattern, value] of rules) {
    if (pattern.test(q) && value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  if (field.tagName === "SELECT" && /yes|no|agree|consent|terms|privacy/.test(q)) return null;
  return null;
}

function applyAnswer(field, answer) {
  const tag = field.tagName;
  const type = String(field.type || "").toLowerCase();
  if (type === "checkbox") return false;
  if (type === "radio") {
    const optionText = normalize([
      ...(field.labels ? [...field.labels].map((label) => label.innerText) : []),
      field.value,
      field.getAttribute("aria-label")
    ].filter(Boolean).join(" "));
    if (!optionText.includes(normalize(answer))) return false;
    field.click();
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return field.checked;
  }
  if (tag === "SELECT") {
    const option = [...field.options].find((item) => normalize(item.textContent).includes(normalize(answer)));
    if (!option) return false;
    field.value = option.value;
  } else {
    setNativeValue(field, answer);
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setNativeValue(field, value) {
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
}

function detectBlockers() {
  const text = document.body.innerText.toLowerCase();
  const blockers = [];
  if (document.querySelector("iframe[src*='captcha'], .g-recaptcha, [data-sitekey]") || /captcha/.test(text)) blockers.push("CAPTCHA");
  if (/assessment|coding test|personality test|video interview/.test(text)) blockers.push("Assessment");
  if (document.querySelector("input[type='file']")) blockers.push("CV/file upload must be confirmed manually");
  if (/consent|terms and conditions|privacy policy|certify that/.test(text)) blockers.push("Consent or declaration requires review");
  return blockers;
}

function findSubmitButton() {
  const candidates = [...document.querySelectorAll("button, input[type='submit']")]
    .filter((item) => !item.disabled && item.offsetParent !== null)
    .filter((item) => /submit|send application|apply now|complete application/i.test(item.innerText || item.value || ""));
  return candidates.length === 1 ? candidates[0] : null;
}

function firstName(name = "") {
  return name.trim().split(/\s+/)[0] || "";
}

function lastName(name = "") {
  return name.trim().split(/\s+/).slice(1).join(" ");
}

function excerpt(value = "") {
  return value.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function syncCandidateSetup() {
  const bridge = document.getElementById("jobpilot-extension-payload");
  const raw = bridge?.textContent || localStorage.getItem("jobpilot-candidate-setup");
  if (!raw) return;
  try {
    const candidateSetup = JSON.parse(raw);
    await chrome.storage.local.set({ candidateSetup });
    document.dispatchEvent(new CustomEvent("jobpilot-sync-complete"));
  } catch {
    // Invalid bridge data is ignored rather than stored.
  }
}

async function exposePendingLinkedInJobs() {
  if (!isTrustedJobPilotPage()) return;
  const { pendingLinkedInJobs } = await chrome.storage.local.get("pendingLinkedInJobs");
  if (!pendingLinkedInJobs?.jobs?.length) return;
  let bridge = document.getElementById("jobpilot-linkedin-import-payload");
  if (!bridge) {
    bridge = document.createElement("script");
    bridge.id = "jobpilot-linkedin-import-payload";
    bridge.type = "application/json";
    document.documentElement.appendChild(bridge);
  }
  bridge.textContent = JSON.stringify(pendingLinkedInJobs);
  document.dispatchEvent(new CustomEvent("jobpilot-linkedin-import"));
}

if (isTrustedJobPilotPage()) {
  exposePendingLinkedInJobs();
  document.addEventListener("jobpilot-linkedin-import-request", exposePendingLinkedInJobs);
  document.addEventListener("jobpilot-linkedin-import-complete", async () => {
    await chrome.storage.local.remove("pendingLinkedInJobs");
    document.getElementById("jobpilot-linkedin-import-payload")?.remove();
  });
}

function educationAnswer(question, selectedLevel = "", resume = "") {
  const levels = [
    ["high school", 1],
    ["associate", 2],
    ["bachelor", 3],
    ["master", 4],
    ["doctorate", 5],
    ["doctoral", 5],
    ["phd", 5]
  ];
  const required = levels.find(([label]) => question.includes(label))?.[1];
  const candidateText = `${selectedLevel} ${resume}`.toLowerCase();
  const achieved = levels.reduce((highest, [label, rank]) => candidateText.includes(label) ? Math.max(highest, rank) : highest, 0);
  return required && achieved ? (achieved >= required ? "Yes" : "No") : null;
}

function isTrustedJobPilotPage() {
  return (
    location.hostname === "devastator007.github.io"
    && location.pathname.toLowerCase().startsWith("/scaleup-jobpilot/")
  ) || (
    location.hostname === "scaleuptech.org"
    && location.pathname.toLowerCase().startsWith("/app/jobpilot")
  );
}
