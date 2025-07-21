import { logger } from '../../utils/logger';

// Try mainnet first, fallback to testnet if needed
const RELAY_API_BASE = 'https://api.relay.link';
const RELAY_TESTNET_API_BASE = 'https://api.testnets.relay.link';

/**
 * Get supported chains from Relay API
 */
export async function getRelaySupportedChains(): Promise<any[]> {
  try {
    const response = await fetch(`${RELAY_API_BASE}/chains`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Relay chains: ${response.status}`);
    }
    const data = await response.json();
    logger.debug('Relay supported chains:', data);
    
    // Extract chains array from response object
    const chains = data.chains || data;
    return Array.isArray(chains) ? chains : [];
  } catch (error) {
    logger.error('Failed to fetch Relay supported chains:', error);
    return [];
  }
}

/**
 * Get supported currencies for a specific chain from Relay API
 */
export async function getRelaySupportedCurrencies(chainId: number): Promise<any[]> {
  try {
    const response = await fetch(`${RELAY_API_BASE}/chains/${chainId}/currencies`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Relay currencies for chain ${chainId}: ${response.status}`);
    }
    const currencies = await response.json();
    logger.debug(`Relay supported currencies for chain ${chainId}:`, currencies);
    return currencies;
  } catch (error) {
    logger.error(`Failed to fetch Relay supported currencies for chain ${chainId}:`, error);
    return [];
  }
}

export interface RelayQuoteParams {
  user: string;
  recipient: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string; // in wei for EVM chains
  tradeType?: string;
}

export interface RelayQuoteResponse {
  id: string;
  steps: Array<{
    id: string;
    action: string;
    description: string;
    items: Array<{
      status: string;
      data: any;
    }>;
  }>;
  fees: {
    gas: string;
    relayer: string;
    app: string;
  };
  details: {
    rate: string;
    currencyIn: {
      currency: {
        symbol: string;
        name: string;
        decimals: number;
        chainId: number;
        address: string;
      };
      amount: string;
    };
    currencyOut: {
      currency: {
        symbol: string;
        name: string;
        decimals: number;
        chainId: number;
        address: string;
      };
      amount: string;
    };
    totalTime: string;
  };
}

export interface RelaySwapParams {
  user: string;
  origins: Array<{
    chainId: number;
    currency: string;
    amount: string;
  }>;
  destinationCurrency: string;
  destinationChainId: number;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  recipient?: string;
  refundTo?: string;
  txs?: Array<any>;
  txsGasLimit?: number;
  partial?: boolean;
  referrer?: string;
  gasLimitForDepositSpecifiedTxs?: number;
}

export interface RelaySwapResponse {
  steps: Array<{
    id: string;
    action: string;
    description: string;
    kind: string;
    requestId?: string;
    items: Array<{
      status: string;
      data: {
        from: string;
        to: string;
        data: string;
        value: string;
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
        chainId: number;
      };
      check?: {
        endpoint: string;
        method: string;
      };
    }>;
  }>;
  fees?: {
    breakdown: Array<any>;
  };
  balances?: any;
  details?: any;
}

/**
 * Get a quote from Relay API for cross-chain token conversion
 */
export async function getRelayQuote(params: RelayQuoteParams): Promise<RelayQuoteResponse> {
  // Use ONLY required fields per API reference
  const requestBody = {
    user: params.user,
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    originCurrency: params.originCurrency,
    destinationCurrency: params.destinationCurrency,
    amount: params.amount,
    tradeType: params.tradeType || 'EXACT_INPUT',
    // Add recipient as it's commonly needed (but optional per docs)
    recipient: params.recipient,
  };

  // Determine which API to use based on chain IDs
  const useTestnet = shouldUseTestnet(params.originChainId, params.destinationChainId);
  const apiBase = useTestnet ? RELAY_TESTNET_API_BASE : RELAY_API_BASE;
  const url = `${apiBase}/quote`;
  
  logger.debug('Fetching Relay quote:', { url, requestBody, useTestnet });
  logger.debug('Currency mapping check:', {
    originChain: 'unknown',
    destinationChain: 'unknown', 
    originCurrency: requestBody.originCurrency,
    destinationCurrency: requestBody.destinationCurrency,
    isMainnet: process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
  });

  // Special test: if this involves Forma, try a known working chain pair first to test our format
  const isFormaTransfer = requestBody.originChainId === 984122 || requestBody.destinationChainId === 984122;
  
  if (isFormaTransfer) {
    logger.debug('Testing with known working chain pair first: ETH → Polygon USDC');
    
    // First, check basic API connectivity
    try {
      const chains = await getRelaySupportedChains();
      logger.debug('Successfully fetched chains, API is accessible');
      
      // Find ETH and Polygon chains
      const ethChain = chains.find(c => c.chainId === 1);
      const polygonChain = chains.find(c => c.chainId === 137);
      logger.debug('Ethereum chain info:', ethChain);
      logger.debug('Polygon chain info:', polygonChain);
      
      // Try to get supported currencies
      const ethCurrencies = await getRelaySupportedCurrencies(1);
      const polygonCurrencies = await getRelaySupportedCurrencies(137);
      logger.debug('Ethereum supported currencies:', ethCurrencies);
      logger.debug('Polygon supported currencies:', polygonCurrencies);
    } catch (error) {
      logger.debug('Failed to fetch chain/currency info:', error);
    }
    
    const testRequestBody = {
      ...requestBody,
      originChainId: 1, // Ethereum
      destinationChainId: 137, // Polygon
      originCurrency: '0x0000000000000000000000000000000000000000', // ETH
      destinationCurrency: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon (different address)
    };
    
    logger.debug('Test request body:', testRequestBody);
    
    try {
      const testResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRequestBody),
      });
      
      if (testResponse.ok) {
        const testData = await testResponse.json();
        logger.debug('✅ Test with ETH → Polygon USDC worked! Format is correct, issue is likely Forma chain support');
        logger.debug('Test response sample:', testData);
      } else {
        const testErrorText = await testResponse.text();
        logger.debug('❌ Test with ETH → Polygon USDC also failed:', testErrorText);
        
        // Try with only required fields
        const simplifiedTestBody = {
          user: testRequestBody.user,
          originChainId: testRequestBody.originChainId,
          destinationChainId: testRequestBody.destinationChainId,
          originCurrency: testRequestBody.originCurrency,
          destinationCurrency: testRequestBody.destinationCurrency,
          amount: testRequestBody.amount,
          tradeType: 'EXACT_INPUT',
          recipient: testRequestBody.recipient,
        };
        
        logger.debug('Trying simplified request:', simplifiedTestBody);
        
        const simplifiedResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(simplifiedTestBody),
        });
        
        if (simplifiedResponse.ok) {
          const simplifiedData = await simplifiedResponse.json();
          logger.debug('✅ Simplified request worked!', simplifiedData);
        } else {
          const simplifiedErrorText = await simplifiedResponse.text();
          logger.debug('❌ Simplified request also failed:', simplifiedErrorText);
          
          // Try with different currency formats
          const alternativeTests = [
            {
              ...simplifiedTestBody,
              originCurrency: 'ETH', // Try symbol instead of address
              destinationCurrency: 'USDC',
              description: 'Using symbols (ETH → USDC)'
            },
            {
              ...simplifiedTestBody,
              originCurrency: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Alternative native ETH address
              destinationCurrency: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
              description: 'Using 0xeeee... for ETH'
            },
            {
              ...simplifiedTestBody,
              originCurrency: 'ethereum:0x0000000000000000000000000000000000000000', // Chain-prefixed format
              destinationCurrency: 'polygon:0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
              description: 'Using chain-prefixed format'
            }
          ];
          
          for (const altTest of alternativeTests) {
            logger.debug(`Trying ${altTest.description}:`, altTest);
            try {
              const altResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(altTest),
              });
              
              if (altResponse.ok) {
                const altData = await altResponse.json();
                logger.debug(`✅ ${altTest.description} worked!`, altData);
                break; // Stop on first success
              } else {
                const altErrorText = await altResponse.text();
                logger.debug(`❌ ${altTest.description} failed:`, altErrorText);
              }
            } catch (altError) {
              logger.debug(`❌ ${altTest.description} threw error:`, altError);
            }
          }
        }
      }
    } catch (testError) {
      logger.debug('Test request failed:', testError);
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // If mainnet fails with 404, try testnet
      if (response.status === 404 && !useTestnet) {
        logger.debug('Mainnet failed, trying testnet...');
        return await getRelayQuoteWithTestnet(requestBody);
      }
      
      throw new Error(`Relay quote API error: ${response.status} ${errorText}`);
    }

    const data: RelayQuoteResponse = await response.json();
    logger.debug('Relay quote response:', data);
    
    return data;
  } catch (error) {
    logger.error('Failed to fetch Relay quote:', error);
    throw error;
  }
}

/**
 * Fallback function to try testnet API
 */
async function getRelayQuoteWithTestnet(requestBody: any): Promise<RelayQuoteResponse> {
  const url = `${RELAY_TESTNET_API_BASE}/quote`;
  
  logger.debug('Trying testnet Relay quote:', { url, requestBody });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Relay testnet quote API error: ${response.status} ${errorText}`);
  }

  const data: RelayQuoteResponse = await response.json();
  logger.debug('Relay testnet quote response:', data);
  
  return data;
}

/**
 * Execute a cross-chain swap using Relay API (NEW ENDPOINT)
 */
export async function executeRelaySwap(params: RelaySwapParams): Promise<RelaySwapResponse> {
  // Use the NEW endpoint path
  const url = `${RELAY_API_BASE}/execute/swap/multi-input`;
  
  logger.debug('Executing Relay swap with NEW API:', { url, params });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Relay swap API error: ${response.status} ${errorText}`);
    }

    const data: RelaySwapResponse = await response.json();
    logger.debug('Relay swap response:', data);
    
    return data;
  } catch (error) {
    logger.error('Failed to execute Relay swap:', error);
    throw error;
  }
}

/**
 * Helper function for easier migration from old API to new API
 * Converts single-origin parameters to the new multi-origin format
 */
export async function executeRelaySwapSingleOrigin({
  user,
  recipient,
  originChainId,
  destinationChainId,
  originCurrency,
  destinationCurrency,
  amount,
  tradeType = 'EXACT_INPUT',
}: {
  user: string;
  recipient: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
}): Promise<RelaySwapResponse> {
  return executeRelaySwap({
    user,
    origins: [
      {
        chainId: originChainId,
        currency: originCurrency,
        amount,
      }
    ],
    destinationCurrency,
    destinationChainId,
    tradeType,
    recipient,
  });
}

/**
 * Determine if we should use testnet or mainnet API
 */
function shouldUseTestnet(originChainId: number, destinationChainId: number): boolean {
  const testnetChainIds = [11155111, 80001, 421614, 11155420, 84532, 984123]; // Updated to include sketchpad
  return testnetChainIds.includes(originChainId) || testnetChainIds.includes(destinationChainId);
}

/**
 * Map internal chain names to Relay chain IDs
 * Returns both mainnet and testnet options
 */
export function getRelayChainId(chainName: string): { mainnet: number | null; testnet: number | null } {
  const chainMaps = {
    ethereum: { mainnet: 1, testnet: 11155111 }, // Sepolia
    polygon: { mainnet: 137, testnet: 80001 }, // Mumbai  
    arbitrum: { mainnet: 42161, testnet: 421614 }, // Arbitrum Sepolia
    optimism: { mainnet: 10, testnet: 11155420 }, // OP Sepolia
    base: { mainnet: 8453, testnet: 84532 }, // Base Sepolia
    forma: { mainnet: 984122, testnet: 984123 }, // Forma mainnet vs sketchpad testnet
    sketchpad: { mainnet: null, testnet: 984123 }, // Sketchpad is testnet only
  };

  const chainName_lower = chainName.toLowerCase();
  return chainMaps[chainName_lower] || { mainnet: null, testnet: null };
}

/**
 * Get the currency address for a chain as expected by Relay API
 */
export function getNativeCurrency(chainName: string): string {
  const currencyMap: Record<string, string> = {
    // Use branded token addresses for chains that have them
    ethereum: '0x0000000000000000000000000000000000000000', // Native ETH
    optimism: '0x4200000000000000000000000000000000000042', // OP token
    polygon: '0x0000000000000000000000000000000000001010', // MATIC token
    arbitrum: '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB token
    base: '0xd07379a755A8f11B57610154861D694b2A0f615a', // BASE token (if available)
    bsc: '0x0000000000000000000000000000000000000000', // Native BNB
    avalanche: '0x0000000000000000000000000000000000000000', // Native AVAX
    // For Forma/Sketchpad, use native TIA
    forma: '0x0000000000000000000000000000000000000000', // Native TIA
    sketchpad: '0x0000000000000000000000000000000000000000', // Native TIA
  };

  const tokenAddress = currencyMap[chainName.toLowerCase()] || '0x0000000000000000000000000000000000000000';
  
  console.log('🪙 CURRENCY FOR RELAY API:', {
    chainName,
    tokenAddress,
    isNativeToken: tokenAddress === '0x0000000000000000000000000000000000000000'
  });

  return tokenAddress;
} 