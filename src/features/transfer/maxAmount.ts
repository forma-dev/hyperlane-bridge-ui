import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { getChainMetadata } from '../chains/utils';
import { getAccountAddressAndPubKey } from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

interface FetchMaxParams {
  accounts: Record<ProtocolType, AccountInfo>;
  balance: TokenAmount;
  origin: ChainName;
  destination: ChainName;
}

export function useFetchMaxAmount() {
  const mutation = useMutation({
    mutationFn: (params: FetchMaxParams) => fetchMaxAmount(params),
  });
  return { fetchMaxAmount: mutation.mutateAsync, isLoading: mutation.isLoading };
}

async function fetchMaxAmount({ accounts, balance, destination, origin }: FetchMaxParams) {
  try {
    const { address, publicKey } = getAccountAddressAndPubKey(origin, accounts);
    if (!address) return balance;

    // Get the token for fee estimation
    const token = balance.token;
    
    // Check if destination is a Relay chain by checking if it's available in Hyperlane
    const warpCore = getWarpCore();
    const hyperlaneChains = warpCore.getTokenChains();
    const isRelayDestination = !hyperlaneChains.includes(destination);
    
    // If destination is a Relay chain, use a simpler calculation
    if (isRelayDestination) {
      // For Relay destinations, use the full balance since Relay subtracts fees directly from the tx amount
      // Use the same 1% fee calculation as Relay deposits
      const balanceAmount = balance.amount;
      const estimatedFees = balanceAmount * 1n / 100n;
      const maxAmountAfterFees = balanceAmount - estimatedFees;
      
      if (maxAmountAfterFees <= 0n) {
        return token.amount(0n);
      }
      
      return token.amount(maxAmountAfterFees);
    }
    
    // Get estimated fees for Hyperlane destinations
    const feeQuotes = await getWarpCore().estimateTransferRemoteFees({
      originToken: token,
      destination,
      sender: address,
      senderPubKey: await publicKey,
    });

    if (!feeQuotes) {
      // Fallback to original method if fee estimation fails
      const maxAmount = await getWarpCore().getMaxTransferAmount({
        balance,
        destination,
        sender: address,
        senderPubKey: await publicKey,
      });
      return maxAmount;
    }

    // Calculate the actual Hyperlane fees
    const localFee = feeQuotes.localQuote.amount;
    const interchainFee = feeQuotes.interchainQuote.amount;
    const hyperlaneFee = localFee + interchainFee;
    
    // Add 20% to the Hyperlane fee: Submitted fee = hyperlane fee + hyperlane fee x 20%
    const feeBuffer = hyperlaneFee * 20n / 100n;
    const totalFee = hyperlaneFee + feeBuffer;

    // Calculate max amount by subtracting the total fee from balance
    const balanceAmount = balance.amount;
    const maxAmountAfterFees = balanceAmount - totalFee;

    if (maxAmountAfterFees <= 0n) {
      // If balance is too low to cover fees, return a minimal amount
      return token.amount(0n);
    }

    // Return the calculated max amount
    return token.amount(maxAmountAfterFees);
  } catch (error) {
    logger.warn('Error fetching fee quotes for max amount', error);
    const chainName = getChainMetadata(origin).displayName;
    toast.warn(`Cannot simulate transfer, ${chainName} native balance may be insufficient.`);
    return undefined;
  }
}
