import {
  configureDynamicChains,
  createClient,
  MAINNET_RELAY_API,
  TESTNET_RELAY_API
} from '@reservoir0x/relay-sdk'

// Environment-based configuration
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
const isDevelopment = process.env.NODE_ENV === 'development'

// Simplified base configuration - let SDK handle chains
const relayConfig = {
  baseApiUrl: isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API,
  source: "forma-bridge"
  // Removed manual chains - SDK will use defaults or fetch dynamically
}

// Initialize the Relay client
let relayClient: ReturnType<typeof createClient> | null = null

export function initializeRelayClient() {
  if (!relayClient) {
    relayClient = createClient(relayConfig)
    
    if (isDevelopment) {
      console.log('Relay client initialized with default chains:', {
        network: isMainnet ? 'mainnet' : 'testnet',
        apiUrl: relayConfig.baseApiUrl
      })
    }
  }
  
  return relayClient
}

// Configure dynamic chains (this will fetch all supported chains from Relay)
export async function setupDynamicChains() {
  try {
    const dynamicChains = await configureDynamicChains()
    
    if (isDevelopment) {
      console.log('Dynamic chains configured from Relay:', dynamicChains.length)
    }
    
    return dynamicChains
  } catch (error) {
    console.error('Failed to configure dynamic chains:', error)
    // Return empty array if dynamic configuration fails
    return []
  }
}

// Get the initialized client
export function getRelayClient() {
  if (!relayClient) {
    return initializeRelayClient()
  }
  
  return relayClient
}

// Helper to check if client is ready
export function isRelayClientReady(): boolean {
  return relayClient !== null
} 