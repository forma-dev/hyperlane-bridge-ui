import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

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
  stride: isMainnet
    ? {
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
      }
    : {
        protocol: ProtocolType.Cosmos,
        isTestnet: true,
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
  celestia: isMainnet
    ? {
        protocol: ProtocolType.Cosmos,
        isTestnet: false,
        domainId: 123456789, // TODO not a real domain id
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
        grpcUrls: [{ http: 'https://public-celestia-grpc.numia.xyz' }],
        restUrls: [{ http: 'https://public-celestia-lcd.numia.xyz' }],
        rpcUrls: [{ http: 'https://public-celestia-rpc.numia.xyz' }],
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
      }
    : {
        protocol: ProtocolType.Cosmos,
        isTestnet: true,
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
      denom: '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
    },
    blockExplorers: [
      {
        name: 'Forma Explorer',
        url: 'https://explorer.sketchpad-1.forma.art',
        apiUrl: 'https://explorer.sketchpad-1.forma.art/api',
        family: ExplorerFamily.Blockscout,
      },
    ],
  },
};
