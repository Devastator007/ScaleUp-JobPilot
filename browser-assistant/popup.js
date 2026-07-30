"use strict";

const status = document.getElementById("sync-status");
const result = document.getElementById("result");
const fillButton = document.getElementById("fill");
const submitButton = document.getElementById("submit");
const captureLinkedInButton = document.getElementById("capture-linkedin");

chrome.storage.local.get("candidateSetup", ({ candidateSetup }) => {
  const ready = Boolean(candidateSetup?.candidate?.resume_summary);
  status.textContent = ready
    ? `Synced ${new Date(candidateSetup.synced_at).toLocaleString()}`
    : "Open Candidate Setup in JobPilot and click “Sync with Browser Assistant” first.";
  fillButton.disabled = !ready;
  submitButton.disabled = !ready;
});

fillButton.addEventListener("click", () => run(false));
submitButton.addEventListener("click", () => run(true));
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
    result.textContent = "LinkedIn did not respond. Refresh the LinkedIn page after updating the extension, then retry.";
  }
}

async function run(submit) {
  result.textContent = "Inspecting the visible application form…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    result.textContent = "No active application tab found.";
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "jobpilot:fill",
      submit
    });
    result.textContent = response?.message || "No response from this page.";
  } catch {
    result.textContent = "This page does not allow the assistant. Refresh it after installing the extension.";
  }
}
