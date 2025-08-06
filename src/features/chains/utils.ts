import { ChainNameOrId, chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';

import { getMultiProvider } from '../../context/context';

// Import centralized Relay utilities
import { mapRelayChainToInternalName as relayMapChainName } from './relayUtils';

export function mapRelayChainToInternalName(relayChainName: string): string {
  return relayMapChainName(relayChainName);
}

// Helper function to check if a chain is a Relay chain
export function isRelayChain(chain: ChainNameOrId): boolean {

  try {
    getMultiProvider().getChainMetadata(chain);
    return false; // If Hyperlane has metadata, it's not a Relay chain
  } catch (error) {
    return true; // If Hyperlane doesn't have metadata, assume it's a Relay chain
  }
}

export function getChainDisplayName(chain: ChainName, shortName = false) {
  if (!chain) return 'Unknown';
  
  // First try to get from Hyperlane
  const metadata = tryGetChainMetadata(chain);
  if (metadata) {
    const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
    return displayName || metadata.displayName || toTitleCase(metadata.name);
  }
  
  return toTitleCase(chain);
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

  // If Hyperlane doesn't have it, check if it's a Relay chain and provide fallback metadata
  if (isRelayChain(chain)) {
    const chainStr = typeof chain === 'string' ? chain : chain.toString();
    
    // Create dynamic metadata for any Relay chain
    return {
      name: chainStr,
      displayName: toTitleCase(chainStr),
      displayNameShort: chainStr.toUpperCase().slice(0, 3),
      protocol: ProtocolType.Ethereum,
      chainId: 1, // Default fallback - will be overridden by API data
      domainId: 1, // Default fallback - will be overridden by API data
      nativeToken: { name: 'Unknown', symbol: 'Unknown', decimals: 18 },
      rpcUrls: [{ http: 'https://ethereum.rpc.hyperlane.xyz' }], // Default fallback
    };
  }

  return null;
}

export function getChainMetadata(chain: ChainNameOrId) {
  // First try to get from Hyperlane
  try {
    return getMultiProvider().getChainMetadata(chain);
  } catch (error) {
    // If Hyperlane doesn't have it, create dynamic Relay chain metadata
    if (isRelayChain(chain)) {
      const chainStr = typeof chain === 'string' ? chain : chain.toString();
      
      // Create dynamic metadata for any Relay chain
      return {
        name: chainStr,
        displayName: toTitleCase(chainStr),
        displayNameShort: chainStr.toUpperCase().slice(0, 3),
        protocol: ProtocolType.Ethereum,
        chainId: 1, // Default fallback - will be overridden by API data
        domainId: 1, // Default fallback - will be overridden by API data
        nativeToken: { name: 'Unknown', symbol: 'Unknown', decimals: 18 },
        rpcUrls: [{ http: 'https://ethereum.rpc.hyperlane.xyz' }], // Default fallback
      };
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
