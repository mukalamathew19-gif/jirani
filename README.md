# Jirani preview

A mobile-friendly local skills directory and installable web app prototype.

## Run it

For the full preview, serve this folder over localhost (needed for the installable app and offline cache). From PowerShell in this folder, run:

```powershell
py -m http.server 4173
```

Then open `http://localhost:4173`. If `py` is unavailable, install Python or use another static web server. The directory also works by opening `index.html`, but install/offline support requires localhost or HTTPS.

## Included in this preview

- Service and area search, worker profile cards, and direct contact links for user-created profiles.
- Customer and worker sign-up flows, login, role-specific account dashboard, and editable worker profiles.
- A verification request/status flow and clear trust guidance.
- Responsive layout, app manifest, icon, and service worker for install/offline support.

## Preview limitations before a public launch

- Account records are stored in this browser's local storage. Passwords are not saved, but login is only a UI demonstration; it does not authenticate a password or verify an email.
- Verification requests only change a local preview status. There is no identity check, SMS/email OTP, reviewer queue, or admin approval.
- Nine directory entries are fictional sample profiles with no working contact numbers. Replace them with real profiles only after getting each worker's consent and confirming details.
- This is not safe for real user data or a public launch. Connect a real backend such as Supabase Auth and a database, enforce access rules, and implement a human verification process before collecting real accounts or publishing contacts.

## Suggested next implementation phase

1. Pick the pilot locality and initial service categories.
2. Create a Supabase project and connect email verification/auth, database tables, and row-level security.
3. Add worker profile management, admin review, and a documented verification standard.
4. Collect consented pilot listings and test the workflow with local residents and workers.
