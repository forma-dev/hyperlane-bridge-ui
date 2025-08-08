import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { updateWagmiConfigWithRelayChains } from '../../../config/wagmi';
import { logger } from '../../../utils/logger';
// Import centralized Relay utilities
import {
  getRelayChainNames as relayGetChainNames,
  mapRelayChainToInternalName as relayMapChainName,
} from '../../chains/relayUtils';

import {
  getAllAvailableChains,
  getCurrenciesV2,
  getRelayClient,
  initializeRelayClient,
  isRelayClientReady,
  setupDynamicChains,
} from './RelayClient';

// Types for chain configuration (keeping existing interface for compatibility)
interface RelayChain {
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

// Context types
interface RelayContextType {
  client: ReturnType<typeof getRelayClient> | null;
  isReady: boolean;
  isMainnet: boolean;
  apiUrl: string;
  supportedChains: number[];
  relayChains: RelayChain[];
  isLoadingChains: boolean;
  refreshChains: () => Promise<void>;
  // SDK-based methods
  getQuote: (request: any) => Promise<any>;
  executeSwap: (request: any) => Promise<any>;
}

// Helper function to convert RelayChain to Wagmi format
function convertRelayChainToWagmiFormat(chain: RelayChain) {
  // For Relay chains, we need to construct a proper RPC URL
  // Most Relay chains will have their RPC URLs available through the Relay SDK
  let rpcUrl = 'https://rpc.ankr.com/eth'; // Default fallback

  // Map known chain IDs to their proper RPC URLs
  const chainRpcMap: Record<number, string> = {
    1: 'https://rpc.ankr.com/eth',
    10: 'https://rpc.ankr.com/optimism',
    56: 'https://rpc.ankr.com/bsc',
    137: 'https://rpc.ankr.com/polygon',
    250: 'https://rpc.ankr.com/fantom',
    8453: 'https://rpc.ankr.com/base',
    43114: 'https://rpc.ankr.com/avalanche',
    42161: 'https://rpc.ankr.com/arbitrum',
  };

  if (chainRpcMap[chain.id]) {
    rpcUrl = chainRpcMap[chain.id];
  }

  return {
    id: chain.id,
    name: chain.name,
    network: chain.name.toLowerCase().replace(/\s+/g, '-'),
    nativeCurrency: {
      decimals: chain.currency?.decimals || 18,
      name: chain.currency?.name || 'ETH',
      symbol: chain.currency?.symbol || 'ETH',
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
        webSocket: [],
      },
      public: {
        http: [rpcUrl],
        webSocket: [],
      },
    },
    ...(chain.iconUrl && {
      blockExplorers: {
        default: {
          name: 'Explorer',
          url: chain.iconUrl.includes('http') ? chain.iconUrl : `https://etherscan.io`,
        },
      },
    }),
  };
}

// Create context
const RelayContext = createContext<RelayContextType | null>(null);

// Provider component
export function RelayProvider({ children }: PropsWithChildren<unknown>) {
  const [client, setClient] = useState<ReturnType<typeof getRelayClient> | null>(null);
  const [relayChains, setRelayChains] = useState<RelayChain[]>([]);
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  const [apiUrl] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

  // Initialize Relay client
  useEffect(() => {
    const initClient = async () => {
      try {
        // Initialize the client with better error handling
        const relayClient = initializeRelayClient();
        setClient(relayClient);

        // Wait a bit for the client to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Setup dynamic chains with error handling
        try {
          await setupDynamicChains();
          // Also fetch chains for Wagmi config
          await fetchDynamicChains();
          setIsReady(true);
        } catch (chainError) {
          logger.warn('Failed to setup dynamic chains', chainError);
          setIsReady(true);
        }
      } catch (error) {
        logger.error('Failed to initialize Relay client', error);
        setIsReady(true);
      }
    };

    initClient();
  }, []);

  // Fetch supported chains using SDK
  const fetchDynamicChains = useCallback(async () => {
    try {
      setIsLoadingChains(true);

      // First try to get chains directly from the Relay API
      const directChains = await getAllAvailableChains();

      // Get currencies from v2 API
      const currenciesV2 = await getCurrenciesV2();

      if (directChains && directChains.length > 0) {
        // Convert direct API chains to our format
        const directFormattedChains: RelayChain[] = directChains
          .filter((chain: any) => {
            const isEnabled = !chain.disabled && chain.enabled !== false;
            const supportsDeposits =
              chain.depositEnabled === true || chain.depositEnabled !== false;
            const hasValidName = chain.name && chain.name.trim().length > 0;

            return isEnabled && supportsDeposits && hasValidName;
          })
          .map((chain: any) => {
            // Get currencies for this specific chain from the v2 API
            const chainCurrencies = currenciesV2.filter(
              (currency: any) => currency.chainId === chain.id,
            );

            // Remove duplicates by address
            const uniqueCurrencies = chainCurrencies.filter(
              (currency, index, self) =>
                index ===
                self.findIndex((c) => c.address.toLowerCase() === currency.address.toLowerCase()),
            );

            return {
              id: chain.id,
              name: chain.name,
              displayName: chain.displayName || chain.name,
              iconUrl: chain.iconUrl,
              logoUrl: chain.logoUrl,
              enabled: !chain.disabled && chain.enabled !== false,
              depositEnabled: chain.depositEnabled === true || chain.depositEnabled !== false,
              disabled: chain.disabled || chain.enabled === false,
              currency: {
                id: `${chain.name}-native`,
                symbol: chain.currency?.symbol || 'ETH',
                name: chain.currency?.name || chain.displayName || chain.name,
                address: chain.currency?.address || '0x0000000000000000000000000000000000000000',
                decimals: chain.currency?.decimals || 18,
                supportsBridging: true,
              },
              featuredTokens: chain.featuredTokens || [],
              erc20Currencies: chain.erc20Currencies || [],
              // Add the currencies from v2 API as additional tokens
              additionalTokens: uniqueCurrencies.map((currency: any) => ({
                id: currency.address,
                symbol: currency.symbol,
                name: currency.name,
                address: currency.address,
                decimals: currency.decimals,
                supportsBridging: true, // Assume they support bridging
                metadata: currency.metadata,
                source: 'v2-api',
              })),
              viemChain: null,
            };
          });

        setRelayChains(directFormattedChains);

        // Update Wagmi config with the fetched chains
        updateWagmiConfigWithRelayChains(directFormattedChains.map(convertRelayChainToWagmiFormat));
        return;
      }

      // Fallback to SDK chains if direct API fails
      if (client && client.chains && Array.isArray(client.chains) && client.chains.length > 0) {
        const chains = client.chains;

        // Convert SDK chains to our RelayChain format
        const formattedChains: RelayChain[] = chains
          .filter((chain: any) => {
            // More comprehensive filtering based on actual capabilities
            const isEnabled = !chain.disabled && chain.enabled !== false;
            const supportsDeposits =
              chain.depositEnabled === true || chain.depositEnabled !== false;
            const hasValidName = chain.name && chain.name.trim().length > 0;

            return isEnabled && supportsDeposits && hasValidName;
          })
          .map((chain: any) => ({
            id: chain.id,
            name: chain.name,
            displayName: chain.displayName || chain.name,
            iconUrl: chain.iconUrl,
            logoUrl: chain.logoUrl,
            enabled: !chain.disabled && chain.enabled !== false,
            depositEnabled: chain.depositEnabled === true || chain.depositEnabled !== false,
            disabled: chain.disabled || chain.enabled === false,
            currency: {
              id: `${chain.name}-native`,
              symbol: chain.currency?.symbol || 'ETH',
              name: chain.currency?.name || chain.displayName || chain.name,
              address: chain.currency?.address || '0x0000000000000000000000000000000000000000',
              decimals: chain.currency?.decimals || 18,
              supportsBridging: true,
            },
            featuredTokens: chain.featuredTokens || [],
            erc20Currencies: chain.erc20Currencies || [],
            viemChain: null,
          }));

        setRelayChains(formattedChains);

        // Update Wagmi config with the fetched chains
        updateWagmiConfigWithRelayChains(formattedChains.map(convertRelayChainToWagmiFormat));
        return;
      }

      // If no chains from either source, log error
      logger.warn('No chains available from API or SDK');
    } catch (error) {
      logger.error('Failed to fetch dynamic chains', error);
    } finally {
      setIsLoadingChains(false);
    }
  }, [client]);

  // No fallback chains needed - all chains come from API

  // Refresh chains
  const refreshChains = useCallback(async () => {
    await fetchDynamicChains();
  }, [fetchDynamicChains]);

  // SDK-based quote method
  const getQuote = useCallback(
    async (request: any) => {
      if (!client) {
        throw new Error('Relay client not initialized');
      }

      try {
        // Use SDK getQuote action as per documentation
        const quote = await client.actions.getQuote(request);
        return quote;
      } catch (error) {
        logger.error('Failed to get Relay quote via SDK:', error);
        throw error;
      }
    },
    [client],
  );

  // SDK-based swap execution
  const executeSwap = useCallback(
    async (request: any) => {
      if (!client) {
        throw new Error('Relay client not initialized');
      }

      try {
        // Use SDK execute action as per documentation
        const swapResult = await client.actions.execute(request);
        return swapResult;
      } catch (error) {
        logger.error('Failed to execute Relay swap via SDK:', error);
        throw error;
      }
    },
    [client],
  );

  // Fetch chains when client is ready
  useEffect(() => {
    if (isReady && client) {
      fetchDynamicChains();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, client]);

  // Context value
  const contextValue = useMemo(
    () => ({
      client,
      isReady: isReady && isRelayClientReady(),
      isMainnet,
      apiUrl,
      supportedChains: client?.chains?.map((chain: any) => chain.id) || [],
      relayChains,
      isLoadingChains,
      refreshChains,
      getQuote,
      executeSwap,
    }),
    [
      client,
      isReady,
      isMainnet,
      apiUrl,
      relayChains,
      isLoadingChains,
      refreshChains,
      getQuote,
      executeSwap,
    ],
  );

  return <RelayContext.Provider value={contextValue}>{children}</RelayContext.Provider>;
}

// Hook to use Relay context
export function useRelayContext() {
  const context = useContext(RelayContext);
  if (!context) {
    throw new Error('useRelayContext must be used within a RelayProvider');
  }
  return context;
}

// Hook to get supported chains
export function useRelaySupportedChains() {
  const { relayChains, isLoadingChains, refreshChains } = useRelayContext();
  return { relayChains, isLoadingChains, refreshChains };
}

// Compatibility functions for existing code
export function getRelayChainNames(relayChains: RelayChain[]): string[] {
  return relayGetChainNames(relayChains);
}

export function mapRelayChainToInternalName(relayChainName: string): string {
  return relayMapChainName(relayChainName);
}
