import type { AssetList, Chain as CosmosChain } from '@chain-registry/types';
import { Chain } from 'viem';

import { ChainName, chainMetadataToViemChain } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { getWarpContext } from '../../context/context';
import { logger } from '../../utils/logger';

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): Chain[] {
  try {
    const warpContext = getWarpContext();
    if (!warpContext?.chains) {
      logger.warn('WarpContext chains not available, returning empty array');
      return [];
    }
    const evmChains = Object.values(warpContext.chains).filter(
      (c) => !c.protocol || c.protocol === ProtocolType.Ethereum,
    );
    return evmChains.map(chainMetadataToViemChain) as Chain[];
  } catch (error) {
    logger.warn('Error getting Wagmi chain config:', error);
    return [];
  }
}

export function getCosmosKitConfig(): { chains: CosmosChain[]; assets: AssetList[] } {
  try {
    const warpContext = getWarpContext();
    if (!warpContext?.chains) {
      logger.warn('WarpContext chains not available, returning empty config');
      return { chains: [], assets: [] };
    }
    const cosmosChains = Object.values(warpContext.chains).filter(
      (c) => c.protocol === ProtocolType.Cosmos,
    );
    const chains = cosmosChains.map((c) => ({
      chain_name: c.name,
      status: 'live' as const,
      network_type: c.isTestnet ? ('testnet' as const) : ('mainnet' as const),
      pretty_name: c.displayName || c.name,
      chain_id: c.chainId as string,
      bech32_prefix: c.bech32Prefix!,
      slip44: c.slip44!,
      chain_type: 'cosmos' as const,
      apis: {
        rpc: [
          {
            address: c.rpcUrls[0].http,
            provider: c.displayName || c.name,
          },
        ],
        rest: c.restUrls
          ? [
              {
                address: c.restUrls[0].http,
                provider: c.displayName || c.name,
              },
            ]
          : [],
      },
      fees: {
        fee_tokens: [
          {
            denom: 'token',
          },
        ],
      },
      staking: {
        staking_tokens: [
          {
            denom: 'stake',
          },
        ],
      },
    }));
    const assets = cosmosChains.map((c) => {
      if (!c.nativeToken) throw new Error(`Missing native token for ${c.name}`);
      return {
        chain_name: c.name,
        assets: [
          {
            description: `The native token of ${c.displayName || c.name} chain.`,
            denom_units: [
              {
                denom: 'token',
                exponent: c.nativeToken.decimals,
              },
            ],
            base: 'token',
            name: 'token',
            display: 'token',
            symbol: 'token',
            type_asset: 'sdk.coin' as const,
          },
          {
            description: `The native token of ${c.displayName || c.name} chain.`,
            denom_units: [
              {
                denom: 'token',
                exponent: c.nativeToken.decimals,
              },
            ],
            base: 'stake',
            name: 'stake',
            display: 'stake',
            symbol: 'stake',
            type_asset: 'sdk.coin' as const,
          },
        ],
      };
    });

    return { chains, assets };
  } catch (error) {
    logger.warn('Error getting CosmosKit config:', error);
    return { chains: [], assets: [] };
  }
}

export function getCosmosChainNames(): ChainName[] {
  try {
    const warpContext = getWarpContext();
    if (!warpContext?.chains) {
      logger.warn('WarpContext chains not available, returning empty array');
      return [];
    }
    return Object.values(warpContext.chains)
      .filter((c) => c.protocol === ProtocolType.Cosmos)
      .map((c) => c.name);
  } catch (error) {
    logger.warn('Error getting Cosmos chain names:', error);
    return [];
  }
}
