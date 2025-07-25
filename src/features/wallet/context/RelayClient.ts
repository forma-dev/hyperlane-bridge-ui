import {
  MAINNET_RELAY_API,
  TESTNET_RELAY_API,
  configureDynamicChains,
  createClient,
} from '@reservoir0x/relay-sdk';

// Environment-based configuration
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// Simplified base configuration - let SDK handle chains
const relayConfig = {
  baseApiUrl: isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API,
  source: 'forma-bridge',
  // Removed manual chains - SDK will use defaults or fetch dynamically
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

    return dynamicChains;
  } catch (error) {
    // Return empty array if dynamic configuration fails
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
