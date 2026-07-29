"use strict";

const status = document.getElementById("sync-status");
const result = document.getElementById("result");
const fillButton = document.getElementById("fill");
const submitButton = document.getElementById("submit");

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
