import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';

import { forma } from '../../../config/chain';
import { wagmiConfig } from '../../../config/wagmi';
import { config } from '../../../consts/config';
import { Color } from '../../../styles/Color';

const queryClient = new QueryClient();

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const privyAppId = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('bridge.forma.art')) {
      return process.env.NEXT_PUBLIC_PRIVY_APP_ID_PROD;
    }
    return process.env.NEXT_PUBLIC_PRIVY_APP_ID_DEV;
  }, []);

  return (
    <PrivyProvider
      appId={privyAppId || ''}
      config={{
        walletConnectCloudProjectId: config.walletConnectProjectId,
        loginMethods: ['email', 'sms', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: Color.button,
          showWalletLoginFirst: true,
          walletList: ['metamask', 'wallet_connect', 'detected_wallets'],
          landingHeader: 'Connect a Wallet',
          logo: <></>,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: forma,
        supportedChains: [forma],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
