Supabase SQL — Coral Action Attestation MVP

Overview
- This folder contains copy-paste SQL you can run in the Supabase SQL Editor to create the MVP database.
- Apply in order: 001_schema.sql → 002_rls.sql → 003_seed.sql.

What’s included
- Schema: profiles, coral_species, attestations, and a regen_type enum.
- Constraints: uniqueness on wallet_address and handle; FK from attestations → profiles.
- RLS: public readable profiles/attestations/species; authenticated users can manage their own profile and attestations.
- Seed: 10 placeholder coral species for the UI.

How to apply
1) Open Supabase Dashboard → SQL Editor → New query.
2) Paste the contents of supabase/sql/001_schema.sql and run.
3) Paste the contents of supabase/sql/002_rls.sql and run.
4) Paste the contents of supabase/sql/003_seed.sql and run.

Notes
- These policies assume you use Supabase Auth and pass the access token from the client; policies use auth.uid().
- Public read is enabled for map and profile pages. If you prefer private-by-default, change SELECT policies accordingly.
- Attestations.uid is optional during draft; your app can update the row with the EAS UID after the relayer responds.

Frontend wiring (server-side)
- Set env vars in Reef-impact-attest/.env:
  - SUPABASE_URL=https://<your-project-ref>.supabase.co
  - SUPABASE_SERVICE_ROLE_KEY=... (server-only)
- The app has server routes:
  - `POST /api/profiles/upsert` { wallet_address }
  - `POST /api/attestations/create` { profile_id | wallet_address, regen_type, action_date, location_lat, location_lng, ... }
  - `POST /api/attestations/set-uid` { attestation_id, uid }
  The AttestationForm creates a minimal draft before relay and sets the UID after success.
