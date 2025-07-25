import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { arbitrum, mainnet, optimism } from 'wagmi/chains';

import { forma } from './chain';

export const wagmiConfig = createConfig({
  chains: [forma, mainnet, arbitrum, optimism],
  transports: {
    [forma.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
});
