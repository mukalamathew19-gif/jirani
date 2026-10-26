# Jirani Supabase setup

Jirani uses Supabase Auth and PostgreSQL. The project and initial schema have been created on the Supabase Free plan. The browser receives only the project URL and public publishable key in supabase-config.js. Never put a secret or service_role key in the app or public GitHub repository.

## What is configured

- Email and password sign-in with email confirmation required.
- The production redirect is limited to https://mukalamathew19-gif.github.io/jirani/.
- worker_profiles and verification_requests use Row Level Security. Public visitors can read a worker profile only when the worker consents and lists it. Workers can update only their own profile; the browser cannot mark it verified.
- The SQL migration is in migrations/202610270001_initial_schema.sql.

## Verification review

Review worker evidence outside the app, then update that worker’s request status in Supabase Studio. The database trigger updates the worker’s badge. Verification means a reviewer checked the submitted evidence; it does not guarantee work quality or safety.

## Pilot notes

The default Supabase email sender has low rate limits; configure SMTP before a wider pilot. The nine sample directory profiles are fictional. Replace them only with real profiles whose owners gave consent and whose details have been confirmed.
