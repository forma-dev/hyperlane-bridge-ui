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
  viemChain: any;
}

/**
 * Maps Relay chain names to internal chain names used throughout the app
 * This is the single source of truth for chain name mapping
 */
export function mapRelayChainToInternalName(relayChainName: string): string {
  const nameMapping: Record<string, string> = {
    // Standard Relay chain names
    'Ethereum': 'ethereum',
    'Arbitrum': 'arbitrum',
    'Arbitrum One': 'arbitrum',
    'Optimism': 'optimism',
    
    // Lowercase variations
    'ethereum': 'ethereum',
    'arbitrum-one': 'arbitrum',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    
    // Additional variations
    'arbitrum one': 'arbitrum',
  };
  
  return nameMapping[relayChainName] || relayChainName.toLowerCase();
}

/**
 * Extracts chain names from an array of Relay chain objects
 */
export function getRelayChainNames(relayChains: RelayChain[]): string[] {
  return relayChains.map(chain => chain.name);
}

/**
 * Checks if a chain is a Relay chain based on the provided relay chains array
 */
export function isRelayChain(chainName: string, relayChains: RelayChain[]): boolean {
  if (!chainName || !relayChains) return false;
  
  const chainStr = chainName.toLowerCase();
  
  // Check if it's in the relay chains array
  return relayChains.some(chain => 
    chain.name.toLowerCase() === chainStr || 
    mapRelayChainToInternalName(chain.name).toLowerCase() === chainStr
  );
}

/**
 * Gets native token information for Relay chains from the Relay API
 * Falls back to hardcoded values only if API data is unavailable
 */
export function getRelayNativeTokenInfo(chainName: string, relayChains?: any[]) {
  // Hardcoded values for known chains (prioritized for correct symbols)
  const nativeTokens: Record<string, { symbol: string; decimals: number; name: string }> = {
    'ethereum': { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    'arbitrum': { symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
    'optimism': { symbol: 'OP', decimals: 18, name: 'Optimism' },
  };
  
  // Check if we have hardcoded values for this chain
  const hardcodedInfo = nativeTokens[chainName.toLowerCase()];
  if (hardcodedInfo) {
    return hardcodedInfo;
  }
  
  // If we have Relay API data and no hardcoded values, use it
  if (relayChains && relayChains.length > 0) {
    const relayChain = relayChains.find(rc => {
      const internalName = mapRelayChainToInternalName(rc.name);
      return internalName === chainName.toLowerCase();
    });
    
    if (relayChain?.currency) {
      return {
        symbol: relayChain.currency.symbol || 'ETH',
        decimals: relayChain.currency.decimals || 18,
        name: relayChain.currency.name || relayChain.name || 'Unknown'
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

/**
 * List of verified working chains for Forma bridging
 */
export const VERIFIED_WORKING_RELAY_CHAINS = [
  'ethereum',
  'optimism',
  'arbitrum',
];

/**
 * Filters relay chains to only include verified working ones
 */
export function getVerifiedWorkingRelayChains(relayChains: RelayChain[]): RelayChain[] {
  return relayChains.filter(chain => {
    const internalName = mapRelayChainToInternalName(chain.name);
    return VERIFIED_WORKING_RELAY_CHAINS.includes(internalName) && 
           chain.depositEnabled && 
           !chain.disabled;
  });
} 