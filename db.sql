BEGIN;

-- Table: nonces (prevent replay)
CREATE TABLE IF NOT EXISTS public.nonces (
id BIGSERIAL PRIMARY KEY,
attester TEXT NOT NULL, -- recommended lowercase wallet address
schema_uid TEXT NOT NULL, -- 0x + 64 hex
nonce TEXT NOT NULL,
consumed BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT nonces_attester_schema_nonce_unique UNIQUE (attester, schema_uid, nonce),
CONSTRAINT nonces_schema_uid_hex CHECK (schema_uid ~* '^0x[0-9a-f]{64}$')
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS nonces_attester_idx ON public.nonces (attester);
CREATE INDEX IF NOT EXISTS nonces_schema_uid_idx ON public.nonces (schema_uid);
CREATE INDEX IF NOT EXISTS nonces_consumed_idx ON public.nonces (consumed);
CREATE INDEX IF NOT EXISTS nonces_created_at_idx ON public.nonces (created_at DESC);

-- Table: attestations (logs)
CREATE TABLE IF NOT EXISTS public.attestations (
id BIGSERIAL PRIMARY KEY,
attester TEXT NOT NULL, -- recovered signer
schema_uid TEXT NOT NULL, -- 0x + 64 hex
recipient TEXT NOT NULL, -- 0x + 40 hex
data_hex TEXT NOT NULL, -- 0x… bytes payload (schema-encoded)
deadline TIMESTAMPTZ NOT NULL,
tx_hash TEXT,
status TEXT DEFAULT 'pending', -- pending | success | failed
error TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
CONSTRAINT attestations_status_check CHECK (status IN ('pending','success','failed')),
CONSTRAINT attestations_schema_uid_hex CHECK (schema_uid ~* '^0x[0-9a-f]{64}$'),
CONSTRAINT attestations_recipient_hex CHECK (recipient ~* '^0x[0-9a-f]{40}$'),
CONSTRAINT attestations_data_hex CHECK (data_hex ~* '^0x[0-9a-f]*$')
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS attestations_attester_idx ON public.attestations (attester);
CREATE INDEX IF NOT EXISTS attestations_schema_uid_idx ON public.attestations (schema_uid);
CREATE INDEX IF NOT EXISTS attestations_status_idx ON public.attestations (status);
CREATE INDEX IF NOT EXISTS attestations_created_at_idx ON public.attestations (created_at DESC);

-- Table: rate_limits (optional)
CREATE TABLE IF NOT EXISTS public.rate_limits (
id BIGSERIAL PRIMARY KEY,
key TEXT NOT NULL, -- e.g. wallet:0xabc… or ip:1.2.3.4
bucket TEXT NOT NULL, -- e.g. delegated_attest
count INT NOT NULL DEFAULT 0,
window_start TIMESTAMPTZ NOT NULL,
CONSTRAINT rate_limits_key_bucket_unique UNIQUE (key, bucket)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits (window_start DESC);

-- Enable Row Level Security (RLS) – locked down by default
ALTER TABLE public.nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies are created here — only Service Role (Edge Functions) can read/write by default.
-- You may add read policies later if needed. Example (uncomment to allow public read of logs):
-- CREATE POLICY "attestations_read_all"
-- ON public.attestations FOR SELECT
-- TO anon, authenticated
-- USING (true);

COMMIT;