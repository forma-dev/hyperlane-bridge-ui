import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import { TokenAmount } from '@hyperlane-xyz/sdk';

// Type guard to check if balance is a full TokenAmount object
function isTokenAmount(balance: any): balance is TokenAmount {
  return balance && typeof balance === 'object' && 'token' in balance && 'amount' in balance;
}

// Type for simplified balance objects (used by Relay chains)
interface SimpleBalance {
  getDecimalFormattedAmount(): number;
}

export function useRecipientBalanceWatcher(
  recipient?: Address,
  balance?: TokenAmount | SimpleBalance | null,
) {
  // A crude way to detect transfer completions by triggering
  // toast on recipient balance increase. This is not ideal because it
  // could confuse unrelated balance changes for message delivery
  // TODO replace with a polling worker that queries the hyperlane explorer
  const prevRecipientBalance = useRef<{
    balance?: TokenAmount | SimpleBalance | null;
    recipient?: string;
  }>({
    recipient: '',
  });

  useEffect(() => {
    if (
      recipient &&
      balance &&
      prevRecipientBalance.current.balance &&
      prevRecipientBalance.current.recipient === recipient
    ) {
      // Only do the comparison for full TokenAmount objects (Hyperlane)
      if (isTokenAmount(balance) && isTokenAmount(prevRecipientBalance.current.balance)) {
        if (
          balance.token.equals(prevRecipientBalance.current.balance.token) &&
          balance.amount > prevRecipientBalance.current.balance.amount
        ) {
          toast.success('Recipient has received funds, transfer complete!');
        }
      }
      // For Relay balances, we could add a simpler comparison here if needed
      // but for now, we'll skip the balance increase detection for Relay transfers
    }
    prevRecipientBalance.current = { balance, recipient: recipient };
  }, [balance, recipient, prevRecipientBalance]);
}
