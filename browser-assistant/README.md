# JobPilot Browser Assistant

The assistant fills visible job-application fields from the Candidate Setup explicitly synced by the signed-in JobPilot user.

## Install in Chrome or Edge

1. Download `jobpilot-browser-assistant.zip` from JobPilot.
2. Extract the ZIP.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.
6. Open JobPilot → Candidate Setup → **Sync with Browser Assistant**.
7. Open a supported application form and use the extension button.

After replacing or updating the unpacked extension, click **Reload** on its extension card and refresh the open JobPilot and application tabs before syncing.

## Capture LinkedIn jobs

1. Open a LinkedIn Jobs search-results page and scroll the result list you want JobPilot to read.
2. Open JobPilot Assistant and click **Capture visible LinkedIn jobs**.
3. Return to JobPilot. Captured jobs are imported into Jobs and Pipeline, deduplicated by LinkedIn job ID, and marked as outside-portal candidate actions.

The assistant reads only job cards rendered in the active tab after the candidate explicitly clicks Capture. It does not sign in, bypass LinkedIn controls, run unattended scraping, or store LinkedIn credentials.

## Application modes

- **Review before submit** fills supported visible fields and leaves final submission to the candidate.
- **Auto-submit when safe** may click one unambiguous final submission control only after the candidate explicitly selects that mode and runs the assistant.

Auto-submit remains fail-closed. It stops when any required question is unresolved or when the page contains CAPTCHA, assessments, consent, declarations, file uploads, or no single unambiguous submission control.

## Supported application sites

The extension requests access only to JobPilot, LinkedIn Jobs, Greenhouse, Lever, Workday, SmartRecruiters, Workable, Ashby, and iCIMS pages. It does not run on every HTTPS website.

## Safety

- No job-board password is requested or stored.
- The assistant fills only visible supported form controls.
- Passwords, file inputs, CAPTCHA, assessments, consent, declarations, and unresolved required questions are not automated.
- Auto-submit requires an explicit candidate mode selection and remains blocked by the safety checks above.
- External portal terms and candidate accuracy obligations still apply.
