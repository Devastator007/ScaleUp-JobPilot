# JobPilot Browser Assistant

The assistant fills visible job-application fields from the Candidate Setup explicitly synced by the signed-in JobPilot user.

## Install in Chrome or Edge

1. Download `jobpilot-browser-assistant.zip` from JobPilot.
2. Extract the ZIP.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.
6. Open JobPilot → Candidate Setup → **Sync with Browser Assistant**.
7. Open an application form and use the extension button.

After replacing or updating the unpacked extension, click **Reload** on its
extension card and refresh the open JobPilot and application tabs before syncing.

## Safety

- No job-board password is requested or stored.
- The assistant fills only visible form controls.
- Passwords, file inputs, CAPTCHA, assessments, consent, declarations, and unresolved required questions are not automated.
- **Fill and submit** requires an explicit click and only proceeds when no blocker is detected and a single unambiguous submit button exists.
- External portal terms and candidate accuracy obligations still apply.
