import { TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    // TIA Celestia to Stride
    {
      chainName: 'celestia',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: 'utia',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: isMainnet
            ? 'ethereum|forma|0x832d26B6904BA7539248Db4D58614251FD63dC05'
            : 'ethereum|sketchpad|0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
          type: TokenConnectionType.IbcHyperlane,
          sourcePort: 'transfer',
          sourceChannel: isMainnet ? 'channel-4' : 'channel-78',
          intermediateChainName: 'stride',
          intermediateRouterAddress: isMainnet
            ? 'stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc'
            : 'stride1ej9893p4stg5lyrksaxhtk7ystvy9vp66dlagyvtzycuagjlxkdsxcly6h',
          intermediateIbcDenom: isMainnet
            ? 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
            : 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
        },
        {
          token: isMainnet
            ? 'cosmos|stride|ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
            : 'cosmos|stride|ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: isMainnet ? 'channel-4' : 'channel-78',
        },
      ],
    },

    // TIA on Stride to Forma
    {
      chainName: 'stride',
      standard: TokenStandard.CwHypCollateral,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: isMainnet
        ? 'stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc'
        : 'stride1ej9893p4stg5lyrksaxhtk7ystvy9vp66dlagyvtzycuagjlxkdsxcly6h',
      collateralAddressOrDenom: isMainnet
        ? 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
        : 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: isMainnet
            ? 'ethereum|forma|0x832d26B6904BA7539248Db4D58614251FD63dC05'
            : 'ethereum|sketchpad|0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
        },
      ],
    },

    // TIA on Forma from Stride
    {
      chainName: isMainnet ? 'forma' : 'sketchpad',
      standard: TokenStandard.EvmNative,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 18,
      addressOrDenom: isMainnet
        ? '0x832d26B6904BA7539248Db4D58614251FD63dC05'
        : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: isMainnet
            ? 'cosmos|stride|stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc'
            : 'cosmos|stride|stride1ej9893p4stg5lyrksaxhtk7ystvy9vp66dlagyvtzycuagjlxkdsxcly6h',
        },
      ],
    },

    // TIA on Stride from Celestia
    {
      chainName: 'stride',
      standard: TokenStandard.CosmosIbc,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      addressOrDenom: isMainnet
        ? 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
        : 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: 'cosmos|celestia|utia',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: isMainnet ? 'channel-4' : 'channel-78',
        },
      ],
    },
  ],
  options: {
    interchainFeeConstants: [
      {
        origin: 'stride',
        destination: isMainnet ? 'forma' : 'sketchpad',
        amount: isMainnet ? 20000 : 46,
        addressOrDenom: isMainnet
          ? 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
          : 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      },
      {
        origin: 'celestia',
        destination: isMainnet ? 'forma' : 'sketchpad',
        amount: isMainnet ? 20000 : 46,
        addressOrDenom: 'utia',
      },
      {
        origin: isMainnet ? 'forma' : 'sketchpad',
        destination: 'stride',
        amount: isMainnet ? 20000000000000000 : 2500000000000000,
        addressOrDenom: isMainnet
        ? '0x832d26B6904BA7539248Db4D58614251FD63dC05'
        : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
      },
      {
        origin: isMainnet ? 'forma' : 'sketchpad',
        destination: 'celestia',
        amount: isMainnet ? 20000000000000000 : 2500000000000000,
        addressOrDenom: isMainnet
        ? '0x832d26B6904BA7539248Db4D58614251FD63dC05'
        : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
      },
    ],
  },
};
