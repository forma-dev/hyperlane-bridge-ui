import { defineChain } from 'viem';
import { chainExplorerName, chainExplorerURL, chainId, chainMoniker, chainName, chainRPC } from "../consts/details";

const rpcUrl = { http: [chainRPC], webSocket: [chainRPC.replace('https://', 'wss://')] };

export const forma = defineChain({
  id: chainId,
  name: chainName,
  network: chainMoniker,
  nativeCurrency: {
    name: 'Forma',
    symbol: 'FORMA',
    decimals: 18
  },
  rpcUrls: {
    default: rpcUrl,
    public: rpcUrl,
  },
  blockExplorers: {
    default: { name: chainExplorerName, url: chainExplorerURL },
  },
});
