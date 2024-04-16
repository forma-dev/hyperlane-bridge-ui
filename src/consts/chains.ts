import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  sketchpad: {
    name: 'sketchpad',
    displayName: 'Forma Sketchpad',
    displayNameShort: 'Sketchpad',
    logoURI: '/logos/forma.png',
    chainId: 984123,
    domainId: 984123,
    protocol: ProtocolType.Ethereum,
    isTestnet: true,
    rpcUrls: [{ http: 'https://rpc.sketchpad-1.forma.art' }],
    nativeToken: {
      name: 'Tia',
      symbol: 'TIA',
      decimals: 18,
      denom: 'atia',
    },
    blockExplorers: [
      {
        name: 'Forma Explorer',
        url: 'https://explorer.sketchpad-1.forma.art',
        apiUrl: 'https://explorer.sketchpad-1.forma.art/api',
        family: ExplorerFamily.Blockscout,
      }
    ]
  },
  celestia: {
    protocol: ProtocolType.Cosmos,
    domainId: 123456789, // TODO not a real domain id
    chainId: 'mocha-4',
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
    grpcUrls: [{ http: 'https://grpc.celestia-mocha.com' }],
    restUrls: [{ http: 'https://api.celestia-mocha.com' }],
    rpcUrls: [{ http: 'https://rpc.celestia-mocha.com' }],
    blockExplorers: [
      {
        name: 'MintScan',
        url: 'https://www.mintscan.io/celestia',
        // TODO API not supported, using url to meet validation requirements
        apiUrl: 'https://www.mintscan.io/celestia',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logos/celestia.png',
    transactionOverrides: {
      gasPrice: 0.1,
    },
  },
  stride: {
    protocol: ProtocolType.Cosmos,
    domainId: 1651,
    chainId: 'stride-internal-1',
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
    grpcUrls: [{ http: 'http://stride-direct.testnet-1.stridenet.co:9090' }],
    restUrls: [{ http: 'https://stride.testnet-1.stridenet.co/api/' }],
    rpcUrls: [{ http: 'https://stride.testnet-1.stridenet.co' }],
    blockExplorers: [],
    logoURI: '/logos/stride.png',
    transactionOverrides: {
      gasPrice: 0.025,
    },
  },
};
