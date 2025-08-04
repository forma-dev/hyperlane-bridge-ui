/**
 * Centralized utilities for Relay chain mapping and operations
 * This module consolidates all Relay chain mapping functions to eliminate code duplication
 */

export interface RelayChain {
  id: number;
  name: string;
  displayName: string;
  iconUrl?: string;
  logoUrl?: string;
  enabled: boolean;
  depositEnabled: boolean;
  disabled: boolean;
  currency: {
    id: string;
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    supportsBridging: boolean;
  };
  featuredTokens?: Array<{
    id: string;
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    supportsBridging: boolean;
    metadata?: {
      logoURI: string;
    };
    withdrawalFee?: number;
    depositFee?: number;
  }>;
  erc20Currencies?: Array<{
    id: string;
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    supportsBridging: boolean;
    metadata?: {
      logoURI: string;
    };
    withdrawalFee?: number;
    depositFee?: number;
  }>;
  additionalTokens?: Array<{
    id: string;
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    supportsBridging: boolean;
    metadata?: {
      logoURI: string;
    };
    source?: string;
  }>;
  viemChain: any;
}

/**
 * Maps Relay chain names to internal chain names used throughout the app
 * This is the single source of truth for chain name mapping
 */
export function mapRelayChainToInternalName(relayChainName: string): string {
  // Use the chain name directly as the internal name, but ensure it's lowercase
  // This allows all Relay chains to be used without hardcoded mappings
  return relayChainName.toLowerCase();
}

/**
 * Extracts chain names from an array of Relay chain objects
 */
export function getRelayChainNames(relayChains: RelayChain[]): string[] {
  return relayChains
    .filter((chain) => chain.enabled && chain.depositEnabled && !chain.disabled)
    .map((chain) => chain.name.toLowerCase());
}

/**
 * Checks if a chain is a Relay chain based on the provided relay chains array
 */
export function isRelayChain(chainName: string, relayChains: RelayChain[]): boolean {
  if (!chainName || !relayChains) return false;

  const chainStr = chainName.toLowerCase();

  // Check if it's in the relay chains array
  return relayChains.some(
    (chain) =>
      chain.name.toLowerCase() === chainStr ||
      mapRelayChainToInternalName(chain.name).toLowerCase() === chainStr,
  );
}

/**
 * Gets native token information for Relay chains from the Relay API
 * Falls back to hardcoded values only if API data is unavailable
 */
export function getRelayNativeTokenInfo(chainName: string, relayChains?: any[]) {
  // Hardcoded values for known chains (prioritized for correct symbols)
  const nativeTokens: Record<string, { symbol: string; decimals: number; name: string }> = {
    ethereum: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    arbitrum: { symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
    optimism: { symbol: 'OP', decimals: 18, name: 'Optimism' },
  };

  // Check if we have hardcoded values for this chain
  const hardcodedInfo = nativeTokens[chainName.toLowerCase()];
  if (hardcodedInfo) {
    return hardcodedInfo;
  }

  // If we have Relay API data and no hardcoded values, use it
  if (relayChains && relayChains.length > 0) {
    const relayChain = relayChains.find((rc) => {
      const internalName = mapRelayChainToInternalName(rc.name);
      return internalName === chainName.toLowerCase();
    });

    if (relayChain?.currency) {
      return {
        symbol: relayChain.currency.symbol || 'ETH',
        decimals: relayChain.currency.decimals || 18,
        name: relayChain.currency.name || relayChain.name || 'Unknown',
      };
    }
  }

  // Final fallback
  return { symbol: 'ETH', decimals: 18, name: 'Unknown' };
}

/**
 * Gets the currency symbol for a Relay chain
 */
export function getRelayCurrencySymbol(chainName: string): string {
  const tokenInfo = getRelayNativeTokenInfo(chainName);
  return tokenInfo?.symbol || 'ETH'; // Default to ETH
}

// Removed VERIFIED_WORKING_RELAY_CHAINS constant and getVerifiedWorkingRelayChains function
// to allow all available Relay chains to be displayed
