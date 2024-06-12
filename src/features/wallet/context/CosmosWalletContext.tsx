import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { GasPrice } from '@cosmjs/stargate';
import { MainWalletBase } from '@cosmos-kit/core';
import { wallets as mmWallets } from '@cosmos-kit/cosmos-extension-metamask';
import { wallets as cosmostationWallets } from '@cosmos-kit/cosmostation';
import { wallets as keplrWallets } from '@cosmos-kit/keplr';
// import { wallets as keplrWallets } from '@cosmos-kit/keplr-extension';
import { wallets as leapWallets } from '@cosmos-kit/leap';
// import { wallets as leapWallets } from '@cosmos-kit/leap-extension';
import { wallets as leapSnapWallets } from '@cosmos-kit/leap-metamask-cosmos-snap';
import { ChainProvider } from '@cosmos-kit/react';
import '@interchain-ui/react/styles';
import { PropsWithChildren } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_URL } from '../../../consts/app';
import { config } from '../../../consts/config';
import { getCosmosKitConfig } from '../../chains/metadata';

const theme = extendTheme({
  fonts: {
    heading: `'IBM Plex Mono', 'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
    body: `'IBM Plex Mono', 'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
  },
});

export function CosmosWalletContext({ children }: PropsWithChildren<unknown>) {
  const { chains, assets } = getCosmosKitConfig();
  // const leapWithoutSnap = leapWallets.filter((wallet) => !wallet.walletName.includes('snap'));
  // TODO replace Chakra here with a custom modal for ChainProvider
  // Using Chakra + @cosmos-kit/react instead of @cosmos-kit/react-lite adds about 600Kb to the bundle
  return (
    <ChakraProvider theme={theme}>
      <ChainProvider
        chains={chains}
        assetLists={assets}
        wallets={
          [
            ...keplrWallets,
            ...cosmostationWallets,
            ...leapWallets,
            ...leapSnapWallets,
            ...mmWallets,
          ] as MainWalletBase[]
        }
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
        modalTheme={{
          defaultTheme: 'dark',
          overrides: {
            'connect-modal': {
              bg: { dark: '#000', light: '#000' },
            },
          },
        }}
      >
        {children}
      </ChainProvider>
    </ChakraProvider>
  );
}
