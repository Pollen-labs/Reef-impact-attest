import { env } from "@/lib/env";

export type DelegatedAttestationInput = {
  schemaUid: `0x${string}`;
  recipient: `0x${string}`;
  dataHex: `0x${string}`;
  deadline: number; // seconds since epoch
  nonce: string | number;
  expirationTime?: number; // 0 for no expiration
  revocable?: boolean;
  refUID?: `0x${string}`;
  value?: bigint | number | string;
};

export function buildDelegatedAttestTypedData(input: DelegatedAttestationInput) {
  const chainId = env.chainId;
  const verifyingContract = env.easAddress as `0x${string}`;

  const message = {
    schema: input.schemaUid,
    recipient: input.recipient,
    expirationTime: BigInt(input.expirationTime ?? 0),
    revocable: input.revocable ?? true,
    refUID: (input.refUID ??
      ("0x" + "0".repeat(64)) as `0x${string}`) as `0x${string}`,
    data: input.dataHex,
    value: BigInt(input.value ?? 0),
    deadline: BigInt(input.deadline),
    nonce: BigInt(input.nonce as any)
  } as const;

  const domain = {
    name: "EAS",
    version: "1.0",
    chainId,
    verifyingContract
  } as const;

  const types = {
    Attest: [
      { name: "schema", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "expirationTime", type: "uint64" },
      { name: "revocable", type: "bool" },
      { name: "refUID", type: "bytes32" },
      { name: "data", type: "bytes" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "nonce", type: "uint256" }
    ]
  } as const;

  return {
    domain,
    types,
    primaryType: "Attest" as const,
    message
  };
}

