import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';

import { IToken } from '@hyperlane-xyz/sdk';
import { isValidAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { getMultiProvider, getTokenByIndex, getTokens } from '../../context/context';
// Import centralized Relay utilities
import { mapRelayChainToInternalName as relayMapChainName } from '../chains/relayUtils';
import { TransferFormValues } from '../transfer/types';
import { getRelayBalance } from '../wallet/context/RelayClient';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName) return false;

  // Check against the dynamic Relay chains list if available
  if (relayChains?.length) {
    const dynamicMatch = relayChains.some((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      // Remove the depositEnabled and disabled checks - we want to allow balance fetching for all Relay chains
      const matches = internalName && internalName === chainName.toLowerCase();
      return matches;
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
function getChainIdForRelayChain(chainName: string, relayChains?: any[]): number | undefined {
  // Debug logging removed

  // Get from Relay API data
  if (relayChains && relayChains.length > 0) {
    const relayChain = relayChains.find((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === chainName.toLowerCase();
    });

    if (relayChain?.id) {
      return relayChain.id;
    }
  }

  // No chain id found

  // No hardcoded fallback - return undefined if not found in API data
  return undefined;
}

// Dynamic balance hook using Relay API for any chain
export function useDynamicRelayBalance(
  chain?: ChainName,
  address?: Address,
  selectedTokenAddress?: string,
) {
  const { relayChains } = useRelaySupportedChains();
  const chainId = chain ? getChainIdForRelayChain(chain, relayChains) : undefined;

  // Quiet: no console prelogs

  const {
    data: relayBalance,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['relayBalance', chainId, address, selectedTokenAddress],
    queryFn: async () => {
      if (!chainId || !address) {
        return null;
      }
      // Quiet: no console fetch logs
      return await getRelayBalance(chainId, address, selectedTokenAddress);
    },
    onError: (err) => {
      // Quiet: no console error logs
      // Don't show toast errors for balance fetching failures since they will retry
    },
    enabled: !!chainId && !!address,
    refetchInterval: 5000,
  });

  // Don't show toast errors for balance fetching since we have RPC fallbacks
  // useToastError(error, 'Error fetching dynamic Relay balance');

  // Create a simple balance object with just the method TokenBalance needs
  const balance = relayBalance
    ? {
        getDecimalFormattedAmount: () => {
          const decimals = relayBalance.decimals;
          const amount = Number(ethers.utils.formatUnits(relayBalance.balance, decimals));
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
  // accounts not used

  // Check if this is a Relay chain
  const isRelayOrigin = isRelayChain(origin, relayChains);

  const isFormaWithdrawal = origin === 'forma' || origin === 'sketchpad';

  // Quiet: no chain analysis logs

  // For Relay transfers (excluding ALL Forma withdrawals), use Relay balance fetching

  // Use dynamic balance fetching for ALL Relay chains

  // Use dynamic API balance for all Relay chains
  const dynamicBalance = useDynamicRelayBalance(
    isRelayOrigin && !isFormaWithdrawal ? origin : undefined,
    address,
    values.selectedToken?.address,
  );

  // Use dynamic balance for all Relay chains
  const relayBalance = dynamicBalance;

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

  // Check if wallet is connected
  const isWalletConnected = address && address !== '0x0000000000000000000000000000000000000000';

  // Return the appropriate balance based on transfer type
  // For deposits from Hyperlane chains (Celestia/Forma) to Relay chains, always use Hyperlane balance
  // For withdrawals from Relay chains to Hyperlane chains, use Relay balance
  if (isRelayOrigin && !isFormaWithdrawal) {
    if (!isWalletConnected) {
      return { balance: null };
    }
    return { balance: relayBalance.balance };
  } else {
    if (!isWalletConnected) {
      return { balance: null };
    }
    return { balance: hyperlaneBalance.balance };
  }
}

export function useDestinationBalance(values: TransferFormValues, transferType?: string) {
  const { destination, tokenIndex, selectedToken } = values;
  const { relayChains } = useRelaySupportedChains();

  // Get the connected wallet address for the destination chain
  const destinationWalletAddress = useAccountAddressForChain(destination);

  // Check if this is a Relay transfer
  const isDestinationRelay = isRelayChain(destination, relayChains);

  // SPECIAL CASE: Forma/Sketchpad should always use Hyperlane balance, even though they're in Relay chains list
  const isFormaDestination = destination === 'forma' || destination === 'sketchpad';
  const shouldUseRelayBalance = isDestinationRelay && !isFormaDestination;

  // Use dynamic balance fetching for ALL Relay chains

  // For deposits: destination should always show Forma TIA balance
  // For withdrawals: destination should show selected token balance
  const tokenAddressToUse = transferType === 'deposit' ? undefined : selectedToken?.address;

  // Use dynamic API balance for all Relay chains
  const dynamicBalance = useDynamicRelayBalance(
    shouldUseRelayBalance ? destination : undefined,
    destinationWalletAddress,
    tokenAddressToUse, // Use Forma TIA for deposits, selected token for withdrawals
  );

  // Use dynamic balance for all Relay chains
  const relayBalance = dynamicBalance;

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

  // Check if wallet is connected
  const isWalletConnected =
    destinationWalletAddress &&
    destinationWalletAddress !== '0x0000000000000000000000000000000000000000';

  // Return the appropriate balance based on chain type
  if (!isWalletConnected) {
    return { balance: null };
  }
  return shouldUseRelayBalance ? relayBalance : hyperlaneBalance;
}
