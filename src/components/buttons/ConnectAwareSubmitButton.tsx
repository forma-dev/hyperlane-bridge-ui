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

  const account = useAccountForChain(chainName);
  const isAccountReady = account?.isReady;

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
      <div className="ml-1.5 text-white text-sm leading-6 font-bold font-plex">{content}</div>
    </SolidButton>
  );
}
