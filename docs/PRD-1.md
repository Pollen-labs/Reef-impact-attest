🪸 **Product Requirements Document: Coral Attestation (EAS Delegation POC#!)**

---

### 1. Overview

**Project Name:** Coral Attestation POC#1
**Goal:** Enable citizen to create verifiable attestations of reef studies or actions using the Ethereum Attestation Service (EAS) with a delegated signing model.

Users sign attestations on-chain via MetaMask, while a trusted relayer (our backend) pays gas to publish them on-chain.

---

### 2. Key Objectives

* Build a simple web app (PWA-ready) for signing & submitting attestations.
* Integrate MetaMask wallet for authentication and EIP-712 signing.
* Implement delegated attestations using EAS SDK (`signDelegatedAttestation`).
* Use Supabase for backend storage (nonces, submissions, logs).
* Provide transparent proof of data published on-chain (EAS Explorer link).
* Support offline-first and mobile use cases through PWA capabilities in later phases

---

### 3. Core User Flow

1. User connects MetaMask wallet.
2. User fills attestation form (study details, timestamp, location, contribution).
3. App generates EIP-712 typed data and prompts signature via MetaMask.
4. App sends `{typedData, signature}` to backend (Next.js API route).
5. Backend verifies signature → calls `attestByDelegation` on EAS → stores tx hash in Supabase.
6. UI shows transaction link and status.

---

### 4. Technical Architecture

**Frontend**

* Framework: Next.js (App Router)
* Libraries: wagmi v2 + viem, @ethereum-attestation-service/eas-sdk
* Wallet: MetaMask
* PWA: next-pwa (manifest + service worker) - later phase
* Form validation: zod

**Backend**

* Next.js Route Handlers as API endpoints
* Supabase for persistence (nonce tracking, user submissions, logs)
* Server wallet for relaying delegated attestations
* Environment-secured private key (`RELAYER_PK`)

**Blockchain**

* Ethereum / Sepolia testnet
* EAS schema pre-deployed (e.g., `study_log`, `reef_observation`)
* Attestations visible via EAS Explorer

---

### 5. Core Features (MVP)

| Feature             | Description                         | Status    |
| ------------------- | ----------------------------------- | --------- |
| Wallet Connect      | Connect MetaMask wallet via wagmi   | ✅ Planned |
| Delegated Signature | EIP-712 typed data + user signature | ✅ Planned |
| Backend Relayer     | Server verifies and submits tx      | ✅ Planned |
| Supabase Storage    | Logs and nonce tracking             | ✅ Planned |
| Attestation Viewer  | Display tx hash + EAS Explorer link | ✅ Planned |
| PWA Support         | Installable app for offline use     | ✅ Planned |

---

### 6. Future Enhancements

* Multi-schema support (Impact Report, Field Sample, etc.)
* Role-based permissions (researchers, DAO members, verifiers)
* Revocation / update flow
* Integration with MesoReefDAO dashboard
* IPFS/Storacha integration for off-chain data storage

---

### 7. Success Metrics

* ✅ Successful delegated attestations published on EAS
* ⚙️ < 5s average signature + relay response time
* 📈 > 80% attestations verified via EAS Explorer
* 📱 PWA install rate among researchers (>30%)

---

### 8. References

* [EAS Delegated Attestation Docs](https://docs.attest.org/docs/core--concepts/delegated-attestations)
* [EAS SDK](https://docs.attest.org/docs/sdk-overview)
* [wagmi / viem](https://wagmi.sh/)
* [Next.js PWA Guide](https://nextjs.org/docs/app/building-your-application/progressive-web-apps)

---

### 9. Backend Setup (Supabase Cloud — Step by Step)

> Goal: create the database tables, turn on RLS safely, and deploy a **single Edge Function** that relays delegated EAS attestations.

#### A) Create / open your Supabase project

1. Go to **Supabase Dashboard → New project** (or open your existing one).
2. Note your **Project URL** and **Service Role Key** (Settings → API). You’ll use the Service Role Key *only on the server*.

#### B) Create the database tables (copy‑paste SQL)

1. Open **SQL Editor → New query**.
2. Paste and **Run** the following:

```sql
-- Table 1: nonces (prevent replay)
create table if not exists public.nonces (
  id bigserial primary key,
  attester text not null,            -- lowercase wallet address
  schema_uid text not null,
  nonce text not null,
  consumed boolean default false,
  created_at timestamptz default now(),
  unique(attester, schema_uid, nonce)
);

-- Table 2: attestations (logs)
create table if not exists public.attestations (
  id bigserial primary key,
  attester text not null,            -- recovered signer
  schema_uid text not null,
  recipient text not null,
  data_hex text not null,            -- 0x… bytes payload
  deadline timestamptz not null,
  tx_hash text,
  status text default 'pending',     -- pending | success | failed
  error text,
  created_at timestamptz default now()
);

-- Table 3: (optional) rate_limits
create table if not exists public.rate_limits (
  id bigserial primary key,
  key text not null,                 -- e.g. wallet:0xabc… or ip:1.2.3.4
  bucket text not null,              -- e.g. delegated_attest
  count int not null default 0,
  window_start timestamptz not null,
  unique(key, bucket)
);
```

#### C) Enable RLS (safe defaults)

We’ll enable RLS so the **client** cannot write directly. The **Service Role** (used by your Edge Function) bypasses RLS automatically.

```sql
alter table public.nonces enable row level security;
alter table public.attestations enable row level security;
alter table public.rate_limits enable row level security;
```

> **Optional read policy** (only if you want users to read *their own* logs directly from the client):

```sql
create policy "read own attestation logs" on public.attestations
  for select using (true); -- simplest: later, filter by attester in an RPC or Edge Function
```

*(Simplest MVP: skip client reads and expose a small **GET /logs** Edge endpoint later.)*

#### D) Create the Edge Function (the relayer)

1. Install the Supabase CLI (once): **Docs → Supabase CLI**.
2. In your project folder: `supabase init`
3. Create the function directory: `supabase/functions/relay-attest/`
4. Add `index.ts` with the relayer code I shared earlier (I can paste a minimal version when you’re ready).
5. Login & link: `supabase login` → `supabase link --project-ref <your-ref>`

#### E) Set your secrets (Environment variables)

In **Dashboard → Project Settings → Functions → Secrets**, add:

* `RELAYER_PRIVATE_KEY` — 0x… (funded with test ETH on Sepolia for dev)
* `RPC_URL` — your Infura/Alchemy endpoint for Sepolia
* `EAS_ADDRESS` — EAS contract on your chain (Sepolia for dev)
* `ALLOWED_SCHEMA_UIDS` — comma‑separated list of schema UIDs you accept
* `CHAIN_ID` — `11155111` (Sepolia) to guard requests
* *(Optional)* `ALLOWED_ORIGINS` — your frontend URL for CORS
* `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — injected automatically in Functions; verify they exist

#### F) Deploy the Edge Function

From your project root:

```bash
supabase functions deploy relay-attest
```

Copy the function URL shown after deploy (it will look like:
`https://<project-ref>.functions.supabase.co/relay-attest`).

#### G) Frontend → Backend wire‑up (what the client sends)

After the user signs EIP‑712 typed data with MetaMask, POST this JSON to your function URL:

```json
{
  "schemaUid": "0x...",
  "recipient": "0xRecipient",
  "dataHex": "0x...",
  "attester": "0xAttester",
  "nonce": "unique-string-or-number",
  "deadline": 1739560000,
  "typedData": { "domain": {}, "types": {}, "primaryType": "...", "message": {} },
  "signature": "0x..."
}
```

The function will: **verify signature → check/consume nonce → call `attestByDelegation` → save tx hash**.

#### H) Quick sanity checks

* If you `GET` the function URL, you should see **405 Method Not Allowed** (that means it’s live).
* A `POST` with missing fields should return **400 Bad Request**.
* Watch the **Database → Tables** to see rows appear in `attestations` after successful posts.

#### I) What you need to prepare before testing

* A **schema UID** on EAS (use an existing one for dev).
* A **recipient** address (can be your own).
* A small **data payload** encoded to bytes that matches the schema (we can generate this together).
* Your relayer wallet funded with a little **Sepolia ETH**.

> When you’re ready, I can paste a **copy‑ready Edge Function file** and a **client snippet** that builds the delegated typed data for a specific schema UID so you can test end‑to‑end.
