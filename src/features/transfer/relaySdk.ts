/**
 * Get supported chains from Relay SDK
 */
export async function getRelaySupportedChains(): Promise<any[]> {
  try {
    const { getClient } = await import('@reservoir0x/relay-sdk');
    const client = getClient();

    if (!client) {
      throw new Error('Relay client not initialized');
    }

    // Get chains from the SDK client
    const chains = client.chains;

    return chains || [];
  } catch (error) {
    return [];
  }
}

// might be useful later
/*
export async function getRelaySupportedCurrencies(chainId: number): Promise<any[]> {
  try {
    const { getClient } = await import('@reservoir0x/relay-sdk');
    const client = getClient();
    
    if (!client) {
      throw new Error('Relay client not initialized');
    }
    
    // Find the chain in the SDK client
    const chain = client.chains.find(c => c.id === chainId);
    if (!chain) {
      logger.debug(`Chain ${chainId} not found in Relay SDK`);
      return [];
    }
    
    // Return the chain's currency information
    const currencies = [chain.currency];
    logger.debug(`Relay SDK currencies for chain ${chainId}:`, currencies);
    
    return currencies;
  } catch (error) {
    logger.error(`Failed to fetch Relay supported currencies for chain ${chainId}:`, error);
    return [];
  }
}
*/

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
    gas: {
      currency: {
        symbol: string;
        name: string;
        decimals: number;
        chainId: number;
        address: string;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
      minimumAmount: string;
    };
    relayer: {
      currency: {
        symbol: string;
        name: string;
        decimals: number;
        chainId: number;
        address: string;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
      minimumAmount: string;
    };
    app: {
      currency: {
        symbol: string;
        name: string;
        decimals: number;
        chainId: number;
        address: string;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
      minimumAmount: string;
    };
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
  const { getClient } = await import('@reservoir0x/relay-sdk');
  const client = getClient();

  if (!client) {
    throw new Error('Relay client not initialized');
  }

  // Use SDK getQuote method
  const quote = await client.actions.getQuote({
    chainId: params.originChainId,
    toChainId: params.destinationChainId,
    currency: params.originCurrency,
    toCurrency: params.destinationCurrency,
    amount: params.amount,
    tradeType: (params.tradeType || 'EXACT_INPUT') as
      | 'EXACT_INPUT'
      | 'EXACT_OUTPUT'
      | 'EXPECTED_OUTPUT',
    user: params.user,
    recipient: params.recipient,
  });

  // Convert SDK response to our expected format
  return quote as unknown as RelayQuoteResponse;
}

/**
 * Execute a cross-chain swap using Relay SDK
 */
export async function executeRelaySwap(
  params: RelaySwapParams,
  wallet?: any,
): Promise<RelaySwapResponse> {
  const { getClient } = await import('@reservoir0x/relay-sdk');
  const client = getClient();

  if (!client) {
    throw new Error('Relay client not initialized');
  }

  // Convert our params to SDK format
  const sdkParams = {
    chainId: params.origins[0].chainId,
    toChainId: params.destinationChainId,
    currency: params.origins[0].currency,
    toCurrency: params.destinationCurrency,
    amount: params.origins[0].amount,
    tradeType: params.tradeType,
    user: params.user,
    recipient: params.recipient,
  };

  // First get a quote
  const quote = await client.actions.getQuote(sdkParams);

  // Then execute the quote
  const result = await client.actions.execute({
    quote,
    wallet,
  });

  // Convert SDK response to our expected format
  return result as unknown as RelaySwapResponse;
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
  wallet,
}: {
  user: string;
  recipient: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  wallet?: any;
}): Promise<RelaySwapResponse> {
  return executeRelaySwap(
    {
      user,
      origins: [
        {
          chainId: originChainId,
          currency: originCurrency,
          amount,
        },
      ],
      destinationCurrency,
      destinationChainId,
      tradeType,
      recipient,
    },
    wallet,
  );
}

/**
 * Map internal chain names to Relay chain IDs
 * Returns both mainnet and testnet options
 */
export function getRelayChainId(chainName: string): {
  mainnet: number | null;
  testnet: number | null;
} {
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
  // For Relay API, use the actual token addresses for branded tokens
  // This matches what Relay expects for each chain
  const currencyMap: Record<string, string> = {
    ethereum: '0x0000000000000000000000000000000000000000', // Native ETH
    optimism: '0x4200000000000000000000000000000000000042', // OP token
    arbitrum: '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB token
    forma: '0x0000000000000000000000000000000000000000', // Native TIA
    sketchpad: '0x0000000000000000000000000000000000000000', // Native TIA
  };

  return currencyMap[chainName.toLowerCase()] || '0x0000000000000000000000000000000000000000';
}
