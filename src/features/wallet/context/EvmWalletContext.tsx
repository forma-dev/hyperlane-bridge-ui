import { ProtocolType } from '@hyperlane-xyz/utils';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';
import { Chain } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { getWarpCore } from '../../../context/context';
import { Color } from '../../../styles/Color';
import { getViemChainConfig } from '../../chains/metadata';
import { tryGetChainMetadata } from '../../chains/utils';

const queryClient = new QueryClient();

const chains = getViemChainConfig();

const wagmiConfig = createConfig({
  //doublecast to get around typescript error
  chains: chains as unknown as [Chain, ...Chain[]],
  transports: Object.fromEntries(
    chains.map(chain => [chain.id, http(chain.rpcUrls.default.http[0])])
  ),
});

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const initialChain = useMemo(() => {
    const tokens = getWarpCore().tokens;
    const firstEvmToken = tokens.filter((token) => token.protocol === ProtocolType.Ethereum)?.[0];
    return tryGetChainMetadata(firstEvmToken?.chainName)?.chainId as number;
  }, []);

  const privyAppId = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('modularium.art')) {
      return process.env.NEXT_PUBLIC_PRIVY_APP_ID_PROD;
    }
    return process.env.NEXT_PUBLIC_PRIVY_APP_ID_DEV;
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyProvider
          appId={privyAppId || ''}
          config={{
            loginMethods: ['email', 'sms', 'wallet'],
            appearance: {
              theme: 'dark',
              accentColor: Color.button,
              showWalletLoginFirst: true,
            },
            supportedChains: chains,
            defaultChain: chains.find(chain => chain.id === initialChain) || chains[0],
            embeddedWallets: { 
              createOnLogin: 'users-without-wallets'
            },
          }}
        >
          {children}
        </PrivyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
