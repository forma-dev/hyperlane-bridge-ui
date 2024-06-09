import { DisclaimerComponent, RainbowKitProvider, Theme, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  coinbaseWallet,
  injectedWallet, 
  walletConnectWallet,
  ledgerWallet, // ledgerWallet,
  metaMaskWallet, 
  omniWallet, // omniWallet,
  rainbowWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import merge from 'lodash.merge';
import { PropsWithChildren, useMemo } from 'react';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { getWarpCore } from '../../../context/context';
import { Color } from '../../../styles/Color';
import { getWagmiChainConfig } from '../../chains/metadata';
import { tryGetChainMetadata } from '../../chains/utils';

const { chains, publicClient } = configureChains(getWagmiChainConfig(), [publicProvider()]);

const connectorConfig = {
  chains,
  publicClient,
  appName: APP_NAME,
  projectId: config.walletConnectProjectId,
};

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet(connectorConfig),
      injectedWallet(connectorConfig),
      walletConnectWallet(connectorConfig),
      ledgerWallet(connectorConfig),
    ],
  },
  {
    groupName: 'More',
    wallets: [
      coinbaseWallet(connectorConfig),
      omniWallet(connectorConfig),
      rainbowWallet(connectorConfig),
      trustWallet(connectorConfig),
      argentWallet(connectorConfig),
    ],
  },
]);

const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient,
  connectors,
});

const customTheme = merge(darkTheme(), {
  colors: {
    accentColor: Color.button,
    modalBorder: '#FFFFFF',
    modalBackground: '#000000',
  },
  radii: {
    actionButton: '0px',
    connectButton: '0px',
    menuButton: '0px',
    modal: '0px',
    modalMobile: '0px',
  },
  shadows: {
    // dialog: '0 0 #0000, 0 0 #0000, 4px 6px 0px 0px #FFFFFF',
  },
  fonts: {
    body: `'IBM Plex Mono', 'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
  },
} as Theme);


const Disclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>
    We <strong>HIGHLY</strong> reccomend everyone use desktop and the metamask browser at the moment
  </Text>
);

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const initialChain = useMemo(() => {
    const tokens = getWarpCore().tokens;
    const firstEvmToken = tokens.filter((token) => token.protocol === ProtocolType.Ethereum)?.[0];
    return tryGetChainMetadata(firstEvmToken?.chainName)?.chainId as number;
  }, []);
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider
        chains={chains}
        theme={customTheme}
        initialChain={initialChain}
        modalSize="compact"
        appInfo={{
          appName: 'Forma Bridge',
          disclaimer: Disclaimer,
        }}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
