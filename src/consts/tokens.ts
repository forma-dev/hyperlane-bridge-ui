import { TokenConnectionType, TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

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
          token: 'ethereum|sketchpad|0x943BBcCF80A065Da5194D9d2534769f717d07Eb6',
          type: TokenConnectionType.IbcHyperlane,
          sourcePort: 'transfer',
          sourceChannel: 'channel-78',
          intermediateChainName: 'stride',
          intermediateRouterAddress:
            'stride185rzjf3h7vx9fkw4m20hnehf4985fshky6nxdm7ft0eeylwyxewspqfker',
          intermediateIbcDenom:
            'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
        },
        {
          token:
            'cosmos|stride|ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-78',
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
      addressOrDenom: 'stride185rzjf3h7vx9fkw4m20hnehf4985fshky6nxdm7ft0eeylwyxewspqfker',
      collateralAddressOrDenom:
        'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      logoURI: '/logos/celestia.png',
      connections: [{ token: 'ethereum|sketchpad|0x943BBcCF80A065Da5194D9d2534769f717d07Eb6' }],
    },

    // TIA on Forma from Stride
    {
      chainName: 'sketchpad',
      standard: TokenStandard.EvmNative,
      name: 'TIA',
      symbol: 'TIA',
      decimals: 18,
      addressOrDenom: '0x943BBcCF80A065Da5194D9d2534769f717d07Eb6',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token:
            'cosmos|stride|stride185rzjf3h7vx9fkw4m20hnehf4985fshky6nxdm7ft0eeylwyxewspqfker',
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
      addressOrDenom: 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      logoURI: '/logos/celestia.png',
      connections: [
        {
          token: 'cosmos|celestia|utia',
          type: TokenConnectionType.Ibc,
          sourcePort: 'transfer',
          sourceChannel: 'channel-78',
        },
      ],
    },

  ],
  options: {
    interchainFeeConstants: [
      {
        origin: 'stride',
        destination: 'sketchpad',
        amount: 46,
        addressOrDenom: 'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
      },
      {
        origin: 'celestia',
        destination: 'sketchpad',
        amount: 46,
        addressOrDenom: 'utia',
      },
      {
        origin: 'sketchpad',
        destination: 'stride',
        amount: 0,
        addressOrDenom: 'atia',
      },
      {
        origin: 'sketchpad',
        destination: 'celestia',
        amount: 0,
        addressOrDenom: 'atia',
      },
    ],
  },
};
