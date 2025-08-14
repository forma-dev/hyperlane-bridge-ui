import {
  MAINNET_RELAY_API,
  TESTNET_RELAY_API,
  configureDynamicChains,
  createClient,
} from '@reservoir0x/relay-sdk';

import { logger } from '../../../utils/logger';

// Environment-based configuration
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// Try different configuration approaches to get all available chains
const relayConfig = {
  baseApiUrl: isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API,
  // Try without source restriction to get all available chains
  // source: 'forma-bridge',
  // Try to configure for all available chains
  chains: [], // Empty array to force SDK to fetch all available chains
  // Try to disable any filtering
  includeDisabled: true,
  includeTestnets: true,
};

// Initialize the Relay client
let relayClient: ReturnType<typeof createClient> | null = null;

export function initializeRelayClient() {
  if (!relayClient) {
    relayClient = createClient(relayConfig);
  }

  return relayClient;
}

// Configure dynamic chains (this will fetch all supported chains from Relay)
export async function setupDynamicChains() {
  try {
    const dynamicChains = await configureDynamicChains();

    // Update the client with the dynamic chains
    if (relayClient && dynamicChains && dynamicChains.length > 0) {
      // The configureDynamicChains function should have already updated the client
      // But let's make sure the client has the updated chains
    }

    return dynamicChains;
  } catch (error) {
    logger.error('Failed to setup dynamic chains', error);
    // Return empty array if dynamic configuration fails
    return [];
  }
}

// Try to get all available chains directly from the Relay API
export async function getAllAvailableChains() {
  try {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    const baseUrl = isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API;

    // This is a direct API call to get all available chains
    const response = await fetch(`${baseUrl}/chains`);
    if (response.ok) {
      const data = await response.json();

      // The API returns an object with a 'chains' property containing the array
      const chains = data.chains || [];

      // Return all chains; downstream filtering determines selectability.
      return chains;
    }

    return [];
  } catch (error) {
    logger.error('Failed to get chains from direct API', error);
    return [];
  }
}

// Get currencies from the v2 API endpoint
export async function getCurrenciesV2(chainIds?: number[]) {
  try {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    const baseUrl = isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API;

    // Minimal request body with only required parameters + chainIds
    const requestBody: any = {
      limit: 100,
    };

    // Add chainIds if provided
    if (chainIds && chainIds.length > 0) {
      requestBody.chainIds = chainIds;
    }

    const response = await fetch(`${baseUrl}/currencies/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      logger.error(
        'Failed to fetch currencies',
        new Error(`${response.status} ${response.statusText}`),
      );
      return [];
    }
  } catch (error) {
    logger.error('Failed to fetch currencies', error);
    return [];
  }
}

// Get the initialized client
export function getRelayClient() {
  if (!relayClient) {
    return initializeRelayClient();
  }

  return relayClient;
}

// Helper to check if client is ready
export function isRelayClientReady(): boolean {
  return relayClient !== null;
}

// Dynamic balance fetching using Relay SDK's configureDynamicChains
export async function getRelayBalance(
  chainId: number,
  address: string,
  tokenAddress?: string,
): Promise<{
  balance: string;
  decimals: number;
  symbol: string;
  name: string;
} | null> {
  try {
    // Use Relay SDK's configureDynamicChains to get all supported chains with their RPC URLs
    const { configureDynamicChains } = await import('@reservoir0x/relay-sdk');
    const { ethers } = await import('ethers');

    // Get all dynamically configured chains
    const dynamicChains = await configureDynamicChains();

    // Find the chain for this chainId
    const chain = dynamicChains.find((c) => c.viemChain?.id === chainId);

    const defaultUrls = [...(chain?.viemChain?.rpcUrls?.default?.http || [])];
    const publicUrls = [...(chain?.viemChain?.rpcUrls?.public?.http || [])];

    // Keep original Relay SDK ordering but filter out only the most problematic RPCs
    const orderedUrls: string[] = Array.from(
      new Set([...(defaultUrls || []), ...(publicUrls || [])]),
    ).filter((url) => !/mainnet\.base\.org/.test(url)); // Only filter base.org for 429s

    // Add fallback RPCs if none found
    if (orderedUrls.length === 0) {
      const fallbackRpcs: Record<number, string[]> = {
        8453: ['https://base.llamarpc.com', 'https://base-mainnet.diamondswap.org/rpc'],
        1: ['https://eth.llamarpc.com'],
        137: ['https://polygon.llamarpc.com'],
        10: ['https://optimism.llamarpc.com'],
      };

      if (fallbackRpcs[chainId]) {
        orderedUrls.push(...fallbackRpcs[chainId]);
      }
    }

    // Do not attempt to use or switch the user's wallet for balance reads; rely on RPCs below

    if (orderedUrls.length === 0) {
      logger.error('No RPC URL available for chainId', new Error(String(chainId)));
      return null;
    }

    // Try Relay-provided RPC URLs in order
    let lastError: unknown = undefined;
    for (const rpcUrl of orderedUrls) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);

        let balance: string;
        let decimals: number;
        let symbol: string;
        let name: string;

        const isErc20 =
          !!tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000';

        if (isErc20) {
          const tokenContract = new ethers.Contract(
            tokenAddress,
            [
              'function balanceOf(address owner) view returns (uint256)',
              'function decimals() view returns (uint8)',
              'function symbol() view returns (string)',
              'function name() view returns (string)',
            ],
            provider,
          );

          const [balanceResult, decimalsResult, symbolResult, nameResult] = await Promise.all([
            tokenContract.balanceOf(address),
            tokenContract.decimals(),
            tokenContract.symbol(),
            tokenContract.name(),
          ]);

          balance = balanceResult.toString();
          decimals = decimalsResult;
          symbol = symbolResult;
          name = nameResult;
        } else {
          const nativeBal = await provider.getBalance(address);
          balance = nativeBal?.toString?.() || String(nativeBal);

          const nativeCurrency = chain?.viemChain?.nativeCurrency;
          decimals = nativeCurrency?.decimals || 18;
          symbol = nativeCurrency?.symbol || 'ETH';
          name = nativeCurrency?.name || 'Ether';
        }

        return { balance, decimals, symbol, name };
      } catch (err) {
        lastError = err;
        // try next URL
      }
    }

    logger.error('Failed to fetch balance from all sources', lastError);
    return null;
  } catch (error) {
    logger.error('Failed to fetch Relay balance', error);
    return null;
  }
}
