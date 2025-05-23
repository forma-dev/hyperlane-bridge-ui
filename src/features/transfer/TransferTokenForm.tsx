/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, errorToString, isNullish, toWei } from '@hyperlane-xyz/utils';

// import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ChevronIcon } from '../../components/icons/Chevron';
import { TextField } from '../../components/input/TextField';
import { getIndexForToken, getTokenByIndex, getTokens, getWarpCore } from '../../context/context';
import PolygonIcon from '../../images/icons/polygon.svg';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { tryGetChainProtocol } from '../chains/utils';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
// import { useIsApproveRequired } from '../tokens/approval';
import { useOriginBalance } from '../tokens/balances';
import {
    getAccountAddressAndPubKey,
    useAccountAddressForChain,
    useAccounts,
    useConnectFns,
} from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';

const cosmosChainIds = ['stride', 'celestia'];
const evmChainIds = ['forma', 'sketchpad'];

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

  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);

  const validate = (values: TransferFormValues) => validateForm(values, accounts);

  const { triggerTransactions, isLoading } = useTokenTransfer(() => setIsReview(false));

  const onSubmitForm = (values: TransferFormValues) => {
    if (!isReview) {
      logger.debug('Reviewing transfer form values for:', values.origin, values.destination);
      setIsReview(true);
    } else {
      logger.debug('Executing transfer for:', values.origin, values.destination);
      triggerTransactions(values);
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
      {({ isValidating }) => (
        <Form className="items-stretch w-full">
          <div
            className="px-10 py-4 gap-y-6 flex flex-col"
            style={{ borderBottom: '0.5px solid #000000', borderTop: '0.5px solid #000000' }}
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
            <Image 
              src={PolygonIcon} 
              alt="" 
              style={{ 
                filter: 'brightness(0) saturate(100%)',
                opacity: 1
              }} 
            />
          </div>

          <div className="px-10 pt-4 pb-8 gap-y-6 flex flex-col">
            <ChainSelectSection isReview={isReview} type="to" transferType={transferType} />
            {/* <TimeTransfer label="TIME TO TRANSFER" time="<1" /> */}

            <RecipientSection isReview={isReview} />
            <ReviewDetails visible={isReview} />
            <ButtonSection
              isReview={isReview}
              isValidating={isValidating || isLoading}
              setIsReview={setIsReview}
              transferType={transferType}
            />
          </div>
        </Form>
      )}
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
        <label htmlFor="amount" className="block text-sm text-[#595959] leading-5 font-medium">
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
            classes={`w-full border-[0.5px] border-solid border-[#8C8D8F] rounded-[5px]
                      hover:border-[1px] hover:border-solid hover:border-[#000000]
                      focus:border-[1px] focus:border-solid focus:border-[#000000]
                      font-plex placeholder-[#9CA3AF]
                      leading-5 font-medium ${
                        isReview
                          ? 'bg-disabled text-disabled cursor-default pointer-events-none'
                          : 'bg-form text-[#000000]'
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

function RecipientSection({ isReview }: { isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { destination } = values;
  const { accounts } = useAccounts();
  const cosmosNumReady = accounts[ProtocolType.Cosmos].addresses.length;
  const evmNumReady = accounts[ProtocolType.Ethereum].addresses.length;

  return (
    <div className="flex flex-col items-start w-full">
      <label htmlFor="recipient" className="block text-sm text-[#595959] leading-5 font-medium">
          Recipient Address
        </label>
      <div className="w-full flex gap-[12px] justify-between items-end">
        <div className="relative w-full">
          <TextField
            name="recipient"
            disabled={isReview}
            placeholder="Enter recipient address"
            classes={`w-full placeholder-[#9CA3AF] border-[0.5px] border-solid border-[#8C8D8F] rounded-[5px] hover:border-[1px] hover:border-solid hover:border-[#000000] font-medium ${
              isReview
                ? 'bg-[#DADADA] text-[#808080] cursor-default pointer-events-none'
                : 'bg-[#FFFFFF] text-[#000000]'
            }`}
          />
          <SelfButton disabled={isReview} />
        </div>
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
    
    // Get the balance in BigNumber format
    const balanceAmount = new BigNumber(balance.getDecimalFormattedAmount());
    
    // If balance is less than or equal to 0.45 TIA, can't transfer anything
    if (balanceAmount.isLessThanOrEqualTo(0.45)) return;
    
    // Calculate max transferable amount (balance - 0.45 TIA)
    const maxTransferableAmount = balanceAmount.minus(0.45);
    
    // Round down to 4 decimal places
    const roundedAmount = maxTransferableAmount.toFixed(4, BigNumber.ROUND_FLOOR);
    
    // Set the amount in the form
    setFieldValue('amount', roundedAmount);

    // Update input field color
    const inputField = document.getElementById('amount-withdraw');
    if (inputField) {
      inputField.style.color = '#000000';
    }
  };

  // Determine if the button should be disabled
  const insufficientBalance = new BigNumber(value).isLessThanOrEqualTo(0.45);
  const isDisabled = disabled || insufficientBalance;

  return (
    <div className="text-[12px] font-semibold leading-5 text-[#595959]">
      {label}:
      <button 
        type="button" 
        disabled={isDisabled} 
        onClick={onClick}
        title={insufficientBalance ? "Insufficient balance for gas fees" : "Click to set maximum transferable amount"}
      >
        <span className={isDisabled ? '' : 'underline ml-1.5 hover:text-[#000000]'}>{value}</span>
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
  setIsReview: (value: boolean) => void;
  transferType: string;
}) {
  const { values, errors, touched } = useFormikContext<TransferFormValues>();
  const { origin, amount, recipient } = values;
  const { accounts } = useAccounts();
  const cosmosNumReady = accounts[ProtocolType.Cosmos].addresses.length;
  const evmNumReady = accounts[ProtocolType.Ethereum].addresses.length;
  const { balance } = useOriginBalance(values);

  const [isFromWalletConnected, setIsFromWalletConnected] = useState(false);

  useEffect(() => {
    const isConnected = (cosmosChainIds.includes(origin) && cosmosNumReady > 0) ||
                       (evmChainIds.includes(origin) && evmNumReady > 0);
    setIsFromWalletConnected(isConnected);
  }, [origin, cosmosNumReady, evmNumReady]);

  const hasErrors = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const isAmountValid = amount && parseFloat(amount) > 0;
  const isRecipientValid = recipient && recipient.length > 0;
  
  // Check if amount is less than or equal to balance, and user has enough for gas (0.45 TIA)
  const hasEnoughBalance = balance && amount ? 
    new BigNumber(balance.getDecimalFormattedAmount())
      .isGreaterThanOrEqualTo(new BigNumber(amount).plus(0.45)) : 
    false;

  const canProceed = isFromWalletConnected && isAmountValid && isRecipientValid && hasEnoughBalance && !hasErrors && !isValidating;

  const getButtonText = () => {
    if (!isFromWalletConnected) return 'CONNECT WALLET';
    if (isValidating) return 'VALIDATING...';
    if (hasErrors) return Object.values(errors)[0];
    if (!isAmountValid) return 'ENTER AMOUNT';
    if (!isRecipientValid) return 'ENTER RECIPIENT';
    if (!hasEnoughBalance) return '0.45 TIA is needed for interchain gas fees';
    return 'CONTINUE';
  };

  return (
    <div className="flex flex-col gap-4">
      {!isReview && (
        <button
          type="button"
          onClick={() => setIsReview(true)}
          disabled={!canProceed}
          className={`w-full h-[48px] font-bold border-b border-[#000000] border-solid rounded-[5px] flex items-center justify-center ${
            canProceed
              ? 'bg-[#FF6F00] text-[#000000] hover:bg-[#FB9241]'
              : 'bg-[#DADADA] text-[#808080]'
          }`}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}
        >
          {getButtonText()}
        </button>
      )}
      {isReview && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsReview(false)}
            className="flex-1 h-[48px] bg-[#FFFFFF] text-[#000000] font-bold border-[0.5px] border-[#8C8D8F] border-solid rounded-[5px] hover:border-[1px] hover:border-[#000000] hover:bg-[#EBEBEB] flex items-center justify-center gap-3 px-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}
          >
            <ChevronIcon direction="w" width={10} height={6} color="#000000" />
            <span>EDIT</span>
          </button>
          <button
            type="submit"
            disabled={isValidating}
            className="w-full h-[48px] bg-[#FF6F00] text-[#000000] font-bold border-b border-[#000000] border-solid rounded-[5px] hover:bg-[#FB9241] flex items-center justify-center"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}
          >
            {isValidating ? 'VALIDATING...' : transferType === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
          </button>
        </div>
      )}
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

  // Auto-populate recipient address when destination wallet is connected
  useEffect(() => {
    if (address) {
      setFieldValue('recipient', address);
      setRecipientValue && setRecipientValue(address);
    }
  }, [address, setFieldValue, setRecipientValue]);

  const onClick = () => {
    if (disabled) return;
    if (!address) {
      connectFn();
      setIsConnecting(true);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs text-secondary hover:text-[#000000] absolute right-0.5 top-2 bottom-0.5 px-2 ${
        disabled ? 'bg-[#DADADA]' : 'bg-[#FFFFFF]'
      }`}
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
          <span className="text-left text-[#595959] text-xs font-medium min-w-[7rem]">
            Local Gas (est.)
          </span>
          <span className="text-right text-[#000000] text-xs font-medium min-w-[7rem]">{`${
            fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.localQuote.token.symbol || ''}`}</span>
        </p>
      )}
      {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
        <p className="flex justify-between">
          <span className="text-left text-[#595959] text-xs font-medium min-w-[7rem]">
            Interchain Gas
          </span>
          <span className="text-right text-[#000000] text-xs font-medium min-w-[7rem]">{`${
            fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.interchainQuote.token.symbol || ''}`}</span>
        </p>
      )}
      <p className="flex justify-between">
        <span className="text-left text-[#595959] text-xs font-medium min-w-[7rem]">
          Time to Transfer
        </span>
        <span className="text-right text-[#000000] text-xs font-medium min-w-[7rem]">{`<1 Minute`}</span>
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

    if (!token) return { token: 'Token is required' };
    const amountWei = toWei(amount, token.decimals);
    const { address, publicKey: senderPubKey } = getAccountAddressAndPubKey(origin, accounts);

    const result = await getWarpCore().validateTransfer({
      originTokenAmount: token.amount(amountWei),
      destination,
      recipient,
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
