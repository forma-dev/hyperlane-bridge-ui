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

  // Seed with Forma and a stable set of popular EVM chains to avoid runtime provider remounts
  const seededChains: any[] = [forma];
  const transports: Record<number, any> = {
    [forma.id]: http(),
  };

  const addChain = (
    id: number,
    name: string,
    rpcHttp: string,
    currency: { name: string; symbol: string; decimals: number } = {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  ) => {
    seededChains.push({
      id,
      name,
      network: name.toLowerCase().replace(/\s+/g, '-'),
      nativeCurrency: currency,
      rpcUrls: {
        default: { http: [rpcHttp], webSocket: [] },
        public: { http: [rpcHttp], webSocket: [] },
      },
    });
    transports[id] = http(rpcHttp);
  };

  // Match RPCs from ChainSelect to ensure consistency
  addChain(1, 'Ethereum', 'https://rpc.ankr.com/eth');
  addChain(10, 'Optimism', 'https://rpc.ankr.com/optimism');
  addChain(42161, 'Arbitrum', 'https://rpc.ankr.com/arbitrum');
  addChain(8453, 'Base', 'https://rpc.ankr.com/base');
  addChain(43114, 'Avalanche', 'https://rpc.ankr.com/avalanche');
  addChain(137, 'Polygon', 'https://rpc.ankr.com/polygon');
  addChain(250, 'Fantom', 'https://rpc.ankr.com/fantom');
  addChain(56, 'BSC', 'https://rpc.ankr.com/bsc');

  return createConfig({
    chains: seededChains as any,
    transports,
  });
}

export function updateWagmiConfigWithRelayChains(relayChains: any[]) {
  // No-op: we now seed a stable set of chains at startup to avoid remounting WagmiProvider
  return getDynamicWagmiConfig();
}

export const wagmiConfig = getDynamicWagmiConfig();

export function onConfigUpdate(callback: () => void) {
  configUpdateCallback = callback;
}

export function getCurrentWagmiConfig() {
  return dynamicConfig || getDynamicWagmiConfig();
}
