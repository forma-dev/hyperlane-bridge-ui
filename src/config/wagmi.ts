import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { forma } from './chain';

export const wagmiConfig = createConfig({
  chains: [forma],
  transports: {
    [forma.id]: http(),
  },
});
