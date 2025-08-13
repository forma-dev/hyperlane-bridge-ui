/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useWalletClient } from 'wagmi';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, errorToString, isNullish, toWei } from '@hyperlane-xyz/utils';

// import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { ChevronIcon } from '../../components/icons/Chevron';
import { PolygonIcon } from '../../components/icons/PolygonIcon';
import { TextField } from '../../components/input/TextField';
import { getIndexForToken, getTokenByIndex, getTokens, getWarpCore } from '../../context/context';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { getRelayNativeTokenInfo } from '../chains/relayUtils';
import { tryGetChainProtocol } from '../chains/utils';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
// import { useIsApproveRequired } from '../tokens/approval';
import { useDestinationBalance, useOriginBalance } from '../tokens/balances';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import {
    getAccountAddressAndPubKey,
    getAccountAddressForChain,
    useAccountAddressForChain,
    useAccounts,
} from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

import { useFetchMaxAmount } from './maxAmount';
import { getNativeCurrency } from './relaySdk';
import { TransferFormValues } from './types';
import { useFeeQuotes } from './useFeeQuotes';
import { useRelayMaxAmount } from './useRelayMaxAmount';
import { useRelayQuote } from './useRelayQuote';
import { useTokenTransfer } from './useTokenTransfer';

// Removed VERIFIED_WORKING_CHAINS constant since we're now using all available Relay chains

function ChainChangeWatcher() {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination } = values;
  const prevChains = useRef({ origin, destination });

  useEffect(() => {
    // Check if chains have changed
    if (prevChains.current.origin !== origin || prevChains.current.destination !== destination) {
      // Clear form fields when chains change
      setFieldValue('amount', '');
      setFieldValue('recipient', '');

      // Update the ref with current values
      prevChains.current = { origin, destination };
    }
  }, [origin, destination, setFieldValue]);

  return null;
}

function TokenSelectionWatcher({ transferType }: { transferType: string }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination } = values;
  const { relayChains } = useRelaySupportedChains();
  const prevTransferType = useRef(transferType);

  useEffect(() => {
    // Trigger token reselection when transferType changes or when origin/destination change
    if (prevTransferType.current !== transferType || origin || destination) {
      // Special case: Forma withdrawals to ANY destination need Forma TIA token
      if ((origin === 'forma' || origin === 'sketchpad') && transferType === 'withdraw') {
        const tokens = getTokens();

        let formaToken = tokens.find(
          (token) =>
            token.chainName === origin && token.symbol === 'TIA' && token.protocol === 'ethereum',
        );

        if (!formaToken) {
          formaToken = tokens.find(
            (token) =>
              token.chainName === origin &&
              token.name?.toLowerCase().includes('tia') &&
              token.protocol === 'ethereum',
          );
        }

        if (!formaToken) {
          formaToken = tokens.find((token) => token.chainName === origin && token.symbol === 'TIA');
        }

        if (!formaToken) {
          formaToken = tokens.find((token) => token.chainName === origin);
        }

        if (formaToken) {
          setFieldValue('tokenIndex', getIndexForToken(formaToken));
        }
      }
      // Handle deposits: Select appropriate token for the origin chain
      else if (transferType === 'deposit') {
        const tokens = getTokens();

        // Find a token that exists on the origin chain
        const depositToken = tokens.find((token) => token.chainName === origin);

        if (depositToken) {
          setFieldValue('tokenIndex', getIndexForToken(depositToken));
        } else {
          // Reset to first available token as fallback
          setFieldValue('tokenIndex', 0);
        }
      }

      prevTransferType.current = transferType;
    }
  }, [transferType, origin, destination, setFieldValue, relayChains]);

  return null;
}

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
  // Accounts are not used directly here but kept for future validation flows
  // const { accounts } = useAccounts();
  const { relayChains } = useRelaySupportedChains();

  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);

  const { accounts } = useAccounts();
  const validate = (values: TransferFormValues) => validateForm(values, accounts, relayChains);

  const onSubmitForm = (values: TransferFormValues) => {
    setIsReview(true);
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
          <ChainChangeWatcher />
          <TokenSelectionWatcher transferType={transferType} />
          <div
            className="px-10 py-4 gap-y-6 flex flex-col"
            style={{ borderBottom: '0.5px solid #8C8D8F', borderTop: '0.5px solid #8C8D8F' }}
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
            <PolygonIcon className="text-border" />
          </div>

          <div className="px-10 pt-4 pb-8 gap-y-4 flex flex-col">
            <ChainSelectSection isReview={isReview} type="to" transferType={transferType} />

            <RecipientAddressField isReview={isReview} transferType={transferType} />

            {/* Show ReceiveSection for both deposits and withdraws */}
            <ReceiveSection isReview={isReview} transferType={transferType} />

            <ReviewDetails visible={isReview} />
          </div>

          {/* Move button outside the card */}
          <div className="px-10 pb-8">
            <ButtonSection
              isReview={isReview}
              isValidating={isValidating}
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
  const { relayChains } = useRelaySupportedChains();

  const chains = useMemo(() => {
    const hyperlaneChains = getWarpCore().getTokenChains();

    if (type === 'from' && transferType === 'deposit') {
      // For deposit FROM: Show Hyperlane chains AND Relay chains as separate options
      // Hyperlane chains: Celestia, Stride
      const hyperlaneFromChains = hyperlaneChains.filter(
        (chain) => !['forma', 'sketchpad'].includes(chain),
      );

      // Relay chains
      const relayChainNames = getRelayChainNames(relayChains);

      // Return combined list but keep them logically separate
      return [...hyperlaneFromChains, ...relayChainNames];
    }

    if (type === 'to' && transferType === 'deposit') {
      // For deposit TO: Always Forma/Sketchpad (destination) - no change needed
      return hyperlaneChains.filter((chain) => ['forma', 'sketchpad'].includes(chain));
    }

    if (type === 'from' && transferType === 'withdraw') {
      // For withdraw FROM: Always Forma/Sketchpad (source) - no change needed
      return hyperlaneChains.filter((chain) => ['forma', 'sketchpad'].includes(chain));
    }

    if (type === 'to' && transferType === 'withdraw') {
      // For withdraw TO: Show Hyperlane chains AND Relay chains as separate options
      // But for Hyperlane: Only Stride is supported for withdrawals from Forma
      const hyperlaneToChains = ['stride']; // Only Stride supported for Forma withdrawals
      const relayChainNames = getRelayChainNames(relayChains);

      return [...hyperlaneToChains, ...relayChainNames];
    }

    return hyperlaneChains;
  }, [relayChains, type, transferType]);

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

function RecipientAddressField({
  isReview,
  transferType,
}: {
  isReview: boolean;
  transferType: string;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();

  const destinationChain = values.destination;
  const destinationAccount = useAccountAddressForChain(destinationChain) || '';

  // Auto-populate with connected wallet on destination when available
  useEffect(() => {
    if (!values.recipient && destinationAccount) {
      setFieldValue('recipient', destinationAccount);
    }
  }, [destinationAccount, setFieldValue, values.recipient]);

  const onSelf = () => {
    setFieldValue('recipient', destinationAccount || '');
  };

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex justify-between pr-1 w-full">
        <label className="block text-sm text-secondary leading-5 font-medium">Address</label>
      </div>
      <div
        className={`group relative w-full h-[48px] flex items-center mt-1.5 rounded-card border border-solid border-[#8C8D8F] ${
          isReview ? 'bg-[#B5B5B5] cursor-not-allowed' : 'bg-white'
        } ${!isReview && 'hover:border-black'}`}
      >
        <TextField
          name="recipient"
          placeholder="0x... or destination address"
          classes={`w-full h-full p-3 pr-12 border-none bg-transparent placeholder:text-disabled focus:outline-none ${
            isReview ? '!text-secondary cursor-not-allowed' : 'text-black'
          }`}
          disabled={isReview}
          style={{
            fontSize: '16px',
          }}
        />
        <button
          type="button"
          onClick={onSelf}
          disabled={isReview || !destinationAccount}
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold underline ${
            isReview || !destinationAccount
              ? 'text-secondary cursor-not-allowed'
              : 'text-primary hover:opacity-80'
          }`}
        >
          SELF
        </button>
      </div>
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
  const originBalanceResult = useOriginBalance(values, transferType);
  const { balance } = originBalanceResult;
  const { relayChains } = useRelaySupportedChains();

  // Check if this is a Relay transfer
  const isRelayTransfer = isUsingRelayForTransfer(values.origin, values.destination, relayChains);

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block text-sm text-secondary leading-5 font-medium">
          Convert
        </label>
        {/* <TokenBalance label="My balance" balance={balance} /> */}
      </div>
      {isNft ? (
        <SelectOrInputTokenIds disabled={isReview} />
      ) : (
        <div
          className={`group relative w-full h-[60px] flex items-center mt-1.5 rounded-card border border-solid border-[#8C8D8F] ${
            isReview ? 'bg-[#B5B5B5] cursor-not-allowed' : 'bg-white'
          } ${!isReview && 'hover:border-black'}`}
        >
          <TextField
            id="amount-withdraw"
            name="amount"
            placeholder="0.00"
            classes={`w-full h-full p-3 border-none bg-transparent placeholder:text-disabled focus:outline-none ${
              isReview ? '!text-secondary cursor-not-allowed' : 'text-black'
            }`}
            type="number"
            step="any"
            disabled={isReview}
            style={{
              fontSize: '40px',
            }}
          />
          <div
            className={`h-full border-l border-[#8C8D8F] ${
              !isReview && 'group-hover:border-black'
            }`}
            style={{ borderLeftWidth: '0.5px' }}
          ></div>
          <TokenDisplaySection
            chain={values.origin}
            isRelay={isRelayTransfer}
            selectedToken={transferType === 'deposit' ? (values.selectedToken as any) : undefined}
            transferType={transferType}
            section="convert"
          />
        </div>
      )}
      <div className="pt-1 flex items-center justify-between">
        <div className="min-h-[1rem]">
          {isRelayTransfer && (
            <QuoteErrorDisplay
              originChain={values.origin}
              destinationChain={values.destination}
              amount={values.amount}
              transferType={transferType}
              selectedToken={values.selectedToken}
            />
          )}
        </div>
        <div className="text-right">
          <TokenBalance
            label="BALANCE"
            balance={balance}
            disabled={isReview}
            transferType={transferType}
          />
        </div>
      </div>
    </div>
  );
}

function TokenBalance({
  label,
  balance,
  disabled,
  transferType,
}: {
  label: string;
  balance?: TokenAmount | { getDecimalFormattedAmount: () => number } | null;
  disabled?: boolean;
  transferType: string;
}) {
  const value = balance ? new BigNumber(balance.getDecimalFormattedAmount()).toFixed(4) : '0';
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination, tokenIndex } = values;
  const { accounts } = useAccounts();
  const { fetchMaxAmount } = useFetchMaxAmount();
  const { relayChains } = useRelaySupportedChains();

  // Check if this is a Relay deposit
  const isRelayDeposit =
    transferType === 'deposit' &&
    (destination === 'forma' || destination === 'sketchpad') &&
    relayChains.some((rc) => {
      const internalName = rc.name.toLowerCase();
      return internalName === origin.toLowerCase();
    });

  // Use Relay max amount hook for Relay deposits
  const { calculateMaxAmount: calculateRelayMaxAmount, isLoading: isRelayLoading } =
    useRelayMaxAmount({
      balance: balance as { getDecimalFormattedAmount: () => number },
      origin,
      destination,
      transferType,
      setFieldValue,
    });

  const onClick = async () => {
    if (!balance || isNullish(tokenIndex) || disabled) return;

    // For Relay deposits, use the Relay max amount calculation
    if (isRelayDeposit) {
      await calculateRelayMaxAmount();
      return;
    }

    // Only use fetchMaxAmount for full TokenAmount objects
    if ('token' in balance && 'amount' in balance) {
      // This is a full TokenAmount from Hyperlane
      const tokenAmount = balance as TokenAmount;
      const maxAmount = await fetchMaxAmount({
        balance: tokenAmount,
        origin,
        destination,
        accounts,
      });
      if (isNullish(maxAmount)) return;

      const decimalsAmount = maxAmount.getDecimalFormattedAmount();
      const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
      setFieldValue('amount', roundedAmount);
    } else {
      // This is a simple Relay balance - use the full amount
      const decimalsAmount = balance.getDecimalFormattedAmount();
      const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
      setFieldValue('amount', roundedAmount);
    }

    // Set the color of the input field to #FFFFFF
    const inputField = document.getElementById('amount-withdraw'); // Assuming id of the input field is 'amount-input'
    if (inputField) {
      inputField.style.color = '#000000';
    }
  };
  return (
    <div className="text-[12px] font-medium leading-5 text-secondary">
      {label}:
      <button type="button" disabled={disabled || isRelayLoading} onClick={onClick}>
        <span
          className={`font-semibold ${
            disabled || isRelayLoading ? '' : 'underline ml-1.5 hover:text-primary'
          }`}
        >
          {isRelayLoading ? 'Calculating...' : value}
        </span>
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
  const { data: wallet } = useWalletClient();
  // const { switchChainAsync } = useSwitchChain();
  const { relayChains } = useRelaySupportedChains();

  // Check if this is a Relay transfer
  const isRelayTransfer = isUsingRelayForTransfer(values.origin, values.destination, relayChains);

  // Get user address for origin chain
  const userAddress = useAccountAddressForChain(values.origin) || '';

  // Get recipient address - always call the hook, handle errors in the quote
  const destinationAddress = useAccountAddressForChain(values.destination) || '';
  const recipientAddress = destinationAddress || userAddress;

  // Get quote error for Relay transfers
  const { error: quoteError } = useRelayQuote({
    originChain: values.origin,
    destinationChain: values.destination,
    amount: values.amount,
    transferType,
    relayChains,
    user: userAddress,
    recipient: recipientAddress,
    selectedToken: values.selectedToken,
  });

  // Disable button if there's a quote error for Relay transfers
  const isDisabled = isRelayTransfer && !!quoteError;

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
    setTransferLoading(true);
    try {
      // For Relay transfers, let the Relay SDK handle wallet connection and chain switching
      // The Relay SDK will automatically handle switching to the correct network
      await triggerTransactions(values, wallet);
    } catch (err: any) {
      setTransferLoading(false);
      if (err?.message?.toLowerCase().includes('user rejected')) {
        toast.error('You must switch to the correct network to proceed.');
      } else {
        toast.error(err?.message || 'Failed to switch network.');
      }
    }
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
        classes="flex-1 px-3 py-8 max-h-12"
        icon={<ChevronIcon direction="w" width={10} height={6} color={Color.primaryBlack} />}
      >
        <span className="text-sm text-black font-bold leading-6">EDIT</span>
      </SolidButton>
      <SolidButton
        type="button"
        color="button"
        onClick={triggerTransactionsHandler}
        classes="flex-1 px-3 py-8 text-sm max-h-16 font-bold uppercase"
        disabled={isDisabled}
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

function ReviewDetails({ visible }: { visible: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { relayChains } = useRelaySupportedChains();

  // Only fetch fee quotes for Hyperlane transfers, not Relay transfers
  const { accounts: reviewAccounts } = useAccounts();
  const isUsingRelay = isUsingRelayForTransfer(
    values.origin,
    values.destination,
    relayChains,
    reviewAccounts,
  );
  const { fees } = useFeeQuotes(values, visible && !isUsingRelay);

  // For Relay transfers, get fee information from Relay quote
  const user = useAccountAddressForChain(values.origin);

  // Get destination user - always call the hook
  const destinationUser = useAccountAddressForChain(values.destination) || user;

  const recipient = values.recipient || destinationUser || '';

  // Determine transfer type based on origin and destination
  const transferType = (() => {
    if (values.destination === 'forma' || values.destination === 'sketchpad') {
      return 'deposit';
    } else if (values.origin === 'forma' || values.origin === 'sketchpad') {
      return 'withdraw';
    }
    return '';
  })();

  const { estimatedOutput } = useRelayQuote({
    originChain: values.origin,
    destinationChain: values.destination,
    amount: values.amount,
    transferType: transferType,
    relayChains,
    user: user || '',
    recipient: recipient || '',
    selectedToken: values.selectedToken,
  });

  // Extract fee information from Relay quote if available
  const relayQuote = estimatedOutput?.quote;
  const relayFees = relayQuote?.fees;

  // For deposits, if estimatedOutput is null, try to get fees from the working transfer form logic
  const [depositFees, setDepositFees] = useState(null);

  useEffect(() => {
    if (transferType === 'deposit' && !estimatedOutput && values.amount && user && recipient) {
      const fetchDepositFees = async () => {
        try {
          const { getClient } = await import('@reservoir0x/relay-sdk');
          const client = getClient();
          if (client) {
            // Get chain IDs from dynamic Relay data (not hardcoded)
            const { mapRelayChainToInternalName } = await import('../chains/relayUtils');
            
            const originRelayChain = relayChains.find(chain => {
              const internalName = mapRelayChainToInternalName(chain.name);
              return internalName === values.origin.toLowerCase();
            });
            
            const destinationRelayChain = relayChains.find(chain => {
              const internalName = mapRelayChainToInternalName(chain.name);
              return internalName === values.destination.toLowerCase();
            });
            
            const originChainId = originRelayChain?.id;
            const destinationChainId = destinationRelayChain?.id;
            if (!originChainId || !destinationChainId) return;

            // Resolve currencies
            const originCurrency =
              values.selectedToken?.address ||
              (values.selectedToken as any)?.currency ||
              (values.selectedToken as any)?.contractAddress ||
              getNativeCurrency(values.origin);

            const toCurrency = '0x0000000000000000000000000000000000000000'; // TIA on Forma

            const decimals = values.selectedToken?.decimals ?? 18;
            const amountWei = (
              parseFloat(
                typeof values.amount === 'string' ? values.amount : String(values.amount),
              ) * Math.pow(10, decimals)
            ).toString();

            const quote = await client.actions.getQuote({
              chainId: originChainId,
              toChainId: destinationChainId,
              currency: originCurrency,
              toCurrency,
              amount: amountWei,
              tradeType: 'EXACT_INPUT',
              user,
              recipient,
            });

            if (quote?.fees) setDepositFees(quote.fees as any);
          }
        } catch (err) {
          // Swallow and keep UI minimal; user will still be able to proceed
        }
      };
      fetchDepositFees();
    }
  }, [
    transferType,
    values.amount,
    values.origin,
    values.destination,
    values.selectedToken,
    user,
    recipient,
    estimatedOutput,
  ]);

  // Use depositFees for deposits if relayFees is not available
  const finalRelayFees = relayFees || (transferType === 'deposit' ? depositFees : null);

  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      {/* Show Hyperlane fees for Hyperlane transfers */}
      {!isUsingRelay && fees?.localQuote && fees.localQuote.amount > 0n && (
        <p className="flex justify-between">
          <span className="text-left text-secondary text-14px font-medium min-w-[7rem]">
            Local Gas (est.)
          </span>
          <span className="text-right text-primary text-14px font-bold min-w-[7rem]">{`${
            fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.localQuote.token.symbol || ''}`}</span>
        </p>
      )}
      {!isUsingRelay && fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
        <p className="flex justify-between">
          <span className="text-left text-secondary text-14px font-medium min-w-[7rem]">
            Interchain Gas
          </span>
          <span className="text-right text-primary text-14px font-bold min-w-[7rem]">{`${
            fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'
          } ${fees.interchainQuote.token.symbol || ''}`}</span>
        </p>
      )}

      {/* Show Relay fees for Relay transfers */}
      {isUsingRelay && finalRelayFees && (
        <>
          {finalRelayFees.gas &&
            finalRelayFees.gas.amountFormatted &&
            parseFloat(finalRelayFees.gas.amountFormatted) > 0 && (
              <p className="flex justify-between">
                <span className="text-left text-secondary text-14px font-medium min-w-[7rem]">
                  Gas Fee (est.)
                </span>
                <span className="text-right text-primary text-14px font-bold min-w-[7rem]">
                  {(() => {
                    const amount = parseFloat(finalRelayFees.gas.amountFormatted);
                    const symbol = finalRelayFees.gas.currency?.symbol || 'Unknown';
                    const formattedAmount = amount.toFixed(6);
                    const usdValue = finalRelayFees.gas.amountUsd
                      ? `(~$${parseFloat(finalRelayFees.gas.amountUsd).toFixed(2)})`
                      : '';
                    return `${formattedAmount} ${symbol} ${usdValue}`;
                  })()}
                </span>
              </p>
            )}
          {finalRelayFees.relayer &&
            finalRelayFees.relayer.amountFormatted &&
            parseFloat(finalRelayFees.relayer.amountFormatted) > 0 && (
              <p className="flex justify-between">
                <span className="text-left text-secondary text-14px font-medium min-w-[7rem]">
                  Relay Fee
                </span>
                <span className="text-right text-primary text-14px font-bold min-w-[7rem]">
                  {(() => {
                    const amount = parseFloat(finalRelayFees.relayer.amountFormatted);
                    const symbol = finalRelayFees.relayer.currency?.symbol || 'Unknown';
                    const formattedAmount = amount.toFixed(6);
                    const usdValue = finalRelayFees.relayer.amountUsd
                      ? `(~$${parseFloat(finalRelayFees.relayer.amountUsd).toFixed(2)})`
                      : '';
                    return `${formattedAmount} ${symbol} ${usdValue}`;
                  })()}
                </span>
              </p>
            )}
        </>
      )}

      <p className="flex justify-between">
        <span className="text-left text-secondary text-14px font-medium min-w-[7rem]">
          Time to Transfer
        </span>
        <span className="text-right text-primary text-14px font-bold min-w-[7rem]">{`<1 Minute`}</span>
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
  relayChains: any[],
) {
  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;

    if (!amount || parseFloat(amount) <= 0) return { amount: 'Valid amount is required' };
    if (!recipient) return { recipient: 'Recipient address is required' };

    const { address, publicKey: senderPubKey } = getAccountAddressAndPubKey(origin, accounts);

    if (!address) return { origin: 'Please connect wallet for origin chain' };

    // Determine if this should use Relay or Hyperlane based on connected wallets
    const isRelayTransfer = isUsingRelayForTransfer(origin, destination, relayChains, accounts);

    if (isRelayTransfer) {
      // Relay-specific validation (no token requirement)
      return await validateRelayTransfer({
        origin,
        destination,
        amount,
        recipient,
        sender: address,
        accounts,
        relayChains,
      });
    } else {
      // Hyperlane validation (existing logic)
      const token = getTokenByIndex(tokenIndex);
      if (!token) return { token: 'Token is required' };

      const amountWei = toWei(amount, token.decimals);
      const result = await getWarpCore().validateTransfer({
        originTokenAmount: token.amount(amountWei),
        destination,
        recipient,
        sender: address || '',
        senderPubKey: await senderPubKey,
      });
      return result;
    }
  } catch (error) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    if (insufficientFundsErrMsg.test(errorMsg)) {
      errorMsg = 'Insufficient funds for gas fees';
    }
    return { form: errorMsg };
  }
}

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName || !relayChains?.length) {
    return false;
  }

  const result = relayChains.some((chain) => {
    const internalName = mapRelayChainToInternalName(chain.name);
    // Treat any chain present in Relay list as Relay-supported, regardless of deposit/disabled flags
    return internalName === chainName.toLowerCase();
  });

  return result;
}

// Helper function to determine if using Relay for transfer
function isUsingRelayForTransfer(
  origin: string,
  destination: string,
  relayChains: any[],
  accounts?: Record<ProtocolType, AccountInfo>,
): boolean {
  // Import warp core to check Hyperlane availability
  const warpCore = getWarpCore();
  const hyperlaneChains = warpCore.getTokenChains();

  const isFormaInvolved =
    origin === 'forma' ||
    origin === 'sketchpad' ||
    destination === 'forma' ||
    destination === 'sketchpad';

  const isDeposit = destination === 'forma' || destination === 'sketchpad'; // TO Forma

  const originIsRelay = isRelayChain(origin, relayChains);
  const destinationIsRelay = isRelayChain(destination, relayChains);
  const originIsHyperlane = hyperlaneChains.includes(origin);
  const destinationIsHyperlane = hyperlaneChains.includes(destination);

  // Check which wallets are actually connected
  const destinationWalletConnected = accounts
    ? getAccountAddressForChain(destination, accounts)
    : null;

  if (destinationWalletConnected) {
    const destinationProtocol = tryGetChainProtocol(destination);

    // If destination is Cosmos (Hyperlane), prefer Hyperlane
    if (destinationProtocol === ProtocolType.Cosmos && destinationIsHyperlane) {
      return false; // Use Hyperlane
    }

    // If destination is EVM and it's Relay-only (not on Hyperlane), prefer Relay
    if (
      destinationProtocol === ProtocolType.Ethereum &&
      destinationIsRelay &&
      !destinationIsHyperlane
    ) {
      return true; // Use Relay
    }
  }

  // 1. If both chains are available on Hyperlane, prefer Hyperlane (return false for Relay)
  if (originIsHyperlane && destinationIsHyperlane) {
    return false; // Use Hyperlane
  }

  // 2. If Forma is involved and the other chain is Relay-only (not on Hyperlane), use Relay
  if (isFormaInvolved) {
    const otherChain = isDeposit ? origin : destination;
    const otherChainIsRelay = isRelayChain(otherChain, relayChains);
    const otherChainIsHyperlane = hyperlaneChains.includes(otherChain);

    // Use Relay if the other chain is available on Relay but NOT on Hyperlane
    if (otherChainIsRelay && !otherChainIsHyperlane) {
      return true; // Use Relay
    }
  }

  // 3. If either chain is Relay-only (not available on Hyperlane), use Relay
  if ((originIsRelay && !originIsHyperlane) || (destinationIsRelay && !destinationIsHyperlane)) {
    return true; // Use Relay
  }

  // 4. Default to Hyperlane
  return false; // Use Hyperlane
}

// Helper function to map Relay chain names to internal names
function mapRelayChainToInternalName(relayChainName: string): string {
  // Use the chain name directly as the internal name, but ensure it's lowercase
  return relayChainName.toLowerCase();
}

// Relay-specific validation
async function validateRelayTransfer({
  origin,
  destination,
  amount,
  recipient,
  sender,
  accounts,
  relayChains,
}: {
  origin: string;
  destination: string;
  amount: string;
  recipient: string;
  sender: string;
  accounts: Record<ProtocolType, AccountInfo>;
  relayChains: any[];
}): Promise<any> {
  try {
    // Validate origin chain wallet connection (required for Relay transfers)
    const originProtocol = tryGetChainProtocol(origin) || ProtocolType.Ethereum;
    const originAccount = accounts[originProtocol];

    if (!originAccount.isReady) {
      return { origin: `Please connect ${originProtocol} wallet for ${origin}` };
    }

    // Validate recipient address format based on destination protocol
    const destinationProtocol = tryGetChainProtocol(destination) || ProtocolType.Ethereum;

    if (destinationProtocol === ProtocolType.Cosmos) {
      // Basic Cosmos address validation (bech32 format)
      if (!recipient.startsWith(destination)) {
        return { recipient: `Recipient address must be a valid ${destination} address` };
      }
    } else {
      // Basic Ethereum address validation
      if (!recipient.startsWith('0x') || recipient.length !== 42) {
        return { recipient: 'Recipient address must be a valid Ethereum address' };
      }
    }

    // Additional amount validation
    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return { amount: 'Amount must be greater than 0' };
    }

    return {};
  } catch (error) {
    logger.error('Error validating Relay transfer', error);
    return { form: 'Unable to validate transfer. Please try again.' };
  }
}

// Utility function to get available chain names from Relay supported chains
function getRelayChainNames(relayChains: any[]): string[] {
  const chainNames: string[] = [];

  // Add all Relay supported chains regardless of deposit/disabled flags
  relayChains.forEach((chain) => {
    if (chain.name) {
      // Use the chain name directly as the internal name
      const internalName = chain.name.toLowerCase();

      // Include all chains that are not already in the list
      if (internalName && !chainNames.includes(internalName)) {
        chainNames.push(internalName);
      }
    }
  });

  return chainNames;
}

function ReceiveSection({ isReview, transferType }: { isReview: boolean; transferType: string }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { relayChains } = useRelaySupportedChains();

  // Get user address for the origin chain
  const user = useAccountAddressForChain(values.origin);

  // Get user address for the destination chain (for both deposits and withdraws) - always call the hook
  const destinationUser = useAccountAddressForChain(values.destination) || user;

  // For both deposits and withdraws, use destination user address as recipient if no recipient is set
  const recipient = values.recipient || destinationUser || '';

  // Check if this is a Relay transfer
  const { accounts } = useAccounts();
  const isUsingRelay = isUsingRelayForTransfer(
    values.origin,
    values.destination,
    relayChains,
    accounts,
  );

  // For Relay transfers, use Relay quote
  const { estimatedOutput } = useRelayQuote({
    originChain: values.origin,
    destinationChain: values.destination,
    amount: values.amount,
    transferType,
    relayChains,
    user: user || '',
    recipient: recipient || '',
    selectedToken: values.selectedToken,
  });

  // For Hyperlane transfers, use the same amount as input
  const hyperlaneReceiveAmount = isUsingRelay ? '' : values.amount;

  const destinationBalanceResult = useDestinationBalance(values, transferType);
  const { balance: destinationBalance } = destinationBalanceResult;

  // Always show for deposits and withdraws
  const shouldShowReceive = transferType === 'deposit' || transferType === 'withdraw';

  if (!shouldShowReceive) {
    return null;
  }

  // Determine the receive amount to display
  const displayAmount = isUsingRelay
    ? estimatedOutput?.formatted || ''
    : hyperlaneReceiveAmount || '';

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label className="block text-sm text-secondary leading-5 font-medium">Receive</label>
      </div>
      <div
        className={`group relative w-full h-[60px] flex items-center mt-1.5 rounded-card border border-solid border-[#8C8D8F] ${
          isReview ? 'bg-[#B5B5B5] cursor-not-allowed' : 'bg-white'
        } ${!isReview && 'hover:border-black'}`}
      >
        <TextField
          name="receiveAmount"
          placeholder="0.00"
          value={displayAmount}
          classes={`w-full h-full p-3 border-none bg-transparent placeholder:text-disabled focus:outline-none ${
            isReview ? '!text-secondary cursor-not-allowed' : 'text-black'
          }`}
          type="number"
          step="any"
          disabled={isReview}
          style={{
            fontSize: '40px',
          }}
        />
        <div
          className={`h-full border-l border-[#8C8D8F] ${!isReview && 'group-hover:border-black'}`}
          style={{ borderLeftWidth: '0.5px' }}
        ></div>
        <TokenDisplaySection
          chain={values.destination}
          isRelay={isUsingRelay}
          selectedToken={transferType === 'withdraw' ? values.selectedToken : undefined}
          transferType={transferType}
          section="receive"
        />
      </div>
      <div className="pt-1 text-right">
        <TokenBalance
          label="BALANCE"
          balance={destinationBalance}
          disabled={isReview}
          transferType={transferType}
        />
      </div>
    </div>
  );
}

function TokenDisplaySection({
  chain,
  isRelay,
  selectedToken,
  transferType,
  section,
}: {
  chain: string;
  isRelay: boolean;
  selectedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    chainId: number;
  };
  transferType: string;
  section: 'convert' | 'receive';
}) {
  const formatTokenSymbol = (symbol?: string) => {
    if (!symbol) return '';
    const trimmed = symbol.trim();
    return trimmed.length > 4 ? `${trimmed.slice(0, 4)}..` : trimmed;
  };
  const { relayChains } = useRelaySupportedChains();

  // For deposits: only the receive section should always show Forma TIA
  if (transferType === 'deposit' && section === 'receive') {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        <Image
          src="/logos/celestia.png"
          alt="TIA"
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="text-sm font-medium text-gray-700">TIA</span>
      </div>
    );
  }

  // For withdrawals: only the receive section should show selected token (but only for Relay chains)
  if (
    transferType === 'withdraw' &&
    section === 'receive' &&
    selectedToken &&
    selectedToken.symbol &&
    isRelay
  ) {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        {selectedToken.logoURI ? (
          <Image
            src={`/api/proxy-image?url=${encodeURIComponent(selectedToken.logoURI)}`}
            alt={selectedToken.symbol}
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <ChainLogo chainName={chain} size={24} />
        )}
        <span className="text-sm font-medium text-gray-700">
          {formatTokenSymbol(selectedToken.symbol)}
        </span>
      </div>
    );
  }

  // For withdrawals: receive section should default to TIA if no token is selected
  if (transferType === 'withdraw' && section === 'receive') {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        <Image
          src="/logos/celestia.png"
          alt="TIA"
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="text-sm font-medium text-gray-700">TIA</span>
      </div>
    );
  }

  // For withdrawals: convert section should always show TIA
  if (transferType === 'withdraw' && section === 'convert') {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        <Image
          src="/logos/celestia.png"
          alt="TIA"
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="text-sm font-medium text-gray-700">TIA</span>
      </div>
    );
  }

  // Always show TIA for Forma/Sketchpad chains regardless of transfer type
  if (chain === 'forma' || chain === 'sketchpad') {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        <Image
          src="/logos/celestia.png"
          alt="TIA"
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="text-sm font-medium text-gray-700">TIA</span>
      </div>
    );
  }

  // For Hyperlane chains (non-Relay), always show TIA
  if (!isRelay) {
    return (
      <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
        <Image
          src="/logos/celestia.png"
          alt="TIA"
          width={24}
          height={24}
          className="rounded-full"
        />
        <span className="text-sm font-medium text-gray-700">TIA</span>
      </div>
    );
  }

  // For Relay transfers, show selected token if available, otherwise fall back to chain logo
  if (selectedToken && selectedToken.symbol) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 h-full min-w-[100px]">
        {selectedToken.logoURI ? (
          <Image
            src={`/api/proxy-image?url=${encodeURIComponent(selectedToken.logoURI)}`}
            alt={selectedToken.symbol}
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <ChainLogo chainName={chain} size={24} />
        )}
        <span className="text-sm font-medium text-gray-700">
          {formatTokenSymbol(selectedToken.symbol)}
        </span>
      </div>
    );
  }

  // Fallback to chain logo and native token symbol
  const currencyInfo = getRelayNativeTokenInfo(chain, relayChains);
  const currencySymbol = currencyInfo?.symbol || 'Unknown';

  return (
    <div className="flex items-center gap-2 pl-[14px] pr-3 py-2 h-full min-w-[105px]">
      <ChainLogo chainName={chain} size={24} />
      <span className="text-sm font-medium text-gray-700">{formatTokenSymbol(currencySymbol)}</span>
    </div>
  );
}

function QuoteErrorDisplay({
  originChain,
  destinationChain,
  amount,
  transferType,
  selectedToken,
}: {
  originChain: string;
  destinationChain: string;
  amount: string;
  transferType: string;
  selectedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    chainId: number;
  };
}) {
  const { relayChains } = useRelaySupportedChains();

  // Get user address for the origin chain
  const user = useAccountAddressForChain(originChain);

  // Get user address for the destination chain - always call the hook
  const destinationUser = useAccountAddressForChain(destinationChain) || user;

  // For both deposits and withdraws, use destination user address as recipient if no recipient is set
  const recipient = destinationUser || '';

  // Use the same quote hook to get error information
  const { error } = useRelayQuote({
    originChain,
    destinationChain,
    amount,
    transferType,
    relayChains,
    user: user || '',
    recipient: recipient || '',
    selectedToken,
    // Note: wallet is not passed here as it's optional for quotes
  });

  if (!error) {
    return null;
  }

  return <div className="text-red-500 text-[12px]">{error}</div>;
}

// (unused) ChainLogoSection removed
