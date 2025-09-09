import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getAllRpcUrls, hasRpcOverride } from '../../../config/rpc-overrides';
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
  // Token loading methods
  loadTokensForChain: (chainId: number) => Promise<void>;
}

// Helper function to convert RelayChain to Wagmi format
function convertRelayChainToWagmiFormat(chain: RelayChain) {
  // For Relay chains, we need to construct a proper RPC URL
  // Use RPC URLs from the Relay SDK chain data
  const rpcUrl =
    chain.viemChain?.rpcUrls?.default?.http?.[0] || chain.viemChain?.rpcUrls?.public?.http?.[0];

  // Apply RPC overrides if configured for this chain
  let httpUrls: string[] = [];
  let webSocketUrls: string[] = [];

  if (hasRpcOverride(chain.id)) {
    // Use RPC override configuration
    const overrideUrls = getAllRpcUrls(chain.id);
    httpUrls = [
      ...overrideUrls, // Override URLs first
      ...(rpcUrl ? [rpcUrl] : []), // Original RPC as fallback
    ];
  } else {
    // Use original RPC URLs
    httpUrls = rpcUrl ? [rpcUrl] : [];
  }

  // Always include original WebSocket URLs as fallback
  webSocketUrls = [
    ...(chain.viemChain?.rpcUrls?.default?.webSocket || []),
    ...(chain.viemChain?.rpcUrls?.public?.webSocket || []),
  ];

  return {
    id: chain.id,
    name: chain.name,
    network: chain.name.toLowerCase().replace(/\s+/g, '-'),
    nativeCurrency: {
      decimals: chain.currency?.decimals ?? 18,
      name: chain.currency?.name || chain.name,
      symbol: chain.currency?.symbol || chain.name.toUpperCase(),
    },
    rpcUrls: {
      default: {
        http: httpUrls,
        webSocket: webSocketUrls,
      },
      public: {
        http: httpUrls,
        webSocket: webSocketUrls,
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

        // Setup dynamic chains with error handling
        try {
          await setupDynamicChains();
          await fetchChainsOnly();
          setIsReady(true); // Mark as ready after chains are loaded
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

  // Progressive loading: Fetch chains only first for immediate UI interaction
  const fetchChainsOnly = useCallback(async () => {
    try {
      setIsLoadingChains(true);

      // Fetch only chain data for immediate UI display
      const directChains = await getAllAvailableChains();

      if (directChains && directChains.length > 0) {
        // Create minimal chain data for immediate UI display
        const minimalChains: RelayChain[] = directChains
          .filter((chain: any) => {
            const hasValidName = chain.name && chain.name.trim().length > 0;
            return hasValidName;
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
              symbol: chain.currency?.symbol || chain.name.toUpperCase(),
              name: chain.currency?.name || chain.displayName || chain.name,
              address: chain.currency?.address || '0x0000000000000000000000000000000000000000',
              decimals: chain.currency?.decimals ?? 18,
              supportsBridging: true,
            },
            // Minimal token data - will be enhanced later
            featuredTokens: chain.featuredTokens || [],
            erc20Currencies: chain.erc20Currencies || [],
            additionalTokens: [],
            viemChain: null,
          }));

        setRelayChains(minimalChains);
        setIsLoadingChains(false);
      }
    } catch (error) {
      logger.error('Failed to fetch chains only', error);
      setIsLoadingChains(false);
    }
  }, []);

  // Enhance chains with full token metadata in background
  const enhanceWithTokenMetadata = useCallback(async (chainIds?: number[]) => {
    try {
      // Fetch token metadata in background
      const currenciesV2 = await getCurrenciesV2(chainIds);

      setRelayChains((prevChains) => {
        // Optimize data processing with Map for O(1) lookups
        const currenciesByChainId = new Map<number, any[]>();
        currenciesV2.forEach((currency: any) => {
          if (!currenciesByChainId.has(currency.chainId)) {
            currenciesByChainId.set(currency.chainId, []);
          }
          currenciesByChainId.get(currency.chainId)!.push(currency);
        });

        // Enhance existing chains with token metadata
        return prevChains.map((chain) => {
          const chainCurrencies = currenciesByChainId.get(chain.id) || [];

          // Remove duplicates by address using Map for better performance
          const uniqueCurrenciesMap = new Map<string, any>();
          chainCurrencies.forEach((currency: any) => {
            const key = currency.address.toLowerCase();
            if (!uniqueCurrenciesMap.has(key)) {
              uniqueCurrenciesMap.set(key, currency);
            }
          });
          const uniqueCurrencies = Array.from(uniqueCurrenciesMap.values());

          return {
            ...chain,
            // Enhance with token metadata
            additionalTokens: uniqueCurrencies.map((currency: any) => ({
              id: currency.address,
              symbol: currency.symbol,
              name: currency.name,
              address: currency.address,
              decimals: currency.decimals,
              supportsBridging: true,
              metadata: currency.metadata,
              source: 'v2-api',
            })),
          };
        });
      });
    } catch (error) {
      logger.error('Failed to enhance with token metadata', error);
    }
  }, []);

  // Load tokens for a specific chain when user selects it
  const loadTokensForChain = useCallback(
    async (chainId: number) => {
      try {
        // Check if we already have tokens for this chain
        const existingChain = relayChains.find((chain) => chain.id === chainId);
        if (
          existingChain &&
          existingChain.additionalTokens &&
          existingChain.additionalTokens.length > 0
        ) {
          return;
        }

        // Fetch tokens for this specific chain
        await enhanceWithTokenMetadata([chainId]);
      } catch (error) {
        logger.error(`Failed to load tokens for chain ${chainId}`, error);
      }
    },
    [relayChains, enhanceWithTokenMetadata],
  );

  // Fetch supported chains using SDK (fallback method)
  const fetchDynamicChains = useCallback(async () => {
    try {
      setIsLoadingChains(true);

      // Run both API calls in parallel for better performance
      const [directChains, currenciesV2] = await Promise.all([
        getAllAvailableChains(),
        getCurrenciesV2(),
      ]);

      if (directChains && directChains.length > 0) {
        // Optimize data processing with Map for O(1) lookups
        const currenciesByChainId = new Map<number, any[]>();
        currenciesV2.forEach((currency: any) => {
          if (!currenciesByChainId.has(currency.chainId)) {
            currenciesByChainId.set(currency.chainId, []);
          }
          currenciesByChainId.get(currency.chainId)!.push(currency);
        });

        // Convert direct API chains to our format
        const directFormattedChains: RelayChain[] = directChains
          .filter((chain: any) => {
            // Include chains with valid names regardless of enabled/deposit flags.
            const hasValidName = chain.name && chain.name.trim().length > 0;
            return hasValidName;
          })
          .map((chain: any) => {
            // Get currencies for this specific chain using Map lookup (O(1))
            const chainCurrencies = currenciesByChainId.get(chain.id) || [];

            // Remove duplicates by address using Map for better performance
            const uniqueCurrenciesMap = new Map<string, any>();
            chainCurrencies.forEach((currency: any) => {
              const key = currency.address.toLowerCase();
              if (!uniqueCurrenciesMap.has(key)) {
                uniqueCurrenciesMap.set(key, currency);
              }
            });
            const uniqueCurrencies = Array.from(uniqueCurrenciesMap.values());

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
                symbol: chain.currency?.symbol || chain.name.toUpperCase(),
                name: chain.currency?.name || chain.displayName || chain.name,
                address: chain.currency?.address || '0x0000000000000000000000000000000000000000',
                decimals: chain.currency?.decimals ?? 18,
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
            // Include chains with valid names regardless of enabled/deposit flags
            const hasValidName = chain.name && chain.name.trim().length > 0;
            return hasValidName;
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
              decimals: chain.currency?.decimals ?? 18,
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
        throw new Error('Bridge service is currently unavailable');
      }

      // Use SDK getQuote action as per documentation
      const quote = await client.actions.getQuote(request);
      return quote;
    },
    [client],
  );

  // SDK-based swap execution
  const executeSwap = useCallback(
    async (request: any) => {
      if (!client) {
        throw new Error('Bridge service is currently unavailable');
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

  // Removed this useEffect as it was causing the fallback method to run
  // and interfere with the progressive loading. Chains are now loaded
  // in the main initialization flow.

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
      loadTokensForChain,
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
      loadTokensForChain,
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
  const { relayChains, isLoadingChains, refreshChains, loadTokensForChain } = useRelayContext();
  return { relayChains, isLoadingChains, refreshChains, loadTokensForChain };
}

// Compatibility functions for existing code
export function getRelayChainNames(relayChains: RelayChain[]): string[] {
  return relayGetChainNames(relayChains);
}

export function mapRelayChainToInternalName(relayChainName: string): string {
  return relayMapChainName(relayChainName);
}
