export const env = {
  relayerUrl: process.env.RELAYER_URL || "",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111),
  easAddress: process.env.NEXT_PUBLIC_EAS_ADDRESS || "",
  defaultSchemaUid: process.env.NEXT_PUBLIC_DEFAULT_SCHEMA_UID || "",
  easVersion: process.env.NEXT_PUBLIC_EAS_VERSION || "0.26"
};
