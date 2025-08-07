import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';

import { forma } from './chain';

// We'll dynamically add Relay chains at runtime
let dynamicConfig: any = null;
let configUpdateCallback: (() => void) | null = null;

export function getDynamicWagmiConfig() {
  if (dynamicConfig) {
    return dynamicConfig;
  }
  
  // Start with just Forma as base config
  return createConfig({
    chains: [forma],
    transports: {
      [forma.id]: http(),
    },
  });
}

export function updateWagmiConfigWithRelayChains(relayChains: any[]) {
  const chains = [forma];
  const transports: Record<number, any> = {
    [forma.id]: http(),
  };

  // Add all Relay chains dynamically
  for (const chain of relayChains) {
    if (chain.id && chain.name && chain.rpcUrls?.default?.http?.[0]) {
      chains.push({
        id: chain.id,
        name: chain.name,
        network: chain.name.toLowerCase().replace(/\s+/g, '-'),
        nativeCurrency: {
          decimals: 18,
          name: chain.nativeCurrency?.name || 'ETH',
          symbol: chain.nativeCurrency?.symbol || 'ETH',
        },
        rpcUrls: {
          default: {
            http: [chain.rpcUrls.default.http[0]],
            webSocket: [],
          },
          public: {
            http: [chain.rpcUrls.default.http[0]],
            webSocket: [],
          },
        },
        ...(chain.blockExplorers && {
          blockExplorers: {
            default: {
              name: 'Explorer',
              url: chain.blockExplorers.default.url,
            },
          },
        }),
      });
      
      transports[chain.id] = http(chain.rpcUrls.default.http[0]);
    }
  }

  dynamicConfig = createConfig({
    chains: chains as any,
    transports,
  });
  
  // Notify any listeners that the config has been updated
  if (configUpdateCallback) {
    configUpdateCallback();
  }
  
  return dynamicConfig;
}

export const wagmiConfig = getDynamicWagmiConfig();

export function onConfigUpdate(callback: () => void) {
  configUpdateCallback = callback;
}

export function getCurrentWagmiConfig() {
  return dynamicConfig || getDynamicWagmiConfig();
}
