"use strict";

const status = document.getElementById("sync-status");
const result = document.getElementById("result");
const fillButton = document.getElementById("fill");
const captureLinkedInButton = document.getElementById("capture-linkedin");
const modeInputs = [...document.querySelectorAll("input[name='application-mode']")];

chrome.storage.local.get(["candidateSetup", "applicationMode"], ({ candidateSetup, applicationMode }) => {
  const ready = Boolean(candidateSetup?.candidate?.resume_summary);
  status.textContent = ready
    ? `Synced ${new Date(candidateSetup.synced_at).toLocaleString()}`
    : "Open Candidate Setup in JobPilot and click “Sync with Browser Assistant” first.";
  fillButton.disabled = !ready;
  const savedMode = applicationMode === "auto" ? "auto" : "review";
  const savedInput = modeInputs.find((input) => input.value === savedMode);
  if (savedInput) savedInput.checked = true;
});

for (const input of modeInputs) {
  input.addEventListener("change", async () => {
    if (input.checked) await chrome.storage.local.set({ applicationMode: input.value });
  });
}

fillButton.addEventListener("click", fillVisibleQuestions);
captureLinkedInButton.addEventListener("click", captureLinkedInJobs);

async function captureLinkedInJobs() {
  result.textContent = "Reading visible LinkedIn search results…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/([a-z]+\.)?linkedin\.com\/jobs/i.test(tab.url || "")) {
    result.textContent = "Open a LinkedIn Jobs search-results page first.";
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "jobpilot:capture-linkedin" });
    if (!response?.jobs?.length) {
      result.textContent = response?.message || "No visible LinkedIn jobs were found. Scroll the results list, then retry.";
      return;
    }
    await chrome.storage.local.set({
      pendingLinkedInJobs: {
        captured_at: new Date().toISOString(),
        jobs: response.jobs
      }
    });
    result.textContent = `Captured ${response.jobs.length} LinkedIn job${response.jobs.length === 1 ? "" : "s"}. Open JobPilot to import them into Jobs and Pipeline.`;
  } catch {
    result.textContent = "LinkedIn did not respond. Confirm the extension has access to this LinkedIn Jobs page, refresh it, then retry.";
  }
}

async function fillVisibleQuestions() {
  result.textContent = "Inspecting the visible application form…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    result.textContent = "No active application tab found.";
    return;
  }
  const selectedMode = modeInputs.find((input) => input.checked)?.value || "review";
  await chrome.storage.local.set({ applicationMode: selectedMode });
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "jobpilot:fill",
      submit: selectedMode === "auto"
    });
    result.textContent = response?.message || "No response from this page.";
  } catch {
    result.textContent = "This site is not in the supported application-site list. JobPilot did not request access to the page.";
  }
}
