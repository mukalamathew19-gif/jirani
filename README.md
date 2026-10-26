# Jirani preview

A mobile-friendly local skills directory and installable web app prototype.

## Run it

For the full preview, serve this folder over localhost (needed for the installable app and offline cache). From PowerShell in this folder, run:

```powershell
py -m http.server 4173
```

Then open `http://localhost:4173`. If `py` is unavailable, install Python or use another static web server. The directory also works by opening `index.html`, but install/offline support requires localhost or HTTPS.

## Included in this preview

- Search by service, area, name, or skill; sort by experience or rating; save favorites on this device; share Jirani or a direct worker profile link.
- Customer and worker sign-up flows, login, role-specific account dashboard, and editable worker profiles.
- Private quote requests, customer and worker request dashboards, job status updates, completed-job reviews, and private profile reports.
- Worker availability, service details, price guidance, listing privacy controls, and a manual verification request/status flow with clear trust guidance.
- Settings for text size, high contrast, reduced motion, public listing, and installing the app on a device.
- Responsive layout, app manifest, icon, and service worker for install/offline support.

## Backend status

The Supabase project, database schema, email confirmation, production redirect, and frontend connection are set up. Both database migrations are applied, and the connected app is live on GitHub Pages. The directory is empty until workers create consented profiles.

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
