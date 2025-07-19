/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, errorToString, isNullish, toWei } from '@hyperlane-xyz/utils';

// import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { TextField } from '../../components/input/TextField';
import { getIndexForToken, getTokenByIndex, getTokens, getWarpCore } from '../../context/context';
import PolygonIcon from '../../images/icons/polygon.svg';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { tryGetChainProtocol } from '../chains/utils';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
// import { useIsApproveRequired } from '../tokens/approval';
import { useDestinationBalance, useOriginBalance } from '../tokens/balances';
import {
  getAccountAddressAndPubKey,
  useAccountAddressForChain,
  useAccounts,
  useConnectFns,
} from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { getCelestialsData } from './useCelestialsData';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';

export function TransferTokenForm({
  transferType,
  isReview,
  setIsReview,
}: {
  transferType: string;
  isReview: boolean;
  setIsReview: any;
}) {
  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts();
  const [recipientValue, setRecipientValue] = useState<string>('');

  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);

  const validate = (values: TransferFormValues) => {
    return validateForm(values, accounts);
  };

  const onSubmitForm = async (values: TransferFormValues) => {
    try {
      if (transferType === 'deposit') {
        console.log('Deposit button clicked for the first time');
        // Only attempt to resolve if it looks like a Celestial domain (contains a dot)
        if (values.recipient.includes('.')) {
          const celestialsData = await getCelestialsData(values.recipient);

          if (celestialsData?.address) {
            console.log('celstials resolved, setting recipient to', celestialsData.address);
            values.recipient = celestialsData.address;
            console.log('recipient set to', values.recipient);
            setRecipientValue(celestialsData.address);
          }
        }
      }

      setIsReview(true);
    } catch (error) {
      // Handle error silently
    }
  };

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ isValidating }) => {
        return (
          <Form className="items-stretch w-full">
            <div
              className="px-10 py-4 gap-y-6 flex flex-col"
              style={{ borderBottom: '0.5px solid #FFFFFF', borderTop: '0.5px solid #FFFFFF' }}
            >
              <ChainSelectSection isReview={isReview} type="from" transferType={transferType} />
              <div className="flex justify-between">
                <AmountSection
                  isNft={isNft}
                  setIsNft={setIsNft}
                  isReview={isReview}
                  transferType={transferType}
                />
              </div>
            </div>
            <div className="relative left-0 right-0 flex justify-center overflow-hidden z-1">
              <Image src={PolygonIcon} alt="" />
            </div>

            <div className="px-10 pt-4 pb-8 gap-y-3 flex flex-col">
              <ChainSelectSection isReview={isReview} type="to" transferType={transferType} />
              <RecipientSection
                isReview={isReview}
                transferType={transferType}
                recipientValue={recipientValue}
                setRecipientValue={setRecipientValue}
              />
              <ReviewDetails visible={isReview} />
              <ButtonSection
                isReview={isReview}
                isValidating={isValidating}
                setIsReview={setIsReview}
                transferType={transferType}
              />
            </div>
          </Form>
        );
      }}
    </Formik>
  );
}

// function SwapChainsButton({ disabled }: { disabled?: boolean }) {
//   const { values, setFieldValue } = useFormikContext<TransferFormValues>();
//   const { origin, destination } = values;

//   const onClick = () => {
//     if (disabled) return;
//     setFieldValue('origin', destination);
//     setFieldValue('destination', origin);
//     // Reset other fields on chain change
//     setFieldValue('tokenIndex', undefined);
//     setFieldValue('recipient', '');
//   };

//   return (
//     <IconButton
//       imgSrc={SwapIcon}
//       width={22}
//       height={22}
//       title="Swap chains"
//       classes={!disabled ? 'hover:rotate-180' : undefined}
//       onClick={onClick}
//       disabled={disabled}
//     />
//   );
// }

function ChainSelectSection({
  isReview,
  type,
  transferType,
}: {
  isReview: boolean;
  type: string;
  transferType: string;
}) {
  let chains = useMemo(() => getWarpCore().getTokenChains(), []);
  if (type === 'from' && transferType === 'deposit') {
    chains = chains.filter((chain) => !['forma', 'sketchpad'].includes(chain));
  }

  if (type === 'to' && transferType === 'withdraw') {
    // chains = chains.filter(chain => !['forma', 'sketchpad'].includes(chain));
    chains = ['stride'];
  }

  return (
    <div className="flex items-center justify-start space-x-7 sm:space-x-10">
      {type === 'from' ? (
        <ChainSelectField
          name="origin"
          label="From"
          chains={chains}
          disabled={isReview}
          transferType={transferType}
        />
      ) : (
        <ChainSelectField
          name="destination"
          label="To"
          chains={chains}
          disabled={isReview}
          transferType={transferType}
        />
      )}
    </div>
  );
}

function TokenSection({
  setIsNft,
  isReview,
}: {
  setIsNft: (b: boolean) => void;
  isReview: boolean;
}) {
  return (
    <div className="flex-1">
      <TokenSelectField name="tokenIndex" disabled={isReview} setIsNft={setIsNft} />
    </div>
  );
}

function AmountSection({
  isNft,
  isReview,
  transferType,
  setIsNft,
}: {
  isNft: boolean;
  isReview: boolean;
  transferType: string;
  setIsNft: (b: boolean) => void;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useOriginBalance(values);

  const [amountFieldFocused, setAmountFieldFocused] = useState(false);

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block text-sm text-secondary leading-5 font-medium">
          {transferType === 'deposit' ? 'Amount to Deposit' : 'Amount to Withdraw'}
        </label>
        {/* <TokenBalance label="My balance" balance={balance} /> */}
      </div>
      {isNft ? (
        <SelectOrInputTokenIds disabled={isReview} />
      ) : (
        <div className="relative w-fullh-[48px] flex items-center">
          <TextField
            id="amount-withdraw"
            name="amount"
            placeholder="0.00"
            classes={`w-full border-[1px] border-solid border-[#8C8D8F] 
                      hover:border-white hover:placeholder-white hover:text-white 
                      font-plex 
                      leading-5 font-medium ${
                        isReview
                          ? 'bg-disabled text-disabled cursor-default pointer-events-none'
                          : 'bg-black text-white'
                      }
                      ${
                        amountFieldFocused ? 'border-white placeholder-white' : 'border-[#FFFFFF66]'
                      }`}
            type="number"
            step="any"
            disabled={isReview}
            style={{
              fontSize: '40px',
            }}
            onFocus={() => setAmountFieldFocused(true)}
            onBlur={() => setAmountFieldFocused(false)}
          />
          {/* <MaxButton disabled={isReview} balance={balance} /> */}
          <TokenSection setIsNft={setIsNft} isReview={isReview} />
        </div>
      )}
      <div className="pt-1 text-right">
        <TokenBalance label="BALANCE" balance={balance} disabled={isReview} />
      </div>
    </div>
  );
}

function RecipientSection({
  isReview,
  transferType,
  recipientValue,
  setRecipientValue,
}: {
  isReview: boolean;
  transferType: string;
  recipientValue: string;
  setRecipientValue: (value: string) => void;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { balance } = useDestinationBalance(values);
  useRecipientBalanceWatcher(values.recipient, balance);

  const { accounts } = useAccounts();
  const cosmosAddress = accounts[ProtocolType.Cosmos].addresses[0]?.address;
  const evmAddress = accounts[ProtocolType.Ethereum].addresses[0]?.address;

  const defaultPlaceholder = '0x123... or a Celestial ID';
  const [placeholder, setPlaceholder] = useState<string>(defaultPlaceholder);
  const [amountFieldFocused, setAmountFieldFocused] = useState(false);

  const handleRecipientChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setRecipientValue(value);
    setFieldValue('recipient', value);

    if (!value) {
      setPlaceholder(defaultPlaceholder);
      return;
    }
  };

  useEffect(() => {
    let account: any = null;
    if (['celestia', 'stride'].includes(values.destination)) {
      account = accounts[ProtocolType.Cosmos].addresses.find(
        (address) => address.chainName === values.destination,
      );
    }
    if (['forma', 'sketchpad'].includes(values.destination)) {
      account = accounts[ProtocolType.Ethereum].addresses[0];
    }

    if (account?.address) {
      setFieldValue('recipient', account?.address);
      setRecipientValue(account?.address);
    } else {
      setFieldValue('recipient', '');
      setRecipientValue('');
    }

    if (transferType === 'deposit' && ['celestia', 'stride'].includes(values.destination)) {
      setPlaceholder(`${values.destination}1234...`);
    } else {
      setPlaceholder(defaultPlaceholder);
    }
  }, [cosmosAddress, evmAddress, values.destination, transferType]);

  return (
    <div>
      <div className="flex justify-between pr-1">
        <label htmlFor="recipient" className="block text-sm text-secondary leading-5 font-medium">
          Recipient Address (or Celestial ID)
        </label>
      </div>
      <div className="relative w-full">
        <TextField
          name="recipient"
          placeholder={placeholder}
          style={{
            boxShadow: '0 0 #0000',
          }}
          classes={`w-full border-[1px] border-solid border-[#8C8D8F]
            hover:border-white shadow-none
            hover:placeholder-white font-plex text-secondary 
            leading-5 font-medium placeholder:text-[11px] 
            ${amountFieldFocused ? 'border-white placeholder-white' : 'border-[#FFFFFF66]'}
            ${
              isReview
                ? 'bg-disabled text-disabled cursor-default pointer-events-none'
                : 'bg-black text-white'
            }`}
          disabled={isReview}
          onFocus={() => setAmountFieldFocused(true)}
          onBlur={() => setAmountFieldFocused(false)}
          onChange={handleRecipientChange}
          value={recipientValue}
        />
        <div className="flex justify-end">
          <TokenBalance label="REMOTE BALANCE" balance={balance} disabled={true} />
        </div>
        {!isReview && <SelfButton disabled={isReview} setRecipientValue={setRecipientValue} />}
      </div>
    </div>
  );
}

function TokenBalance({
  label,
  balance,
  disabled,
}: {
  label: string;
  balance?: TokenAmount | null;
  disabled?: boolean;
}) {
  const value = balance?.getDecimalFormattedAmount().toFixed(4) || '0';
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination, tokenIndex } = values;
  const { accounts } = useAccounts();
  const { fetchMaxAmount } = useFetchMaxAmount();

  const onClick = async () => {
    if (!balance || isNullish(tokenIndex) || disabled) return;
    const maxAmount = await fetchMaxAmount({ balance, origin, destination, accounts });
    if (isNullish(maxAmount)) return;

    const decimalsAmount = maxAmount.getDecimalFormattedAmount();
    const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
    setFieldValue('amount', roundedAmount);

    // Set the color of the input field to #FFFFFF
    const inputField = document.getElementById('amount-withdraw'); // Assuming id of the input field is 'amount-input'
    if (inputField) {
      inputField.style.color = '#FFFFFF';
    }
  };
  return (
    <div className="text-[10px] font-semibold leading-5 text-secondary">
      {label}:
      <button type="button" disabled={disabled} onClick={onClick}>
        <span className={disabled ? '' : 'underline ml-1.5 hover:text-primary'}>{value}</span>
      </button>
    </div>
  );
}

// function TimeTransfer({ label, time }:
// {
//   label: string;
//   time?: string | null;
// }) {
//   return (
//     <div className="flex justify-between text-xs font-normal leading-4 text-secondary">
//       {`${label}:`}
//       <span className="text-primary font-medium">{`${time}`} minute</span>
//     </div>
//   );
// }

function ButtonSection({
  isReview,
  isValidating,
  setIsReview,
  transferType,
}: {
  isReview: boolean;
  isValidating: boolean;
  setIsReview: (b: boolean) => void;
  transferType: string;
}) {
  const { values } = useFormikContext<TransferFormValues>();

  const onDoneTransactions = () => {
    setIsReview(false);
    setTransferLoading(false);
    // resetForm();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const triggerTransactionsHandler = async () => {
    console.log('Deposit button clicked for the second time - confirming transaction');
    setTransferLoading(true);
    await triggerTransactions(values);
  };

  if (!isReview) {
    return (
      <ConnectAwareSubmitButton
        chainName={values.origin}
        text={isValidating ? 'VALIDATING...' : transferType === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
        classes="py-3 px-8 w-full"
        isValidating={isValidating}
      />
    );
  }

  return (
    <div className="flex items-center justify-between space-x-4">
      <SolidButton
        type="button"
        color="black"
        onClick={() => setIsReview(false)}
        classes="flex-1 px-3 py-8 max-h-12 hover:bg-hoverForm"
        icon={<ChevronIcon direction="w" width={10} height={6} color={Color.primaryWhite} />}
      >
        <span className="text-sm text-white font-bold leading-6">EDIT</span>
      </SolidButton>
      <SolidButton
        type="button"
        color="button"
        onClick={triggerTransactionsHandler}
        classes="flex-1 px-3 py-8 text-sm max-h-16 font-bold uppercase"
      >
        {transferType === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
      </SolidButton>
    </div>
  );
}

// function MaxButton({ balance, disabled }: { balance?: TokenAmount; disabled?: boolean }) {
//   const { values, setFieldValue } = useFormikContext<TransferFormValues>();
//   const { origin, destination, tokenIndex } = values;
//   const { accounts } = useAccounts();
//   const { fetchMaxAmount, isLoading } = useFetchMaxAmount();

//   const onClick = async () => {
//     if (!balance || isNullish(tokenIndex) || disabled) return;
//     const maxAmount = await fetchMaxAmount({ balance, origin, destination, accounts });
//     if (isNullish(maxAmount)) return;
//     const decimalsAmount = maxAmount.getDecimalFormattedAmount();
//     const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
//     setFieldValue('amount', roundedAmount);
//   };

//   return (
//     <SolidButton
//       type="button"
//       onClick={onClick}
//       color="gray"
//       disabled={disabled}
//       classes="text-xs absolute right-0.5 top-2 bottom-0.5 px-2"
//     >
//       {isLoading ? (
//         <div className="flex items-center">
//           <SmallSpinner />
//         </div>
//       ) : (
//         'MAX'
//       )}
//     </SolidButton>
//   );
// }

function SelfButton({
  disabled,
  setRecipientValue,
}: {
  disabled?: boolean;
  setRecipientValue?: any;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const protocol = tryGetChainProtocol(values.destination) || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const address = useAccountAddressForChain(values.destination);
  const onClick = () => {
    if (disabled) return;
    if (address) {
      setFieldValue('recipient', address);
      setRecipientValue && setRecipientValue(address);
    } else {
      connectFn();
      setIsConnecting(true);
    }
    // toast.warn(
    //   `No account found for for chain ${getChainDisplayName(
    //     values.destination,
    //   )}, is your wallet connected?`,
    // );
  };

  useEffect(() => {
    if (address && isConnecting) {
      setIsConnecting(false);
      setFieldValue('recipient', address);
    }
  }, [address, isConnecting]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs text-secondary hover:text-white bg-black absolute right-0.5 top-4 px-2 py-0.5"
    >
      {address && !disabled ? 'SELF' : ''}
    </button>
  );
}

function ReviewDetails({ visible }: { visible: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  // const { tokenIndex } = values;
  // const originToken = getTokenByIndex(tokenIndex);
  // const originTokenSymbol = originToken?.symbol || '';
  // const connection = originToken?.getConnectionForChain(destination);
  // const destinationToken = connection?.token;
  // const isNft = originToken?.isNft();

  // const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);

  // const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
  //   originToken,
  //   amountWei,
  //   visible,
  // );
  const { fees } = useFeeQuotes(values, visible);

  // const isLoading = isApproveLoading || isQuoteLoading;

  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      {fees?.localQuote && fees.localQuote.amount > 0n && (
        <p className="flex justify-between">
          <span className="text-left text-[#8C8D8F] text-xs font-medium min-w-[7rem]">
            Local Gas (est.)
          </span>
          <span className="text-right text-white text-xs font-medium min-w-[7rem]">{`${
            fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.localQuote.token.symbol || ''}`}</span>
        </p>
      )}
      {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
        <p className="flex justify-between">
          <span className="text-left text-[#8C8D8F] text-xs font-medium min-w-[7rem]">
            Interchain Gas
          </span>
          <span className="text-right text-white text-xs font-medium min-w-[7rem]">{`${
            fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.interchainQuote.token.symbol || ''}`}</span>
        </p>
      )}
      <p className="flex justify-between">
        <span className="text-left text-[#8C8D8F] text-xs font-medium min-w-[7rem]">
          Time to Transfer
        </span>
        <span className="text-right text-white text-xs font-medium min-w-[7rem]">{`<1 Minute`}</span>
      </p>
      {/* <label className="mt-4 block uppercase text-sm text-gray-500 pl-0.5">Transactions</label>
      <div className="mt-1.5 px-2.5 py-2 space-y-2 border border-gray-400 bg-black text-gray-400 text-sm break-all">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <SmallSpinner />
          </div>
        ) : (
          <>
            {isApproveRequired && (
              <div>
                <h4>Transaction 1: Approve Transfer</h4>
                <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-400 space-y-1.5 text-xs">
                  <p>{`Router Address: ${originToken?.addressOrDenom}`}</p>
                  {originToken?.collateralAddressOrDenom && (
                    <p>{`Collateral Address: ${originToken.collateralAddressOrDenom}`}</p>
                  )}
                </div>
              </div>
            )}
            <div>
              <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
              <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-400 space-y-1.5 text-xs">
                {destinationToken?.addressOrDenom && (
                  <p className="flex">
                    <span className="min-w-[7rem]">Remote Token</span>
                    <span>{destinationToken.addressOrDenom}</span>
                  </p>
                )}
                <p className="flex">
                  <span className="min-w-[7rem]">{isNft ? 'Token ID' : 'Amount'}</span>
                  <span>{`${amount} ${originTokenSymbol}`}</span>
                </p>
                {fees?.localQuote && fees.localQuote.amount > 0n && (
                  <p className="flex">
                    <span className="min-w-[7rem]">Local Gas (est.)</span>
                    <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                      fees.localQuote.token.symbol || ''
                    }`}</span>
                  </p>
                )}
                {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
                  <p className="flex">
                    <span className="min-w-[7rem]">Interchain Gas</span>
                    <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                      fees.interchainQuote.token.symbol || ''
                    }`}</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div> */}
    </div>
  );
}

function useFormInitialValues(): TransferFormValues {
  return useMemo(() => {
    const firstToken = getTokens()[0];
    const connectedToken = firstToken.connections?.[0];
    return {
      origin: firstToken.chainName,
      destination: connectedToken?.token?.chainName || '',
      tokenIndex: getIndexForToken(firstToken),
      amount: '',
      recipient: '',
    };
  }, []);
}

const insufficientFundsErrMsg = /insufficient.funds/i;

async function validateForm(
  values: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
) {
  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const token = getTokenByIndex(tokenIndex);

    // Try to resolve Celestial domain if it looks like one
    let resolvedRecipient = recipient;
    if (recipient && recipient.includes('.')) {
      try {
        const resolvedData = await getCelestialsData(recipient);
        if (resolvedData?.address) {
          resolvedRecipient = resolvedData.address;
        } else {
          return { recipient: 'Invalid Celestial domain or no address found' };
        }
      } catch (error) {
        return { recipient: 'Failed to resolve Celestial domain' };
      }
    }

    if (!token) return { token: 'Token is required' };
    const amountWei = toWei(amount, token.decimals);
    const { address, publicKey: senderPubKey } = getAccountAddressAndPubKey(origin, accounts);

    const result = await getWarpCore().validateTransfer({
      originTokenAmount: token.amount(amountWei),
      destination,
      recipient: resolvedRecipient,
      sender: address || '',
      senderPubKey: await senderPubKey,
    });
    return result;
  } catch (error) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    if (insufficientFundsErrMsg.test(errorMsg)) {
      errorMsg = 'Insufficient funds for gas fees';
    }
    return { form: errorMsg };
  }
}
