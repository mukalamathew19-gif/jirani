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

## Backend status

The Supabase project, database schema, email confirmation, production redirect, and frontend connection are set up. The connected app is live on GitHub Pages. The directory is empty until workers create consented profiles. See [Supabase setup](supabase/README.md).

The frontend key must be a publishable key only. Never place a Supabase secret or service-role key in this public repository.

## Before a real pilot

- Sign-up and login use Supabase Auth with email confirmation. The browser does not save account passwords.
- Verification requests are stored in Supabase, but reviewers currently process them manually in Supabase Studio. Jirani does not independently check identity, and verification does not guarantee work quality or safety.
- Nine directory entries are fictional and hidden when the backend is connected. Add real profiles only after getting each worker's consent and confirming details.
- Supabase's default email sender has low rate limits. Configure SMTP before a wider pilot.

## Suggested next implementation phase

1. Pick the pilot locality and initial service categories.
2. Add in-app admin review tools and a documented verification standard.
3. Collect consented pilot listings and test the workflow with local residents and workers.
