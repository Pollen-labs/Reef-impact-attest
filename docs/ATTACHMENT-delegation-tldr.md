Delegated Attestation TL;DR

Overview
- Network: Sepolia (chainId 11155111)
- EAS contract: 0xC2679fBD37d54388Ce493F1DB75320D236e1815e
- Schema (POC): 0x001e1e0d831d5ddf74723ac311f51e65dbdccec850e0f1fcf9ee41e6461e2d4d
- Schema fields: string user
- Roles:
  - Attester: end user signs an EIP‑712 delegated attestation off‑chain.
  - Relayer (payer): Cloudflare Worker verifies and submits on‑chain.

What the client does
- Uses EAS SDK + ethers BrowserProvider signer.
- Encodes data with SchemaEncoder("string user").
- Reads nonce from EAS via getNonce(attester).
- Sets deadline = max(userInput, now + 10 minutes).
- Signs with getDelegated().signDelegatedAttestation({ schema, recipient, expirationTime, revocable, refUID, data, value: 0n, deadline, nonce }, signer).
- POSTs to /api/relay with { attester, delegatedAttestation }.
- The Next.js API proxies to RELAYER_URL (local Worker or deployed Worker).

What the Worker does
- Normalizes RELAYER_PRIVATE_KEY and instantiates ethers JsonRpcProvider.
- Validates addresses and schema.
- Coerces numeric fields to bigint safely (domain.chainId, message.deadline, nonce, expirationTime, value). Also falls back to signature.deadline when needed.
- Verifies signature via eas.getDelegated().verifyDelegatedAttestationSignature(attester, delegated).
- Checks on‑chain nonce equals the signed nonce.
- Calls eas.attestByDelegation and awaits the tx to resolve the attestation UID.
- Returns { ok: true, uid, txHash } on success or a 4xx with a clear error code: BAD_NONCE, DEADLINE_EXPIRED, INVALID_SIGNATURE, INVALID_RELAYER_PRIVATE_KEY, etc.

Environment (Worker)
- Secrets (set via wrangler secrets or .dev.vars for local dev):
  - RELAYER_PRIVATE_KEY=0x<64 hex>
  - RPC_URL=https://sepolia.<provider>.com/v3/<key>
- Vars (wrangler.toml):
  - EAS_ADDRESS, SCHEMA_UID, ALLOWED_ORIGINS

Local dev
- In relayer/.dev.vars: set RELAYER_PRIVATE_KEY and RPC_URL.
- pnpm wrangler dev (from relayer/)
- In Reef-impact-attest/.env: RELAYER_URL=http://localhost:8787
- pnpm dev (from Reef-impact-attest/)

Deploy
- pnpm wrangler login
- pnpm wrangler secret put RPC_URL
- pnpm wrangler secret put RELAYER_PRIVATE_KEY
- pnpm wrangler deploy
- Update RELAYER_URL in Reef-impact-attest/.env to the deployed Worker URL.

Gotchas avoided
- v normalization (0/1 → 27/28) handled in the Supabase prototype; the Worker path uses the SDK end‑to‑end.
- EIP‑712 types: deadline and nonce are uint256.
- ABI differences handled by using the SDK (no manual ABI juggling).
- BigInt JSON: client stringifies with a replacer; Worker coerces strings → bigint safely.

Next iteration ideas
- Input validation in Worker (rate‑limit, origin allowlist).
- Optional HMAC/API key for /relay endpoint.
- Persist relay attempts + results (e.g., D1/kv) and surface a status query by client request id.

