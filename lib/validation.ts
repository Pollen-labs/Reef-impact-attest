import { z } from "zod";

export const attestationSchema = z.object({
  schemaUid: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/i, "Must be 32-byte hex (0x…)")
    .describe("EAS Schema UID"),
  recipient: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/i, "Must be an address")
    .describe("Recipient address"),
  dataHex: z
    .string()
    .regex(/^0x[0-9a-fA-F]*$/i, "Must be hex (0x…)")
    .describe("Encoded data matching schema"),
  user: z.string().optional().describe("string field for schema: 'string user'"),
  nonce: z.union([z.string(), z.number()]).describe("Unique nonce"),
  deadline: z
    .number()
    .int()
    .positive()
    .describe("Unix seconds in the future")
});

export type AttestationForm = z.infer<typeof attestationSchema>;
