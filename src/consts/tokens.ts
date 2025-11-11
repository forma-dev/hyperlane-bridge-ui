import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp UI token configs
// Tokens can be defined here, in tokens.json, or in tokens.yaml
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const tokenConfigs: WarpCoreConfig = {
  tokens: [
    // TIA Celestia to Forma
    {
      chainName: 'celestia',
      standard: TokenStandard.CosmNativeHypCollateral,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 6,
      logoURI: '/logos/celestia.png',
      addressOrDenom: '0x726f757465725f61707000000000000000000000000000010000000000000008',
      collateralAddressOrDenom: 'utia',
      connections: [
        {
          token: 'ethereum|forma|0x832d26B6904BA7539248Db4D58614251FD63dC05',
        },
      ],
    },

    // TIA on Forma from Celestia
    {
      chainName: 'forma',
      standard: TokenStandard.EvmNative,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 18,
      addressOrDenom: '0x832d26B6904BA7539248Db4D58614251FD63dC05',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: 'cosmosnative|celestia|0x726f757465725f61707000000000000000000000000000010000000000000008',
        },
        {
          token: 'cosmos|stride|stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc',
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
      addressOrDenom: 'stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc',
      collateralAddressOrDenom: 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: 'ethereum|forma|0x832d26B6904BA7539248Db4D58614251FD63dC05',
        },
      ],
    },

    // TIA on Forma from Stride
    // {
    //   chainName: 'forma',
    //   standard: TokenStandard.EvmNative,
    //   name: 'TIA',
    //   symbol: 'TIA',
    //   decimals: 18,
    //   addressOrDenom: '0x832d26B6904BA7539248Db4D58614251FD63dC05',
    //   logoURI: '/logos/celestia.png',
    //   connections: [
    //     {
    //       token: 'cosmos|stride|stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc',
    //     },
    //   ],
    // },

    // // TIA on Stride from Celestia
    // {
    //   chainName: 'stride',
    //   standard: TokenStandard.CosmosIbc,
    //   name: 'TIA',
    //   symbol: 'TIA',
    //   decimals: 6,
    //   addressOrDenom: 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
    //   logoURI: '/logos/celestia.png',
    //   connections: [
    //     {
    //       token: 'cosmos|celestia|utia',
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-4',
    //     },
    //   ],
    // },

    // // TIA Celestia to Stride
    // {
    //   chainName: 'celestia',
    //   standard: TokenStandard.CosmosIbc,
    //   name: 'TIA',
    //   symbol: 'TIA',
    //   decimals: 6,
    //   addressOrDenom: 'utia',
    //   logoURI: '/logos/celestia.png',
    //   connections: [
    //     {
    //       token: 'ethereum|forma|0x832d26B6904BA7539248Db4D58614251FD63dC05',
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-4',
    //       intermediateChainName: 'stride',
    //       intermediateRouterAddress: 'stride1h4rhlwcmdwnnd99agxm3gp7uqkr4vcjd73m4586hcuklh3vdtldqgqmjxc',
    //       intermediateIbcDenom: 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
    //     },
    //     {
    //       token: 'cosmos|stride|ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801',
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: 'transfer',
    //       sourceChannel: 'channel-4',
    //     },
    //   ],
    // },
  ],
  options: {
    interchainFeeConstants: [
      // {
      //   origin: 'stride',
      //   destination: isMainnet ? 'forma' : 'sketchpad',
      //   amount: isMainnet ? 430001 : 200,
      //   addressOrDenom: isMainnet
      //     ? 'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801'
      //     : 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      // },
      // {
      //   origin: 'celestia',
      //   destination: isMainnet ? 'forma' : 'sketchpad',
      //   amount: isMainnet ? 430001 : 200,
      //   addressOrDenom: 'utia',
      // },
      // {
      //   origin: isMainnet ? 'forma' : 'sketchpad',
      //   destination: 'stride',
      //   amount: isMainnet ? 20000000000000000 : 2500000000000000,
      //   addressOrDenom: isMainnet
      //     ? '0x832d26B6904BA7539248Db4D58614251FD63dC05'
      //     : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
      // },
      // {
      //   origin: isMainnet ? 'forma' : 'sketchpad',
      //   destination: 'celestia',
      //   amount: isMainnet ? 20000000000000000 : 2500000000000000,
      //   addressOrDenom: isMainnet
      //     ? '0x1052eF3419f26Bec74Ed7CEf4a4FA6812Bc09908'
      //     : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53',
      // },
    ],
  },
};
