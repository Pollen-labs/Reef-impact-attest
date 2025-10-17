export const env = {
  relayerUrl: process.env.RELAYER_URL || "",
  // Default to Optimism Sepolia (11155420) if not provided
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155420),
  easAddress: process.env.NEXT_PUBLIC_EAS_ADDRESS || "",
  defaultSchemaUid: process.env.NEXT_PUBLIC_DEFAULT_SCHEMA_UID || "",
  easVersion: process.env.NEXT_PUBLIC_EAS_VERSION || "0.26"
};
