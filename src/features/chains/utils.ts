import { ChainNameOrId, chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';

import { getMultiProvider } from '../../context/context';

// Fallback metadata for Relay chains that aren't in Hyperlane
const RELAY_CHAIN_METADATA: Record<string, any> = {
  ethereum: {
    name: 'ethereum',
    displayName: 'Ethereum',
    displayNameShort: 'ETH',
    protocol: ProtocolType.Ethereum,
    chainId: 1,
    domainId: 1,
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [{ http: 'https://ethereum.rpc.hyperlane.xyz' }],
  },

  arbitrum: {
    name: 'arbitrum',
    displayName: 'Arbitrum One',
    displayNameShort: 'ARB',
    protocol: ProtocolType.Ethereum,
    chainId: 42161,
    domainId: 42161,
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [{ http: 'https://arbitrum.rpc.hyperlane.xyz' }],
  },
  optimism: {
    name: 'optimism',
    displayName: 'Optimism',
    displayNameShort: 'OP',
    protocol: ProtocolType.Ethereum,
    chainId: 10,
    domainId: 10,
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [{ http: 'https://optimism.rpc.hyperlane.xyz' }],
  },

};

// Import centralized Relay utilities
import { mapRelayChainToInternalName as relayMapChainName } from './relayUtils';

// Re-export for backward compatibility
export function mapRelayChainToInternalName(relayChainName: string): string {
  return relayMapChainName(relayChainName);
}

// Helper function to check if a chain is a Relay chain
export function isRelayChain(chain: ChainNameOrId): boolean {
  const chainStr = typeof chain === 'string' ? chain : chain.toString();
  const relayChains = ['ethereum', 'arbitrum', 'optimism'];
  
  // Check both hardcoded metadata and known Relay chains
  return chainStr.toLowerCase() in RELAY_CHAIN_METADATA || relayChains.includes(chainStr.toLowerCase());
}


export function getChainDisplayName(chain: ChainName, shortName = false) {
  if (!chain) return 'Unknown';
  const metadata = tryGetChainMetadata(chain);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

export function isPermissionlessChain(chain: ChainName) {
  if (!chain) return true;
  return getChainMetadata(chain).protocol === ProtocolType.Ethereum || !chainMetadata[chain];
}

export function hasPermissionlessChain(ids: ChainName[]) {
  return !ids.every((c) => !isPermissionlessChain(c));
}

export function getChainByRpcEndpoint(endpoint?: string) {
  if (!endpoint) return undefined;
  const allMetadata = Object.values(getMultiProvider().metadata);
  return allMetadata.find(
    (m) => !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(endpoint.toLowerCase())),
  );
}

export function tryGetChainMetadata(chain: ChainNameOrId) {
  // First try to get from Hyperlane
  const hyperlaneMetadata = getMultiProvider().tryGetChainMetadata(chain);
  if (hyperlaneMetadata) {
    return hyperlaneMetadata;
  }
  
  // Fallback to Relay chain metadata if available
  if (isRelayChain(chain)) {
    const chainStr = typeof chain === 'string' ? chain : chain.toString();
    return RELAY_CHAIN_METADATA[chainStr];
  }
  
  return null;
}

export function getChainMetadata(chain: ChainNameOrId) {
  // First try to get from Hyperlane
  try {
    return getMultiProvider().getChainMetadata(chain);
  } catch (error) {
    // If Hyperlane doesn't have it, try Relay fallback
    if (isRelayChain(chain)) {
      const chainStr = typeof chain === 'string' ? chain : chain.toString();
      return RELAY_CHAIN_METADATA[chainStr];
    }
    // Re-throw the original error if no fallback is available
    throw error;
  }
}

export function tryGetChainProtocol(chain: ChainNameOrId) {
  const metadata = tryGetChainMetadata(chain);
  return metadata?.protocol;
}

export function getChainProtocol(chain: ChainNameOrId) {
  const metadata = getChainMetadata(chain);
  return metadata.protocol;
}

export function formatAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const prefix = address.slice(0, 8); // First 8 characters
  const suffix = address.slice(-4); // Last 4 characters

  return `${prefix}...${suffix}`;
}
