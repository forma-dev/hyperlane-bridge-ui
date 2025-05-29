import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { IToken } from '@hyperlane-xyz/sdk';
import { isValidAddress } from '@hyperlane-xyz/utils';

import { getMultiProvider, getTokenByIndex } from '../../context/context';
import { logger } from '../../utils/logger';
import { TransferFormValues } from '../transfer/types';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(getMultiProvider(), address);
    },
    refetchInterval: 5000,
  });

  // Only show toast errors when not in validation mode
  useEffect(() => {
    if (!error) return;
    const message = 'Error fetching balance';
    logger.error(message, error);

    // Don't show toasts during validation or amount field focus
    if (!document.activeElement?.id?.includes('amount')) {
      // Add debounce to prevent duplicate toasts during chain switching
      const timer = setTimeout(() => {
        // Only show toast if there's still an error after delay
        if (error) {
          toast.error(message, {
            toastId: `balance-error-${chain}`, // Prevent duplicate toasts
          });
        }
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [error, chain]);

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance({ origin, tokenIndex }: TransferFormValues) {
  const address = useAccountAddressForChain(origin);
  const token = getTokenByIndex(tokenIndex);
  return useBalance(origin, token, address);
}

export function useDestinationBalance({
  origin,
  destination,
  tokenIndex,
  recipient,
}: TransferFormValues) {
  const originToken = getTokenByIndex(tokenIndex);
  const connection = originToken?.getConnectionForChain(destination);
  return useBalance(origin, connection?.token, recipient);
}
