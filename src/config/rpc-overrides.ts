// RPC Override Configuration
// This file allows you to easily override RPC URLs for specific networks
// without modifying the core logic in other files.

export interface RpcOverride {
  primary: string[];
  backup?: string[];
  webSocket?: string[];
}

// Network-specific RPC overrides
// Add your custom RPC configurations here
export const RPC_OVERRIDES: Record<number, RpcOverride> = {
  // Ethereum Mainnet
  1: {
    primary: ['https://1rpc.io/eth'],
    backup: ['https://ethereum-rpc.publicnode.com'],
  },

  // Add more networks as needed
};

// Helper function to get RPC overrides for a specific chain
export function getRpcOverride(chainId: number): RpcOverride | null {
  return RPC_OVERRIDES[chainId] || null;
}

// Helper function to check if a chain has RPC overrides
export function hasRpcOverride(chainId: number): boolean {
  return chainId in RPC_OVERRIDES;
}

// Helper function to get all RPC URLs for a chain (primary + backup)
export function getAllRpcUrls(chainId: number): string[] {
  const override = getRpcOverride(chainId);
  if (!override) return [];

  const urls: string[] = [];

  // Add primary URLs
  if (override.primary) {
    urls.push(...override.primary);
  }

  // Add backup URLs
  if (override.backup) {
    urls.push(...override.backup);
  }

  return urls;
}

// Helper function to get only primary RPC URLs
export function getPrimaryRpcUrls(chainId: number): string[] {
  const override = getRpcOverride(chainId);
  return override?.primary || [];
}

// Helper function to get only backup RPC URLs
export function getBackupRpcUrls(chainId: number): string[] {
  const override = getRpcOverride(chainId);
  return override?.backup || [];
}
