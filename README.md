Coral Attestation POC (Delegated EAS)

Overview
- Next.js (App Router) + TypeScript scaffold for delegated EAS attestations per PRD-1.md.
- Wallet connect via wagmi (MetaMask injected connector).
- Client builds EIP-712 typed data for delegated attestation and signs it.
- API proxy forwards the signed payload to your Supabase Edge Function relayer.
- PWA is intentionally omitted per request.

Getting Started
1) Copy envs
   - cp .env.example .env
   - Set `RELAYER_URL` to your Supabase function URL.
   - Set `NEXT_PUBLIC_EAS_ADDRESS` and `NEXT_PUBLIC_CHAIN_ID` for your network (Sepolia defaults provided).
   - Optionally set `NEXT_PUBLIC_DEFAULT_SCHEMA_UID`.

2) Install pnpm and run
   - Enable Corepack (recommended): `corepack enable`
   - Ensure pnpm version matches package.json (or activate): `corepack prepare pnpm@9.11.0 --activate`
   - Install deps: `pnpm install`
   - Start dev server: `pnpm dev`

3) Frontend flow
   - Connect MetaMask.
   - Fill schema UID, recipient, data hex, nonce, deadline.
   - Click "Sign & Relay" to sign typed data and POST it to `/api/relay`.

4) Backend relayer (Supabase Edge)
   - Follow PRD-1.md section 9 (B–F) to create tables, enable RLS, and deploy the `relay-attest` function.
   - Ensure env secrets are set: `RELAYER_PRIVATE_KEY`, `RPC_URL`, `EAS_ADDRESS`, `ALLOWED_SCHEMA_UIDS`, `CHAIN_ID`.

Important Notes
- This scaffold uses the official EAS delegated Attest EIP-712 layout with nested `AttestationRequestData` and domain { name: "EAS", version: "1.0.0" }. Validate fields against your target EAS deployment.
- `dataHex` must be schema-encoded bytes. Use the EAS SDK SchemaEncoder when wiring full schema support.
- The API route is a simple proxy to avoid CORS and keep the service role key out of the client.

Key Files
- app/page.tsx: Home view with WalletConnect and AttestationForm.
- components/WalletConnect.tsx: Simple MetaMask connect/disconnect.
- components/AttestationForm.tsx: zod-validated form, EIP-712 signing, and relay call.
- lib/eas.ts: Delegated attestation typed data builder.
- app/api/relay/route.ts: Proxy to `RELAYER_URL`.
- supabase/functions/relay-attest/index.ts: Supabase Edge Function (Deno) to verify signatures, prevent replay, relay to EAS, and log to DB.

Backend Env (Supabase Function Secrets)
- RELAYER_PRIVATE_KEY: 0x… private key for relayer wallet (funded on your testnet)
- RPC_URL: HTTPS RPC endpoint (e.g., Infura/Alchemy) for the target chain
- EAS_ADDRESS: EAS contract address on your chain (e.g., Sepolia v0.26: 0xC2679f… or Optimism Sepolia: 0x4200…)
- CHAIN_ID: numeric chain id (e.g., 11155111 for Sepolia)
- EAS_DOMAIN_VERSION: EIP-712 domain version for this EAS deployment (use "0.26" for Sepolia 0xC2679f…; use "1.0.0" for v1 deployments)
- ALLOWED_SCHEMA_UIDS: comma-separated list of schema UIDs accepted by the relayer
- DEFAULT_SCHEMA_UID: optional fallback schema UID used when the client omits/typos the field (dev only)
- ALLOWED_ORIGINS: comma-separated list of allowed origins for CORS (e.g., http://localhost:3000)
- SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: auto-injected by Supabase Functions (verify present)

Deploy Edge Function
1) Install Supabase CLI and login: `supabase login`
2) Link project: `supabase link --project-ref <your-ref>`
3) Deploy: `supabase functions deploy relay-attest`
4) Set secrets in Dashboard → Project Settings → Functions → Secrets
5) Test: `curl -i <function-url>` and then POST a signed payload from the app

 Frontend Server Env (Next.js)
- RELAYER_URL: your deployed function URL
- RELAYER_INVOKE_KEY: Supabase anon key used to authorize function invocation from the Next.js server route
  - Next.js server forwards Authorization and apikey headers so Supabase doesn’t return 401
 - NEXT_PUBLIC_EAS_VERSION: must match the target EAS deployment domain version. For Sepolia EAS at 0xC2679f… use "0.26". For newer v1 deployments use "1.0.0".
