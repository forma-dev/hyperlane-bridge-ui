import { useFormikContext } from 'formik';
import { useCallback, useState } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { tryGetChainProtocol } from '../../features/chains/utils';
import { TransferFormValues } from '../../features/transfer/types';
import { useAccountForChain, useConnectFns } from '../../features/wallet/hooks/multiProtocol';
import { useTimeout } from '../../utils/timeout';

import { SolidButton } from './SolidButton';

interface Props {
  chainName: ChainName;
  text: string;
  classes?: string;
  isValidating?: boolean;
}

export function ConnectAwareSubmitButton<FormValues = any>({
  chainName,
  text,
  classes,
  isValidating = false,
}: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);

  const protocol = tryGetChainProtocol(chainName) || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  // Check both origin and destination accounts
  const originAccount = useAccountForChain(values.origin);
  const destinationAccount = useAccountForChain(values.destination);
  const isOriginReady = originAccount?.isReady;
  const isDestinationReady = destinationAccount?.isReady;
  
  // Determine transfer type based on form values
  const isDeposit = values.destination === 'forma' || values.destination === 'sketchpad'; // TO Forma
  const isWithdrawal = values.origin === 'forma' || values.origin === 'sketchpad'; // FROM Forma
  
  // For deposits/withdrawals with manual address, we need origin wallet + (destination wallet OR manual recipient address)
  // For other transfers, we need both wallets connected
  const hasValidRecipient = values.recipient && values.recipient.trim().length > 0;
  const isAccountReady = (isDeposit || isWithdrawal) 
    ? isOriginReady && (isDestinationReady || hasValidRecipient)
    : isOriginReady && isDestinationReady;

  const { errors, setErrors, touched, setTouched } = useFormikContext<FormValues>();

  const hasError = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  const amount = parseFloat(values.amount);

  let color;
  let content;
  if (amount === 0) {
    content = 'Invalid amount';
    color = 'red';
  } else {
    content =
      hasError && (isValidating || isReview)
        ? firstError
        : isAccountReady
        ? text
        : 'CONNECT WALLET';
    color = hasError && (isValidating || isReview) ? 'red' : isAccountReady ? 'button' : 'disabled';
  }
  const type = isAccountReady ? 'submit' : 'button';

  const onClick = () => {
    if (!isReview) {
      setIsReview(true);
    } else if (isAccountReady) {
      // Perform action when the form is reviewed and account is ready
    } else {
      connectFn(); // Connect wallet when the form is reviewed but account is not ready
    }
  };

  // Automatically clear error state after a timeout
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
    setIsReview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrors, setTouched, errors, touched]);

  useTimeout(clearErrors, 3500);

  return (
    <SolidButton type={type} color={color} onClick={onClick} classes={classes}>
      <div className="ml-1.5 text-black text-sm leading-6 font-bold font-sans">{content}</div>
    </SolidButton>
  );
}
