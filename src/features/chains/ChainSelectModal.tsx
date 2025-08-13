import { MAINNET_RELAY_API, TESTNET_RELAY_API } from '@reservoir0x/relay-sdk';
import { useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';
import { logger } from '../../utils/logger';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';

import { mapRelayChainToInternalName } from './relayUtils';
import { getChainDisplayName } from './utils';

// Helper function to get reliable token icons
const getTokenIconUrl = (token: any): string | null => {
  // Use our proxy API to avoid CORS issues
  const getProxiedUrl = (url: string) => {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  // First priority: Use the token's logoURI if it exists and looks valid
  if (token.metadata?.logoURI) {
    const logoUrl = token.metadata.logoURI;
    // Check if it's a valid URL
    if (logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
      return getProxiedUrl(logoUrl);
    }
  }

  // Since we're only showing tokens with proper metadata from Relay API,
  // we should always have a logoURI. If not, it's an edge case.
  if (!token.metadata?.logoURI) {
    return null;
  }

  return null;
};

export function ChainSelectListModal({
  isOpen,
  close,
  chains,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  chains: ChainName[];
  onSelect: (chain: ChainName, token?: any) => void;
}) {
  const { relayChains, isLoadingChains } = useRelaySupportedChains();
  const [selectedChain, setSelectedChain] = useState<ChainName | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [chainSearchTerm, setChainSearchTerm] = useState<string>('');
  const [loadedTokens, setLoadedTokens] = useState<{ [chainId: string]: any[] }>({});
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [hasLoadedAllTokens, setHasLoadedAllTokens] = useState<{ [chainId: string]: boolean }>({});
  const [searchResults, setSearchResults] = useState<{ [chainId: string]: any[] }>({});
  const [isSearching, setIsSearching] = useState(false);

  // Helper function to determine if a chain is a Relay chain
  const isRelayChain = (chainName: string): boolean => {
    if (!chainName || !relayChains?.length) return false;

    return relayChains.some((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName && internalName === chainName.toLowerCase();
    });
  };

  // Function to fetch tokens for a specific network with pagination
  const fetchTokensForNetwork = async (chainId: number, offset: number = 0) => {
    try {
      const { getCurrenciesV2: _getCurrenciesV2 } = await import('../wallet/context/RelayClient');

      // Create a custom request with offset for pagination
      const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
      const baseUrl = isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API;

      const requestBody: any = {
        limit: 100,
        offset: offset,
        chainIds: [chainId],
      };

      const response = await fetch(`${baseUrl}/currencies/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        return data || [];
      } else {
        logger.error(
          'Failed to fetch tokens',
          new Error(`${response.status} ${response.statusText}`),
        );
        return [];
      }
    } catch (error) {
      logger.error('Failed to fetch tokens for network', error);
      return [];
    }
  };

  // Function to fetch first 20 tokens for a network
  const fetchAllTokensForNetwork = async (chainId: number) => {
    setIsLoadingTokens(true);

    try {
      // Get featured tokens from RelayContext first
      const relayChain = relayChains.find((chain) => chain.id === chainId);
      const featuredTokens =
        relayChain?.featuredTokens?.filter((token) => token.metadata && token.metadata.logoURI) ||
        [];

      // Fetch first 20 tokens
      const firstBatch = await fetchTokensForNetwork(chainId, 0);

      // Combine featured tokens with first batch
      const allTokens = [...featuredTokens, ...firstBatch];

      // Filter for valid tokens with metadata and remove duplicates
      const validTokens = allTokens.filter((token, index, self) => {
        const hasMetadata = token.metadata && token.metadata.logoURI;
        const isUnique =
          index === self.findIndex((t) => t.address.toLowerCase() === token.address.toLowerCase());
        return hasMetadata && isUnique;
      });

      // Limit to 20 tokens total
      const limitedTokens = validTokens.slice(0, 20);

      setLoadedTokens((prev) => ({
        ...prev,
        [chainId]: limitedTokens,
      }));

      setHasLoadedAllTokens((prev) => ({
        ...prev,
        [chainId]: true,
      }));
    } catch (error) {
      logger.error('Failed to fetch tokens for network', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Function to search tokens with term parameter
  const searchTokensWithTerm = async (chainId: number, searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults((prev) => ({ ...prev, [chainId]: [] }));
      return;
    }

    setIsSearching(true);

    try {
      const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
      const baseUrl = isMainnet ? MAINNET_RELAY_API : TESTNET_RELAY_API;

      const requestBody: any = {
        limit: 20,
        term: searchTerm.trim(),
        chainIds: [chainId],
      };

      const response = await fetch(`${baseUrl}/currencies/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();

        // Filter for valid tokens with metadata
        const validTokens = (data || []).filter(
          (token: any) => token.metadata && token.metadata.logoURI,
        );

        setSearchResults((prev) => ({
          ...prev,
          [chainId]: validTokens,
        }));
      } else {
        logger.error(
          'Failed to search tokens',
          new Error(`${response.status} ${response.statusText}`),
        );
        setSearchResults((prev) => ({ ...prev, [chainId]: [] }));
      }
    } catch (error) {
      logger.error('Failed to search tokens', error);
      setSearchResults((prev) => ({ ...prev, [chainId]: [] }));
    } finally {
      setIsSearching(false);
    }
  };

  // Direct search on value change (no debounce per UX request)

  // Function to handle network selection
  const handleNetworkSelection = (chain: ChainName) => {
    if (isRelayChain(chain)) {
      setSelectedChain(chain);

      // Get the Relay chain data to find the chainId
      const relayChain = relayChains.find((relayChain) => {
        const internalName = mapRelayChainToInternalName(relayChain.name);
        return internalName === chain.toLowerCase();
      });

      if (relayChain && relayChain.id) {
        // Clear previous search
        setSearchTerm('');

        // Check if we already have tokens for this network
        if (!loadedTokens[relayChain.id] || !hasLoadedAllTokens[relayChain.id]) {
          fetchAllTokensForNetwork(relayChain.id);
        }
      }
    } else {
      // For non-Relay chains, select immediately
      onSelect(chain);
      close();
    }
  };

  // Get tokens for the selected chain
  const getTokensForChain = (chainName: string) => {
    if (!isRelayChain(chainName)) return { featuredTokens: [], displayTokens: [], allTokens: [] };

    const relayChain = relayChains.find((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === chainName.toLowerCase();
    });

    if (!relayChain) return { featuredTokens: [], displayTokens: [], allTokens: [] };

    // Get featured tokens (top tokens in Relay UI) - available immediately
    const featuredTokens = (relayChain.featuredTokens || []).filter(
      (token) => token.metadata && token.metadata.logoURI,
    );

    // Get loaded tokens for this network
    const loadedTokensForChain = loadedTokens[relayChain.id] || [];

    // Get first 12 tokens for display (excluding featured tokens)
    const displayTokens = loadedTokensForChain
      .filter(
        (token) =>
          !featuredTokens.some(
            (featured) => featured.address.toLowerCase() === token.address.toLowerCase(),
          ),
      )
      .slice(0, 12);

    // Filter tokens based on search term (prefix search)
    const filteredTokens = searchTerm
      ? loadedTokensForChain.filter((token) => {
          const searchTermLower = searchTerm.toLowerCase();
          const symbol = token.symbol.toLowerCase();
          const name = token.name.toLowerCase();
          const address = token.address.toLowerCase();

          return (
            symbol.startsWith(searchTermLower) ||
            name.startsWith(searchTermLower) ||
            address.startsWith(searchTermLower)
          );
        })
      : displayTokens;

    return {
      featuredTokens,
      displayTokens: filteredTokens,
      allTokens: loadedTokensForChain, // For search functionality
    };
  };

  // Separate chains by protocol
  const hyperlaneChains = chains.filter((chain) => !isRelayChain(chain));
  const relayChainsList = chains
    .filter((chain) => isRelayChain(chain))
    .sort((a, b) => {
      const aName = getChainDisplayName(a, false);
      const bName = getChainDisplayName(b, false);
      return aName.localeCompare(bName);
    });

  // Filter chains based on search term
  const filteredRelayChains = chainSearchTerm
    ? relayChainsList.filter((chain) => {
        const chainName = getChainDisplayName(chain, false).toLowerCase();
        const searchTerm = chainSearchTerm.toLowerCase();

        return chainName.startsWith(searchTerm);
      })
    : relayChainsList;

  // Popular chains (ETH, ARB, OP)
  const popularChains: ChainName[] = ['ethereum', 'arbitrum', 'optimism'];
  const popularChainsList = popularChains.filter((chain) =>
    relayChainsList.some((relayChain) => relayChain.toLowerCase() === chain.toLowerCase()),
  );

  // Other chains (excluding popular ones)
  const otherChainsList = filteredRelayChains.filter(
    (chain) => !popularChains.includes(chain.toLowerCase()),
  );

  const onSelectChain = (chain: ChainName) => {
    return () => {
      handleNetworkSelection(chain);
    };
  };

  const renderChainItem = (chain: ChainName, protocol: 'hyperlane' | 'relay') => {
    // For Relay chains, get the display name from the Relay data
    let displayName = getChainDisplayName(chain, false);

    if (protocol === 'relay') {
      const relayChain = relayChains.find((relayChain) => {
        const internalName = mapRelayChainToInternalName(relayChain.name);
        return internalName === chain.toLowerCase();
      });

      if (relayChain && relayChain.displayName) {
        displayName = relayChain.displayName;
      }
    }

    const isSelected = selectedChain === chain;

    return (
      <button
        key={chain}
        className={`w-full flex items-center text-sm px-6 py-2 border-l-4 ${
          isSelected
            ? 'bg-blue-50 border-blue-500'
            : 'border-transparent hover:bg-blue-50 hover:border-blue-200'
        }`}
        onClick={onSelectChain(chain)}
      >
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center">
            <ChainLogo chainName={chain} size={32} background={false} />
            <span className="ml-2 font-medium text-sm leading-5 text-black">{displayName}</span>
          </div>
          <div className="flex items-center space-x-2"></div>
        </div>
      </button>
    );
  };

  return (
    <Modal width={'max-w-[800px]'} isOpen={isOpen} title="Select Network & Token" close={close}>
      {/* Loading state for entire modal */}
      {isLoadingChains ? (
        <div className="mt-4 flex items-center justify-center h-[500px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="mt-4 flex h-[500px]">
          {/* Left side - Chain selection */}
          <div className="w-1/2 pr-4">
            <div className="h-full overflow-y-auto">
              {/* Chain search bar */}
              <div className="mb-4 px-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search chains"
                    value={chainSearchTerm}
                    onChange={(e) => setChainSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-l-lg rounded-r-none bg-gray-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                {/* When searching, show only filtered results without sections */}
                {chainSearchTerm ? (
                  <>
                    {filteredRelayChains.length > 0 && (
                      <>{filteredRelayChains.map((chain) => renderChainItem(chain, 'relay'))}</>
                    )}
                  </>
                ) : (
                  <>
                    {/* Hyperlane Chains Section */}
                    {hyperlaneChains.length > 0 && (
                      <>
                        <div className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 bg-white z-10">
                          Hyperlane Networks
                        </div>
                        {hyperlaneChains.map((chain) => renderChainItem(chain, 'hyperlane'))}
                      </>
                    )}

                    {/* Popular Chains Section */}
                    {popularChainsList.length > 0 && (
                      <>
                        {hyperlaneChains.length > 0 && (
                          <div className="border-t border-gray-200 my-2" />
                        )}
                        <div className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 bg-white z-10">
                          Popular Chains
                        </div>
                        {popularChainsList.map((chain) => renderChainItem(chain, 'relay'))}
                      </>
                    )}

                    {/* Other Relay Chains Section */}
                    {otherChainsList.length > 0 && (
                      <>
                        {(hyperlaneChains.length > 0 || popularChainsList.length > 0) && (
                          <div className="border-t border-gray-200 my-2" />
                        )}
                        <div className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 bg-white z-10">
                          Chains A-Z
                        </div>
                        {otherChainsList.map((chain) => renderChainItem(chain, 'relay'))}
                      </>
                    )}

                    {/* No separation needed if only one type */}
                    {hyperlaneChains.length === 0 &&
                      popularChainsList.length === 0 &&
                      otherChainsList.length === 0 &&
                      chains.length > 0 && (
                        <>
                          {chains.map((chain) =>
                            renderChainItem(chain, isRelayChain(chain) ? 'relay' : 'hyperlane'),
                          )}
                        </>
                      )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Token selection */}
          <div className="w-1/2">
            <div className="h-full overflow-y-auto">
              {selectedChain ? (
                <div>
                  {isRelayChain(selectedChain) ? (
                    <div className="space-y-4">
                      {/* Search bar at the very top */}
                      <div className="mb-4 mr-4">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                          </div>
                          <input
                            type="text"
                            placeholder="Search for a token or paste address"
                            value={searchTerm}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setSearchTerm(newValue);

                              // Get chainId for the selected chain
                              const chainId = selectedChain
                                ? relayChains.find(
                                    (chain) =>
                                      mapRelayChainToInternalName(chain.name) ===
                                      selectedChain.toLowerCase(),
                                  )?.id
                                : null;

                              if (chainId) {
                                if (!newValue.trim()) {
                                  // If search is cleared, reset states immediately
                                  setIsSearching(false);
                                  setSearchResults((prev) => ({ ...prev, [chainId]: [] }));
                                } else {
                                  setIsSearching(true);
                                  searchTokensWithTerm(chainId, newValue);
                                }
                              }
                            }}
                            className="w-full pl-10 pr-6 py-2 border border-gray-300 rounded-l-lg rounded-r-none bg-gray-100 focus:outline-none"
                          />
                          {searchTerm && (
                            <button
                              onClick={() => {
                                setSearchTerm('');
                                setIsSearching(false);
                                // Clear search results for current chain
                                const chainId = selectedChain
                                  ? relayChains.find(
                                      (chain) =>
                                        mapRelayChainToInternalName(chain.name) ===
                                        selectedChain.toLowerCase(),
                                    )?.id
                                  : null;
                                if (chainId) {
                                  setSearchResults((prev) => ({ ...prev, [chainId]: [] }));
                                }
                              }}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              <svg
                                className="h-5 w-5 text-gray-400 hover:text-gray-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Token content */}
                      {(() => {
                        const tokenData = getTokensForChain(selectedChain);
                        
                        // Apply local search filter to featured tokens if user is typing
                        let filteredFeaturedTokens = tokenData.featuredTokens;
                        if (searchTerm.trim()) {
                          const searchLower = searchTerm.toLowerCase();
                          filteredFeaturedTokens = tokenData.featuredTokens.filter(
                            (token) =>
                              token.symbol?.toLowerCase().includes(searchLower) ||
                              token.name?.toLowerCase().includes(searchLower) ||
                              token.address?.toLowerCase().includes(searchLower)
                          );
                        }
                        
                        return (
                          <>
                            {/* Featured tokens - with local search filtering */}
                            {!searchTerm.trim() || filteredFeaturedTokens.length > 0 ? (
                              filteredFeaturedTokens.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold text-gray-500 mb-3">
                                  Featured Tokens
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {filteredFeaturedTokens.map((token) => (
                                    <button
                                      key={token.address}
                                      onClick={() => {
                                        onSelect(selectedChain, token);
                                        close();
                                        setSelectedChain(null);
                                      }}
                                      className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="relative">
                                        {getTokenIconUrl(token) ? (
                                          <img
                                            src={getTokenIconUrl(token)!}
                                            alt={token.symbol}
                                            className="w-6 h-6 rounded-full"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                            <span className="text-xs font-bold text-white">
                                              {token.symbol?.charAt(0)?.toUpperCase() || '?'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-sm font-medium text-black">
                                        {token.symbol}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )) : null}

                            {/* Loading state for additional tokens */}
                            {isLoadingTokens && (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            )}

                            {/* Additional tokens section */}
                            {!isLoadingTokens &&
                              (() => {
                                const chainId = selectedChain
                                  ? relayChains.find(
                                      (chain) =>
                                        mapRelayChainToInternalName(chain.name) ===
                                        selectedChain.toLowerCase(),
                                    )?.id
                                  : null;

                                // If searching, use search results
                                if (searchTerm && chainId) {
                                  const searchResultsForChain = searchResults[chainId] || [];
                                  const displayTokens = searchResultsForChain.slice(0, 20);

                                  return displayTokens.length > 0 ? (
                                    <div className="pr-4">
                                      <div className="space-y-1">
                                        {displayTokens.map((token) => (
                                          <button
                                            key={token.address}
                                            onClick={() => {
                                              onSelect(selectedChain, token);
                                              close();
                                              setSelectedChain(null);
                                            }}
                                            className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg transition-colors"
                                          >
                                            <div className="flex items-center space-x-3">
                                              {getTokenIconUrl(token) ? (
                                                <img
                                                  src={getTokenIconUrl(token)!}
                                                  alt={token.symbol}
                                                  className="w-8 h-8 rounded-full"
                                                />
                                              ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                  <span className="text-xs font-bold text-white">
                                                    {token.symbol?.charAt(1)?.toUpperCase() || '?'}
                                                  </span>
                                                </div>
                                              )}
                                              <div>
                                                <div className="font-medium text-sm text-black flex items-center">
                                                  {token.symbol}
                                                  {token.symbol === 'ETH' && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                      Gas Token
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {token.name} {token.address.slice(0, 2)}...
                                                  {token.address.slice(-4)}
                                                </div>
                                              </div>
                                            </div>
                                            {token.symbol === 'ETH' && (
                                              <div className="text-right">
                                                <div className="text-sm font-medium text-black">
                                                  $22.00
                                                </div>
                                                <div className="text-xs text-gray-500">0.0059</div>
                                              </div>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : isSearching ? (
                                    <div className="flex items-center justify-center py-4">
                                      <div className="text-sm text-gray-500">Searching...</div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-4">
                                      <div className="text-sm text-gray-500">No tokens found</div>
                                    </div>
                                  );
                                }

                                // If not searching with API, show regular tokens with local filtering
                                const currentTokens = chainId ? loadedTokens[chainId] || [] : [];

                                // Get featured tokens for this chain
                                const relayChain = relayChains.find(
                                  (chain) => chain.id === chainId,
                                );
                                const featuredTokens =
                                  relayChain?.featuredTokens?.filter(
                                    (token) => token.metadata && token.metadata.logoURI,
                                  ) || [];

                                // Filter out featured tokens from current tokens
                                let nonFeaturedTokens = currentTokens.filter(
                                  (token) =>
                                    !featuredTokens.some(
                                      (featured) =>
                                        featured.address.toLowerCase() ===
                                        token.address.toLowerCase(),
                                    ),
                                );

                                // Apply local search filter if user is typing (for immediate feedback)
                                if (searchTerm.trim()) {
                                  const searchLower = searchTerm.toLowerCase();
                                  nonFeaturedTokens = nonFeaturedTokens.filter(
                                    (token) =>
                                      token.symbol?.toLowerCase().includes(searchLower) ||
                                      token.name?.toLowerCase().includes(searchLower) ||
                                      token.address?.toLowerCase().includes(searchLower)
                                  );
                                }

                                // Limit to 20 tokens
                                const displayTokens = nonFeaturedTokens.slice(0, 20);

                                return displayTokens.length > 0 ? (
                                  <div className="pr-4">
                                    <div className="space-y-1">
                                      {displayTokens.map((token) => (
                                        <button
                                          key={token.address}
                                          onClick={() => {
                                            onSelect(selectedChain, token);
                                            close();
                                            setSelectedChain(null);
                                          }}
                                          className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                          <div className="flex items-center space-x-3">
                                            {getTokenIconUrl(token) ? (
                                              <img
                                                src={getTokenIconUrl(token)!}
                                                alt={token.symbol}
                                                className="w-8 h-8 rounded-full"
                                              />
                                            ) : (
                                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                <span className="text-xs font-bold text-white">
                                                  {token.symbol?.charAt(1)?.toUpperCase() || '?'}
                                                </span>
                                              </div>
                                            )}
                                            <div>
                                              <div className="font-medium text-sm text-black flex items-center">
                                                {token.symbol}
                                                {token.symbol === 'ETH' && (
                                                  <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                    Gas Token
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                {token.name} {token.address.slice(0, 2)}...
                                                {token.address.slice(-4)}
                                              </div>
                                            </div>
                                          </div>
                                          {token.symbol === 'ETH' && (
                                            <div className="text-right">
                                              <div className="text-sm font-medium text-black">
                                                $22.00
                                              </div>
                                              <div className="text-xs text-gray-500">0.0059</div>
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <p>Token selection not available for Hyperlane networks</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <p>Select a network to view available tokens</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
