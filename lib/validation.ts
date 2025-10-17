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
  nonce: z.union([z.string(), z.number()]).describe("Unique nonce"),
  deadline: z
    .number()
    .int()
    .positive()
    .describe("Unix seconds in the future")
});

export type AttestationForm = z.infer<typeof attestationSchema>;
