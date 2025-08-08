import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { GasPrice } from '@cosmjs/stargate';
import { MainWalletBase } from '@cosmos-kit/core';
import { wallets as mmWallets } from '@cosmos-kit/cosmos-extension-metamask';
// import { wallets as cosmostationWallets } from '@cosmos-kit/cosmostation';
// import { wallets as keplrWallets } from '@cosmos-kit/keplr';
import { wallets as keplrWallets } from '@cosmos-kit/keplr-extension';
//import { wallets as leapWallets } from '@cosmos-kit/leap';
import { wallets as leapWallets } from '@cosmos-kit/leap-extension';
import { wallets as leapSnapWallets } from '@cosmos-kit/leap-metamask-cosmos-snap';
import { ChainProvider } from '@cosmos-kit/react';
import '@interchain-ui/react/styles';
import { PropsWithChildren, useMemo } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_URL } from '../../../consts/app';
import { config } from '../../../consts/config';
import { getCosmosKitConfig } from '../../chains/metadata';

const theme = extendTheme({
  fonts: {
    heading: `'Plus Jakarta Sans', 'Helvetica', 'sans-serif'`,
    body: `'Plus Jakarta Sans', 'Helvetica', 'sans-serif'`,
  },
});

export function CosmosWalletContext({ children }: PropsWithChildren<unknown>) {
  const { chains, assets } = getCosmosKitConfig();
  // Build wallet list defensively to avoid noisy init errors when extensions aren't installed
  const availableWallets = useMemo(() => {
    const list: MainWalletBase[] = [];
    // Keplr
    list.push(...(keplrWallets as MainWalletBase[]));
    // Leap extension only if present
    if (typeof window !== 'undefined' && (window as any).leap) {
      list.push(...(leapWallets as MainWalletBase[]));
    }
    // Leap MetaMask Cosmos Snap only if MetaMask is present
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask) {
      list.push(...(leapSnapWallets as MainWalletBase[]));
    }
    // MetaMask Cosmos extension only if MetaMask is present
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask) {
      list.push(...(mmWallets as MainWalletBase[]));
    }
    return list;
  }, []);
  // TODO replace Chakra here with a custom modal for ChainProvider
  // Using Chakra + @cosmos-kit/react instead of @cosmos-kit/react-lite adds about 600Kb to the bundle
  return (
    <ChakraProvider theme={theme}>
      <ChainProvider
        chains={chains}
        assetLists={assets}
        wallets={availableWallets}
        // Avoid throwing to the error overlay due to missing extensions in dev
        throwErrors={false}
        walletConnectOptions={{
          signClient: {
            projectId: config.walletConnectProjectId,
            metadata: {
              name: APP_NAME,
              description: APP_DESCRIPTION,
              url: APP_URL,
              icons: [],
            },
          },
        }}
        signerOptions={{
          signingCosmwasm: () => {
            return {
              // TODO cosmos get gas price from registry or RPC
              gasPrice: GasPrice.fromString('0.025token'),
            };
          },
          signingStargate: () => {
            return {
              // TODO cosmos get gas price from registry or RPC
              gasPrice: GasPrice.fromString('0.1tia'),
            };
          },
        }}
        endpointOptions={{
          isLazy: true,
        }}
        modalTheme={{
          defaultTheme: 'light',
          overrides: {
            'connect-modal': {
              bg: { dark: '#000000', light: '#FFFFFF' },
            },
          },
        }}
      >
        {children}
      </ChainProvider>
    </ChakraProvider>
  );
}
