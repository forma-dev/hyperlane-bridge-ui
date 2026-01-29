import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  forma: {
    name: 'forma',
    displayName: 'Forma',
    displayNameShort: 'Forma',
    logoURI: '/logos/forma.png',
    chainId: 984122,
    domainId: 984122,
    protocol: ProtocolType.Ethereum,
    isTestnet: false,
    rpcUrls: [{ http: 'https://rpc.forma.art' }],
    nativeToken: {
      name: 'Tia',
      symbol: 'TIA',
      decimals: 18,
      denom: '0x832d26B6904BA7539248Db4D58614251FD63dC05',
    },
    blockExplorers: [
      {
        name: 'Forma Explorer',
        url: 'https://explorer.forma.art',
        apiUrl: 'https://explorer.forma.art/api',
        family: ExplorerFamily.Blockscout,
      },
    ],
  },
  stride: {
    protocol: ProtocolType.Cosmos,
    isTestnet: false,
    domainId: 745,
    chainId: 'stride-1',
    name: 'stride',
    displayName: 'Stride',
    bech32Prefix: 'stride',
    slip44: 118,
    nativeToken: {
      name: 'Stride',
      symbol: 'STRD',
      decimals: 6,
      denom: 'ustrd',
    },
    grpcUrls: [{ http: 'https://stride-grpc.publicnode.com' }],
    restUrls: [{ http: 'https://stride-rest.publicnode.com' }],
    rpcUrls: [{ http: 'https://stride-rpc.publicnode.com' }],
    blockExplorers: [],
    logoURI: '/logos/stride.png',
    transactionOverrides: {
      gasPrice: 0.025,
    },
  },
  celestia: {
    protocol: ProtocolType.Cosmos,
    isTestnet: false,
    domainId: 1128614981,
    chainId: 'celestia',
    name: 'celestia',
    displayName: 'Celestia',
    bech32Prefix: 'celestia',
    slip44: 118,
    nativeToken: {
      name: 'Tia',
      symbol: 'TIA',
      decimals: 6,
      denom: 'utia',
    },
    grpcUrls: [{ http: 'https://celestia-grpc.publicnode.com' }],
    restUrls: [{ http: 'https://celestia-rest.publicnode.com' }],
    rpcUrls: [{ http: 'https://celestia-rpc.publicnode.com' }],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 6,
    },
    blockExplorers: [
      {
        name: 'Celenium',
        url: 'https://celenium.io',
        apiUrl: 'https://celenium.io',
        family: ExplorerFamily.Other,
      },
      {
        name: 'MintScan',
        url: 'https://www.mintscan.io/celestia',
        // TODO API not supported, using url to meet validation requirements
        apiUrl: 'https://www.mintscan.io/celestia',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logos/celestia.png',
    gasPrice: {
      amount: '0.002',
      denom: 'utia',
    },
    transactionOverrides: {
      gasPrice: 0.002,
    },
  },
};
