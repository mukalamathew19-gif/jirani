# Supabase setup for Jirani

Jirani uses Supabase Auth for email/password accounts and PostgreSQL for worker listings and verification requests. The browser uses only a project URL and a publishable key; Row Level Security (RLS) protects the database. Never put a secret/service-role key in the website.

## 1. Create the project

Create a Supabase project on the free plan. Choose a project name such as `jirani` and a database password you can store safely. The region can be chosen in the Dashboard; choose the closest available region to the pilot community.

## 2. Create tables and security policies

In the Supabase Dashboard, open **SQL Editor**, create a query, paste the contents of `202610270001_initial_schema.sql`, and run it. This creates the worker directory and verification request tables with RLS policies. Public visitors can read only consented, listed worker profiles. Workers can edit only their own profiles; the browser cannot mark a profile verified.

For quote requests, request tracking, reviews, and private profile reports, run `migrations/202610270002_marketplace_features.sql` once after the initial schema. It adds worker profile details and availability, participant-only quote requests, reviews that can only be submitted for completed requests, and private profile reports.

For worker profile photos, run `migrations/202610270003_worker_profile_photos.sql` after the marketplace migration. Photos are resized in the browser to 512 × 512 JPEGs and saved in a private bucket. Each worker can manage only objects in their own user-id folder. The directory issues short-lived signed links only for profiles that are both listed and consented; unlisting a profile stops new public links from being created.

## 3. Configure email sign-in

In **Authentication → URL Configuration**, add the deployed site URL as the Site URL and add this redirect URL to the allowed list:

```text
https://mukalamathew19-gif.github.io/jirani/**
```

Email/password sign-up is used. Keep email confirmation enabled so users must verify their email before signing in. The default Supabase email sender has low rate limits; for a real pilot, configure an SMTP provider later.

## 4. Connect the static site

In the Supabase Dashboard, open **Connect** and copy the Project URL and **publishable key** (`sb_publishable_...`). Put those two values in `supabase-config.js` and publish that file with the rest of the site. These two frontend values are designed to be public. Do not copy any key labelled **secret** or **service_role** into the app, browser, or GitHub.

## 5. Review verification requests

Worker requests are stored in `public.verification_requests`. Review references outside the app, then update a request's `status` to `approved` or `rejected` in Supabase Studio. A database trigger updates the public profile badge. Approval means a reviewer checked the submitted evidence; it is not a guarantee of work quality or safety.

## Current setup status

The Jirani Supabase project has been created on the Free plan, all three database migrations have been applied, and `supabase-config.js` contains its public project URL and publishable key. The included sample workers are fictional and should be removed before collecting real listings. Reports and identity checks currently require manual review in Supabase Studio; no reviewer tools are exposed in the public app.
