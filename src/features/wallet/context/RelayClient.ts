import {
  MAINNET_RELAY_API,
  TESTNET_RELAY_API,
  configureDynamicChains,
  createClient,
} from '@reservoir0x/relay-sdk';

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
    console.error('Failed to setup dynamic chains:', error);
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
      
      // Filter to only enabled chains
      const enabledChains = chains.filter((chain: any) => 
        chain.enabled !== false && !chain.disabled
      );
      
      return enabledChains;
    }
    
    return [];
  } catch (error) {
    console.error('Failed to get chains from direct API:', error);
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
      limit: 100
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
      console.error('Failed to fetch currencies:', response.status, response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Failed to fetch currencies:', error);
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
