import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import {
    arbitrum,
    avalanche,
    base,
    bsc,
    mainnet,
    optimism,
    polygon
} from 'wagmi/chains';

import { forma } from './chain';

export const wagmiConfig = createConfig({
  chains: [
    forma,
    mainnet,
    polygon,
    arbitrum,
    optimism,
    base,
    bsc,
    avalanche,
  ],
  transports: {
    [forma.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
  },
});
