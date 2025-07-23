import { BigNumber } from 'bignumber.js';
import { useCallback, useState } from 'react';
import { logger } from '../../utils/logger';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

interface UseRelayMaxAmountParams {
  balance: { getDecimalFormattedAmount: () => number };
  origin: string;
  destination: string;
  transferType: string;
  setFieldValue?: (field: string, value: any) => void;
}

interface UseRelayMaxAmountResult {
  maxAmount: string | null;
  isLoading: boolean;
  error: string | null;
  calculateMaxAmount: () => Promise<void>;
}

export function useRelayMaxAmount({
  balance,
  origin,
  destination,
  transferType,
  setFieldValue,
}: UseRelayMaxAmountParams): UseRelayMaxAmountResult {
  const [maxAmount, setMaxAmount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { relayChains } = useRelaySupportedChains();
  const user = useAccountAddressForChain(origin);
  const recipient = useAccountAddressForChain(destination);

  const calculateMaxAmount = useCallback(async () => {
    if (!balance || !user || !recipient) {
      setMaxAmount(null);
      setError(null);
      return;
    }

    // Only calculate for Relay deposits (origin is Relay chain, destination is Forma)
    const isRelayDeposit = transferType === 'deposit' && 
      (destination === 'forma' || destination === 'sketchpad') &&
      relayChains.some(rc => {
        const internalName = rc.name.toLowerCase();
        return internalName === origin.toLowerCase();
      });

    if (!isRelayDeposit) {
      setMaxAmount(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fullBalance = balance.getDecimalFormattedAmount();
      
      // For now, use a simple approach: subtract estimated fees (1% of balance)
      const estimatedFees = fullBalance * 0.01;
      const maxAmountAfterFees = fullBalance - estimatedFees;
      
      if (maxAmountAfterFees > 0) {
        const roundedAmount = new BigNumber(maxAmountAfterFees).toFixed(4, BigNumber.ROUND_FLOOR);
        setMaxAmount(roundedAmount);
        
        // Set the field value if callback is provided
        if (setFieldValue) {
          setFieldValue('amount', roundedAmount);
        }
      } else {
        setError('Balance too low to cover fees');
      }
    } catch (err) {
      logger.error('Failed to calculate Relay max amount:', err);
      setError('Failed to calculate maximum amount');
    } finally {
      setIsLoading(false);
    }
  }, [balance, origin, destination, transferType, relayChains, user, recipient, setFieldValue]);

  return {
    maxAmount,
    isLoading,
    error,
    calculateMaxAmount,
  };
} 