import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { logger } from '../../../utils/logger';
// Import centralized Relay utilities
import {
  getRelayChainNames as relayGetChainNames,
  mapRelayChainToInternalName as relayMapChainName,
} from '../../chains/relayUtils';

import {
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

// Create context
const RelayContext = createContext<RelayContextType | null>(null);

// Provider component
export function RelayProvider({ children }: PropsWithChildren<unknown>) {
  const [client, setClient] = useState<ReturnType<typeof getRelayClient> | null>(null);
  const [supportedChains, setSupportedChains] = useState<number[]>([]);
  const [relayChains, setRelayChains] = useState<RelayChain[]>([]);
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Environment configuration
  const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
  const apiUrl = client?.baseApiUrl || '';

  // Fallback chain configuration (moved before useEffect to fix dependencies)
  const setFallbackChains = useCallback(() => {
    const fallbackChains: RelayChain[] = [
      {
        id: 1,
        name: 'ethereum',
        displayName: 'Ethereum',
        iconUrl: undefined,
        logoUrl: undefined,
        enabled: true,
        depositEnabled: true,
        disabled: false,
        currency: {
          id: 'ethereum-native',
          symbol: 'ETH',
          name: 'Ethereum',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          supportsBridging: true,
        },
        viemChain: null,
      },
      {
        id: 10,
        name: 'optimism',
        displayName: 'Optimism',
        iconUrl: undefined,
        logoUrl: undefined,
        enabled: true,
        depositEnabled: true,
        disabled: false,
        currency: {
          id: 'optimism-native',
          symbol: 'ETH',
          name: 'Optimism',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          supportsBridging: true,
        },
        viemChain: null,
      },
      {
        id: 42161,
        name: 'arbitrum',
        displayName: 'Arbitrum',
        iconUrl: undefined,
        logoUrl: undefined,
        enabled: true,
        depositEnabled: true,
        disabled: false,
        currency: {
          id: 'arbitrum-native',
          symbol: 'ETH',
          name: 'Arbitrum',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          supportsBridging: true,
        },
        viemChain: null,
      },
    ];

    const chainIds = fallbackChains.map((chain) => chain.id);
    setSupportedChains(chainIds);
    setRelayChains(fallbackChains);
  }, []);

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
        } catch (chainError) {
          logger.warn('Failed to setup dynamic chains, continuing with static config:', chainError);
          // Continue without dynamic chains - this shouldn't break the app
        }

        setIsReady(true);
      } catch (error) {
        logger.error('Failed to initialize Relay client:', error);
        // Don't let Relay client failure break the entire app
        setIsReady(false);
        // Set fallback chains so Relay functionality has some basic config
        setFallbackChains();
      }
    };

    initClient();
  }, [setFallbackChains]);

  // Setup fallback chains on error or when client fails
  useEffect(() => {
    if (!isReady && !isLoadingChains && relayChains.length === 0) {
      setFallbackChains();
    }
  }, [isReady, isLoadingChains, relayChains.length, setFallbackChains]);

  // Fetch supported chains using SDK
  const fetchDynamicChains = useCallback(async () => {
    try {
      setIsLoadingChains(true);

      // First try to get chains from the initialized client
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
            id: chain.id || chain.chainId,
            name: (chain.name || '').toLowerCase(),
            displayName: chain.displayName || chain.name || '',
            iconUrl: chain.iconUrl,
            logoUrl: chain.logoUrl,
            enabled: chain.enabled !== false,
            depositEnabled: chain.depositEnabled === true || chain.depositEnabled !== false, // Use actual API data
            disabled: chain.disabled || false,
            currency: {
              id: chain.nativeCurrency?.id || '',
              symbol: chain.nativeCurrency?.symbol || '',
              name: chain.nativeCurrency?.name || '',
              address:
                chain.nativeCurrency?.address || '0x0000000000000000000000000000000000000000',
              decimals: chain.nativeCurrency?.decimals || 18,
              supportsBridging: true,
            },
            viemChain: chain.viemChain || null,
          }));

        const chainIds = formattedChains.map((chain) => chain.id);
        setSupportedChains(chainIds);
        setRelayChains(formattedChains);
      } else {
        // If no chains available from client, try dynamic configuration
        await setupDynamicChains();

        // After dynamic setup, check if we now have chains
        if (client && client.chains && client.chains.length > 0) {
          // Recursive call to process the newly configured chains
          return fetchDynamicChains();
        } else {
          logger.warn('No chains available from SDK, using fallback configuration');
          setFallbackChains();
        }
      }
    } catch (error) {
      logger.error('Failed to fetch chains from SDK:', error);
      // Fallback to basic chains
      setFallbackChains();
    } finally {
      setIsLoadingChains(false);
    }
  }, [client, setFallbackChains]);

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
  }, [isReady, client, fetchDynamicChains]);

  // Context value
  const contextValue = useMemo(
    () => ({
      client,
      isReady: isReady && isRelayClientReady(),
      isMainnet,
      apiUrl,
      supportedChains,
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
      supportedChains,
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
