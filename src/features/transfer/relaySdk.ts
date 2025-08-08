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
  wallet?: any; // Optional wallet client
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
    includeDefaultParameters: true, // Include default user and recipient parameters
    ...(params.wallet && { wallet: params.wallet }), // Include wallet if provided
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
 * Note: This function is deprecated - chain IDs should come from API data
 */
export function getRelayChainId(chainName: string): {
  mainnet: number | null;
  testnet: number | null;
} {
  // Hardcoded chain mappings for now - these should come from API data
  const chainIdMap: Record<string, { mainnet: number | null; testnet: number | null }> = {
    ethereum: { mainnet: 1, testnet: 1 },
    optimism: { mainnet: 10, testnet: 10 },
    arbitrum: { mainnet: 42161, testnet: 42161 },
    forma: { mainnet: 984122, testnet: 984123 },
    sketchpad: { mainnet: 984122, testnet: 984123 },
    linea: { mainnet: 59144, testnet: 59144 },
    bob: { mainnet: 60808, testnet: 60808 },
    animechain: { mainnet: 69000, testnet: 69000 },
    apex: { mainnet: 70700, testnet: 70700 },
    boss: { mainnet: 70701, testnet: 70701 },
    berachain: { mainnet: 80085, testnet: 80085 },
    blast: { mainnet: 81457, testnet: 81457 },
    plume: { mainnet: 16116, testnet: 16116 },
    taiko: { mainnet: 167008, testnet: 167008 },
    scroll: { mainnet: 534352, testnet: 534352 },
    'zero-network': { mainnet: 12052, testnet: 12052 },
    xai: { mainnet: 660279, testnet: 660279 },
    katana: { mainnet: 1261120, testnet: 1261120 },
  };

  return chainIdMap[chainName.toLowerCase()] || { mainnet: null, testnet: null };
}

/**
 * Get the currency address for a chain as expected by Relay API
 * Note: This function is deprecated - currency addresses should come from API data
 */
export function getNativeCurrency(chainName: string): string {
  const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

  // For Forma/Sketchpad, return TIA token address
  if (chainName === 'forma' || chainName === 'sketchpad') {
    return isMainnet
      ? '0x832d26B6904BA7539248Db4D58614251FD63dC05' // Mainnet TIA
      : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53'; // Testnet TIA
  }

  // For other chains, return native token address
  return '0x0000000000000000000000000000000000000000'; // Native token
}
