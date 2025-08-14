import { ChainNameOrId } from '@hyperlane-xyz/sdk';
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
  try {
    return getChainMetadata(chain).protocol === ProtocolType.Ethereum;
  } catch {
    return true;
  }
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

  // Do not fabricate metadata for Relay chains
  return null;
}

export function getChainMetadata(chain: ChainNameOrId) {
  // First try to get from Hyperlane; otherwise throw (callers should use tryGetChainMetadata)
  return getMultiProvider().getChainMetadata(chain);
}

export function tryGetChainProtocol(chain: ChainNameOrId) {
  const metadata = tryGetChainMetadata(chain);
  // Default to EVM for Relay/non-Hyperlane chains
  return metadata?.protocol ?? ProtocolType.Ethereum;
}

export function getChainProtocol(chain: ChainNameOrId) {
  // Prefer Hyperlane metadata when available
  const metadata = tryGetChainMetadata(chain);
  if (metadata) return metadata.protocol;
  // For Relay (non-Hyperlane) chains, default to EVM protocol
  return ProtocolType.Ethereum;
}

export function formatAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const prefix = address.slice(0, 8); // First 8 characters
  const suffix = address.slice(-4); // Last 4 characters

  return `${prefix}...${suffix}`;
}
