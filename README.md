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
- This scaffold uses a generic EAS delegated Attest typed data layout (EIP-712 domain { name: "EAS", version: "1.0" }). Validate fields against your target EAS version and schema.
- `dataHex` must be schema-encoded bytes. Use the EAS SDK SchemaEncoder when wiring full schema support.
- The API route is a simple proxy to avoid CORS and keep the service role key out of the client.

Key Files
- app/page.tsx: Home view with WalletConnect and AttestationForm.
- components/WalletConnect.tsx: Simple MetaMask connect/disconnect.
- components/AttestationForm.tsx: zod-validated form, EIP-712 signing, and relay call.
- lib/eas.ts: Delegated attestation typed data builder.
- app/api/relay/route.ts: Proxy to `RELAYER_URL`.
