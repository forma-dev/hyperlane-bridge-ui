import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect, useMemo } from 'react';
import { arbitrum, mainnet, optimism } from 'wagmi/chains';

import { forma } from '../../../config/chain';
import { wagmiConfig } from '../../../config/wagmi';
import { config } from '../../../consts/config';

const queryClient = new QueryClient();

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const privyAppId = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('bridge.forma.art')) {
      return process.env.NEXT_PUBLIC_PRIVY_APP_ID_PROD;
    }
    return process.env.NEXT_PUBLIC_PRIVY_APP_ID_DEV;
  }, []);

  // Add error boundary for Privy analytics errors
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        return await originalFetch(...args);
      } catch (error) {
        // Silently handle Privy analytics errors to prevent console spam
        if (args[0] && typeof args[0] === 'string' && args[0].includes('auth.privy.io')) {
          return new Response('{}', { status: 200 });
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <PrivyProvider
      appId={privyAppId || ''}
      config={{
        walletConnectCloudProjectId: config.walletConnectProjectId,
        loginMethods: ['email', 'sms', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#ff6f00',
          showWalletLoginFirst: true,
          walletList: ['metamask', 'wallet_connect', 'detected_wallets'],
          landingHeader: 'Connect a Wallet',
          logo: <></>,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: forma,
        supportedChains: [forma, mainnet, arbitrum, optimism],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
