import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useBalance as useWagmiBalance } from 'wagmi';

import { IToken } from '@hyperlane-xyz/sdk';
import { isValidAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { getMultiProvider, getTokenByIndex, getTokens } from '../../context/context';
// Import centralized Relay utilities
import { mapRelayChainToInternalName as relayMapChainName } from '../chains/relayUtils';
import { TransferFormValues } from '../transfer/types';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName) return false;

  // First check against known Relay chain names (hardcoded list)
  const knownRelayChains = ['ethereum', 'arbitrum', 'optimism'];
  const isKnownRelay = knownRelayChains.includes(chainName.toLowerCase());

  if (isKnownRelay) {
    return true;
  }

  // Also check against the dynamic Relay chains list if available
  if (relayChains?.length) {
    const dynamicMatch = relayChains.some((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return (
        internalName &&
        internalName === chainName.toLowerCase() &&
        chain.depositEnabled &&
        !chain.disabled
      );
    });

    return dynamicMatch;
  }

  return false;
}

// Helper function to map Relay chain names to internal names
function mapRelayChainToInternalName(relayChainName: string): string | null {
  const result = relayMapChainName(relayChainName);
  return result || null;
}

// Get chain ID for supported Relay chains
function getChainIdForRelayChain(chainName: string): number | undefined {
  const chainIdMapping: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
  };

  return chainIdMapping[chainName.toLowerCase()];
}

// Custom balance hook for Relay chains using wagmi
export function useRelayBalance(chain?: ChainName, address?: Address) {
  const chainId = chain ? getChainIdForRelayChain(chain) : undefined;

  // Get the correct token address for each chain
  const getTokenAddress = (chainName: string): `0x${string}` | undefined => {
    const tokenAddresses: Record<string, `0x${string}`> = {
      // Native tokens that are not gas tokens
      optimism: '0x4200000000000000000000000000000000000042', // OP token
      arbitrum: '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB token
      // For these chains, use native ETH (undefined = native token)
      // 'ethereum': undefined, // ETH (native)
    };

    return tokenAddresses[chainName.toLowerCase()];
  };

  const tokenAddress = chain ? getTokenAddress(chain) : undefined;

  // Use wagmi's useBalance hook for balance fetching
  const {
    data: wagmiBalance,
    isLoading,
    error,
    isError,
  } = useWagmiBalance({
    address: address as `0x${string}`,
    chainId,
    token: tokenAddress, // Pass token address for branded tokens, undefined for native
    query: {
      enabled: !!chain && !!address && !!chainId,
      refetchInterval: 5000,
    },
  });

  useToastError(error, 'Error fetching Relay balance');

  // Create a simple balance object with just the method TokenBalance needs
  const balance = wagmiBalance
    ? {
        getDecimalFormattedAmount: () => {
          // Use the actual decimals from the token, not hardcoded values
          const decimals = wagmiBalance.decimals;
          const amount = Number(ethers.utils.formatUnits(wagmiBalance.value.toString(), decimals));

          return amount;
        },
      }
    : null;

  return {
    isLoading,
    isError,
    balance,
  };
}

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(getMultiProvider(), address);
    },
    refetchInterval: 5000,
  });

  useToastError(error, 'Error fetching balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance(values: TransferFormValues, _transferType?: string) {
  const { origin, destination: _destination, tokenIndex } = values;
  const address = useAccountAddressForChain(origin);
  const token = getTokenByIndex(tokenIndex);
  const { relayChains } = useRelaySupportedChains();

  // Check if this is a Relay chain
  const isRelayOrigin = isRelayChain(origin, relayChains);

  const isFormaWithdrawal = origin === 'forma' || origin === 'sketchpad';

  // For Relay transfers (excluding ALL Forma withdrawals), use Relay balance fetching
  const relayBalance = useRelayBalance(
    isRelayOrigin && !isFormaWithdrawal ? origin : undefined,
    address,
  );

  // For Hyperlane transfers (including ALL Forma withdrawals), use Hyperlane balance fetching
  // The tokenIndex system is unreliable and often picks the wrong TIA token
  let hyperlaneToken = token;
  if (origin === 'forma' || origin === 'sketchpad') {
    const tokens = getTokens();

    // ALWAYS find the EVM TIA token for Forma, regardless of what tokenIndex says
    let correctTiaToken = tokens.find(
      (t) => t.chainName === origin && t.symbol === 'TIA' && t.protocol === 'ethereum', // MUST be EVM protocol for Forma
    );

    if (!correctTiaToken) {
      // Fallback 1: Look for any EVM token with TIA in name
      correctTiaToken = tokens.find(
        (t) =>
          t.chainName === origin &&
          t.name?.toLowerCase().includes('tia') &&
          t.protocol === 'ethereum',
      );
    }

    if (!correctTiaToken) {
      // Fallback 2: Look for any token on Forma with ethereum protocol
      correctTiaToken = tokens.find((t) => t.chainName === origin && t.protocol === 'ethereum');
    }

    if (correctTiaToken) {
      hyperlaneToken = correctTiaToken;
    }
  }

  const hyperlaneBalance = useBalance(
    !isRelayOrigin || isFormaWithdrawal ? origin : undefined,
    hyperlaneToken,
    address,
  );

  // Return the appropriate balance based on transfer type
  // For deposits from Hyperlane chains (Celestia/Forma) to Relay chains, always use Hyperlane balance
  // For withdrawals from Relay chains to Hyperlane chains, use Relay balance
  if (isRelayOrigin && !isFormaWithdrawal) {
    return { balance: relayBalance.balance };
  } else {
    return { balance: hyperlaneBalance.balance };
  }
}

export function useDestinationBalance(values: TransferFormValues, _transferType?: string) {
  const { destination, tokenIndex } = values;
  const { relayChains } = useRelaySupportedChains();

  // Get the connected wallet address for the destination chain
  const destinationWalletAddress = useAccountAddressForChain(destination);

  // Check if this is a Relay transfer
  const isDestinationRelay = isRelayChain(destination, relayChains);

  // SPECIAL CASE: Forma/Sketchpad should always use Hyperlane balance, even though they're in Relay chains list
  const isFormaDestination = destination === 'forma' || destination === 'sketchpad';
  const shouldUseRelayBalance = isDestinationRelay && !isFormaDestination;

  // Use Relay balance for Relay destination chains (excluding Forma)
  const relayBalance = useRelayBalance(
    shouldUseRelayBalance ? destination : undefined,
    destinationWalletAddress,
  );

  // Use Hyperlane balance for Hyperlane destination chains (including Forma)
  const originToken = getTokenByIndex(tokenIndex);
  const connection = originToken?.getConnectionForChain(destination);

  // For Forma as destination, always find the EVM TIA token
  let destinationToken = connection?.token;
  if (isFormaDestination && !destinationToken) {
    const tokens = getTokens();
    destinationToken = tokens.find(
      (token) =>
        token.chainName === destination && token.symbol === 'TIA' && token.protocol === 'ethereum',
    );
  }

  const hyperlaneBalance = useBalance(
    !shouldUseRelayBalance ? destination : undefined,
    destinationToken,
    destinationWalletAddress,
  );

  // Return the appropriate balance based on chain type
  return shouldUseRelayBalance ? relayBalance : hyperlaneBalance;
}
