import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';

import { forma } from './chain';

// We'll dynamically add Relay chains at runtime
const dynamicConfig: any = null;

export function getDynamicWagmiConfig() {
  if (dynamicConfig) {
    return dynamicConfig;
  }

  // Seed with Forma and a stable set of popular EVM chains to avoid runtime provider remounts
  const seededChains: any[] = [forma];
  const transports: Record<number, any> = {
    [forma.id]: http(),
  };

  return createConfig({
    chains: seededChains as any,
    transports,
  });
}

export function updateWagmiConfigWithRelayChains(_relayChains: any[]) {
  // No-op: we now seed a stable set of chains at startup to avoid remounting WagmiProvider
  return getDynamicWagmiConfig();
}

export const wagmiConfig = getDynamicWagmiConfig();

// Kept for backwards compatibility; no-op with seeded config
export function onConfigUpdate(_callback: () => void) {}

export function getCurrentWagmiConfig() {
  return dynamicConfig || getDynamicWagmiConfig();
}
