import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { TypedTransactionReceipt, WarpTxCategory } from '@hyperlane-xyz/sdk';
import { toTitleCase, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { mapRelayChainToInternalName } from '../chains/relayUtils';
import { AppState, useStore } from '../store';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import {
    getAccountAddressForChain,
    useAccounts,
    useActiveChains,
    useTransactionFns,
} from '../wallet/hooks/multiProtocol';

import { TransferContext, TransferFormValues, TransferStatus } from './types';
import { tryGetMsgIdFromTransferReceipt } from './utils';

export function useTokenTransfer(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const activeAccounts = useAccounts();
  const activeChains = useActiveChains();
  const transactionFns = useTransactionFns();
  const { relayChains } = useRelaySupportedChains();

  const [isLoading, setIsLoading] = useState(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    (values: TransferFormValues, wallet?: any) => {
      // Determine if this should use Relay or Hyperlane
      const protocol = getTransferProtocol(values.origin, values.destination, relayChains);
      const isRelayTransfer = protocol === 'relay';

      if (isRelayTransfer) {
        return executeRelayTransfer({
          values,
          transferIndex,
          activeAccounts,
          _activeChains: activeChains,
          _transactionFns: transactionFns,
          addTransfer,
          updateTransferStatus,
          setIsLoading,
          onDone,
          wallet,
          relayChains,
        });
      } else {
        return executeHyperlaneTransfer({
          values,
          transferIndex,
          activeAccounts,
          _activeChains: activeChains,
          _transactionFns: transactionFns,
          addTransfer,
          updateTransferStatus,
          setIsLoading,
          onDone,
        });
      }
    },
    [
      transferIndex,
      activeAccounts,
      activeChains,
      transactionFns,
      relayChains,
      setIsLoading,
      addTransfer,
      updateTransferStatus,
      onDone,
    ],
  );

  return {
    isLoading,
    triggerTransactions,
  };
}

// Helper function to determine transfer protocol
function getTransferProtocol(
  origin: string,
  destination: string,
  relayChains: any[],
): 'relay' | 'hyperlane' {
  // Import warp core to check Hyperlane availability
  const warpCore = getWarpCore();
  const hyperlaneChains = warpCore.getTokenChains();

  const isFormaInvolved =
    origin === 'forma' ||
    origin === 'sketchpad' ||
    destination === 'forma' ||
    destination === 'sketchpad';

  const isDeposit = destination === 'forma' || destination === 'sketchpad'; // TO Forma
  const isWithdrawal = origin === 'forma' || origin === 'sketchpad'; // FROM Forma

  const originIsRelay = isRelayChain(origin, relayChains);
  const destinationIsRelay = isRelayChain(destination, relayChains);
  const originIsHyperlane = hyperlaneChains.includes(origin);
  const destinationIsHyperlane = hyperlaneChains.includes(destination);

  // STRATEGY: More specific routing logic

  // 1. If both chains are available on Hyperlane, prefer Hyperlane
  if (originIsHyperlane && destinationIsHyperlane) {
    return 'hyperlane';
  }

  // 1a. Forma withdrawals to a Hyperlane destination should always use Hyperlane
  if (isWithdrawal && destinationIsHyperlane) {
    return 'hyperlane';
  }

  // 2. If Forma is involved and the other chain is Relay-only (not on Hyperlane), use Relay
  if (isFormaInvolved) {
    const otherChain = isDeposit ? origin : destination;
    const otherChainIsRelay = isRelayChain(otherChain, relayChains);
    const otherChainIsHyperlane = hyperlaneChains.includes(otherChain);

    // Use Relay if the other chain is available on Relay but NOT on Hyperlane
    if (otherChainIsRelay && !otherChainIsHyperlane) {
      return 'relay';
    }
  }

  // 3. If either chain is Relay-only (not available on Hyperlane), use Relay
  // But do not apply this rule for Forma withdrawals to Hyperlane destinations
  if (!isWithdrawal) {
    if ((originIsRelay && !originIsHyperlane) || (destinationIsRelay && !destinationIsHyperlane)) {
      return 'relay';
    }
  }

  // 4. Default to Hyperlane
  return 'hyperlane';
}

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName || !relayChains?.length) {
    return false;
  }

  const result = relayChains.some((chain) => {
    const internalName = mapRelayChainToInternalName(chain.name);
    const isMatch =
      internalName === chainName.toLowerCase() && chain.depositEnabled && !chain.disabled;
    return isMatch;
  });

  return result;
}

// Execute Relay transfer
async function executeRelayTransfer({
  values,
  transferIndex,
  activeAccounts,
  _activeChains,
  _transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
  wallet,
  relayChains,
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  _activeChains: ReturnType<typeof useActiveChains>;
  _transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
  wallet?: any;
  relayChains: any[];
}) {
  const { origin, destination, amount, recipient } = values;

  // const isDeposit = destination === 'forma' || destination === 'sketchpad'; // TO Forma
  // const isWithdrawal = origin === 'forma' || origin === 'sketchpad'; // FROM Forma

  setIsLoading(true);
  let transferStatus: TransferStatus = TransferStatus.Preparing;
  updateTransferStatus(transferIndex, transferStatus);

  try {
    const sender = getAccountAddressForChain(origin, activeAccounts.accounts);

    if (!sender) {
      throw new Error('Please connect your wallet to continue');
    }

    // Import Relay API functions
    const { getRelayQuote } = await import('./relaySdk');
    const { mapRelayChainToInternalName } = await import('../chains/relayUtils');

    // Get chain IDs from dynamic Relay data (not hardcoded)
    const originRelayChain = relayChains.find((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === origin.toLowerCase();
    });

    const destinationRelayChain = relayChains.find((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === destination.toLowerCase();
    });

    const originChainId = originRelayChain?.id;
    const destinationChainId = destinationRelayChain?.id;

    if (!originChainId || !destinationChainId) {
      throw new Error('Selected chains are not supported for this transfer');
    }

    // Determine if this is a deposit or withdrawal
    const isDeposit = destination === 'forma' || destination === 'sketchpad';
    const isWithdrawal = origin === 'forma' || origin === 'sketchpad';

    // DEBUG: Log transfer type and chain information

    // Get the correct token address/denomination for the origin chain
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    const getTokenAddressOrDenom = (chainName: string) => {
      // For deposits: use the selected token address or fallback to native token
      if (isDeposit) {
        return values.selectedToken?.address || '0x0000000000000000000000000000000000000000';
      }
      // For withdrawals: use the actual TIA token address on Forma/Sketchpad
      if (chainName === 'forma' || chainName === 'sketchpad') {
        // Use the actual TIA token address on Forma/Sketchpad
        return isMainnet
          ? '0x832d26B6904BA7539248Db4D58614251FD63dC05'
          : '0x2F9C0BCD2C37eE6211763E7688F7D6758FDdCF53';
      }
      return '0x0000000000000000000000000000000000000000';
    };

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: getTokenAddressOrDenom(origin),
      destTokenAddressOrDenom: getTokenAddressOrDenom(destination),
      // Store the full selectedToken object to preserve icon and metadata
      selectedToken: values.selectedToken,
      sender,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    // Step 1: Get a quote from Relay
    // Determine currencies based on transfer type (same logic as quote function)
    let originCurrency, destinationCurrency;

    if (isDeposit) {
      // Deposit: Relay token -> Forma TIA
      originCurrency =
        values.selectedToken?.address || '0x0000000000000000000000000000000000000000'; // Native token

      // Only use zero address for actual native tokens (ETH), not ERC20 tokens
      if (
        values.selectedToken?.symbol === 'ETH' &&
        values.selectedToken?.address === '0x0000000000000000000000000000000000000000'
      ) {
        originCurrency = '0x0000000000000000000000000000000000000000';
      }

      // Destination is always TIA on Forma
      destinationCurrency = '0x0000000000000000000000000000000000000000';
    } else if (isWithdrawal) {
      // Withdraw: Forma TIA -> Relay token
      originCurrency = '0x0000000000000000000000000000000000000000'; // TIA on Forma

      destinationCurrency =
        values.selectedToken?.address || '0x0000000000000000000000000000000000000000'; // Native token

      // Only use zero address for actual native tokens (ETH), not ERC20 tokens
      if (
        values.selectedToken?.symbol === 'ETH' &&
        values.selectedToken?.address === '0x0000000000000000000000000000000000000000'
      ) {
        destinationCurrency = '0x0000000000000000000000000000000000000000';
      }
    } else {
      // Fallback to old logic
      originCurrency = '0x0000000000000000000000000000000000000000'; // Native token
      destinationCurrency = '0x0000000000000000000000000000000000000000'; // Native token
    }

    // Calculate amount in wei
    let amountWei;
    if (isDeposit) {
      // For deposits: user specifies how much Relay token to send
      const decimals = values.selectedToken?.decimals || 18;
      amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals))).toString();
    } else if (isWithdrawal) {
      // For withdrawals: user specifies how much TIA to send
      const decimals = 18; // TIA has 18 decimals
      amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals))).toString();
    } else {
      // Fallback
      const decimals = 18;
      amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals))).toString();
    }

    await getRelayQuote({
      user: sender,
      recipient,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountWei,
      tradeType: 'EXACT_INPUT',
    });

    // Step 2: Execute via Relay SDK (no manual tx building)
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.SigningTransfer));

    // Ensure wallet is on the correct chain before executing
    if (wallet && wallet.switchChain && wallet.getChainId) {
      const currentChainId = await wallet.getChainId();
      if (currentChainId !== originChainId) {
        await wallet.switchChain({ id: originChainId });
      }
    }

    const { getClient } = await import('@reservoir0x/relay-sdk');
    const client = getClient();
    if (!client)
      throw new Error('Bridge service is temporarily unavailable. Please try again later.');

    const quote = await client.actions.getQuote({
      chainId: originChainId,
      toChainId: destinationChainId,
      currency: originCurrency,
      toCurrency: destinationCurrency,
      amount: amountWei,
      tradeType: 'EXACT_INPUT',
      user: sender,
      recipient,
      wallet,
    });

    const executeResult = await client.actions.execute({ quote, wallet });

    // Extract transaction hash from the execute result
    let relayTxHash: string | undefined;
    if (executeResult && typeof executeResult === 'object') {
      // Check if there's a requestId in the steps array (Relay SDK format)
      // The executeResult has a 'data' property that contains the actual response
      const responseData = (executeResult as any).data;
      if (responseData && responseData.steps && Array.isArray(responseData.steps) && responseData.steps.length > 0) {
        const firstStep = responseData.steps[0];
        if (firstStep && firstStep.requestId && typeof firstStep.requestId === 'string') {
          relayTxHash = firstStep.requestId;
        }
      }
      
      // Fallback: Try to extract hash from various possible response formats
      if (!relayTxHash) {
        if ('hash' in executeResult && typeof executeResult.hash === 'string') {
          relayTxHash = executeResult.hash;
        } else if ('transactionHash' in executeResult && typeof executeResult.transactionHash === 'string') {
          relayTxHash = executeResult.transactionHash;
        } else if ('txHash' in executeResult && typeof executeResult.txHash === 'string') {
          relayTxHash = executeResult.txHash;
        } else if ('id' in executeResult && typeof executeResult.id === 'string') {
          // Some APIs return an ID that can be used to track the transaction
          relayTxHash = executeResult.id;
        } else if (Array.isArray(executeResult) && executeResult.length > 0) {
          // If it's an array, look for transaction hashes in the first item
          const firstItem = executeResult[0];
          if (firstItem && typeof firstItem === 'object') {
            if ('hash' in firstItem && typeof firstItem.hash === 'string') {
              relayTxHash = firstItem.hash;
            } else if ('transactionHash' in firstItem && typeof firstItem.transactionHash === 'string') {
              relayTxHash = firstItem.transactionHash;
            } else if ('txHash' in firstItem && typeof firstItem.txHash === 'string') {
              relayTxHash = firstItem.txHash;
            }
          }
        }
      }
    }


    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      relayTxHash,
    });
    setIsLoading(false);
    if (onDone) onDone();
    return;
  } catch (error) {
    updateTransferStatus(transferIndex, TransferStatus.Failed);

    // Check if user cancelled the transaction
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorMsg = error instanceof Error ? error.message?.toLowerCase() : '';

    const isUserCancellation =
      errorStr.includes('user rejected') ||
      errorStr.includes('user denied') ||
      errorStr.includes('rejected the request') ||
      errorMsg.includes('user rejected') ||
      errorMsg.includes('user denied');

    if (isUserCancellation) {
      // Silent cancellation - just reset UI, no error toast
      setIsLoading(false);
      if (onDone) onDone();
      return;
    }

    // Log actual errors to console (not user cancellations)
    logger.error('=== RELAY TRANSFER ERROR ===', error);

    if (JSON.stringify(error).includes('ChainMismatchError')) {
      toast.error('Wallet must be connected to origin chain');
    } else if (error instanceof Error) {
      toast.error(error.message || 'Transfer failed');
    } else {
      toast.error('Transfer failed');
    }
    setIsLoading(false);
    if (onDone) onDone();
  }
}

// Execute Hyperlane transfer (existing logic)
async function executeHyperlaneTransfer({
  values,
  transferIndex,
  activeAccounts,
  _activeChains,
  _transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  _activeChains: ReturnType<typeof useActiveChains>;
  _transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
}) {
  setIsLoading(true);
  let transferStatus: TransferStatus = TransferStatus.Preparing;
  updateTransferStatus(transferIndex, transferStatus);

  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const originToken = getTokenByIndex(tokenIndex);
    const connection = originToken?.getConnectionForChain(destination);
    if (!originToken || !connection)
      throw new Error('Transfer between these chains is not currently supported');

    const originProtocol = originToken.protocol;
    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const originTokenAmount = originToken.amount(weiAmountOrId);

    const sendTransaction = _transactionFns[originProtocol].sendTransaction;
    const activeChain = _activeChains.chains[originProtocol];
    const sender = getAccountAddressForChain(origin, activeAccounts.accounts);
    if (!sender) throw new Error('Please connect your wallet to the origin chain');

    const warpCore = getWarpCore();

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
    });
    if (!isCollateralSufficient) {
      toast.error('Insufficient collateral on destination for transfer');
      throw new Error('Insufficient liquidity on destination chain. Please try a smaller amount.');
    }

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: originToken.addressOrDenom,
      destTokenAddressOrDenom: connection.token.addressOrDenom,
      // Store selectedToken for consistency with Relay transfers
      selectedToken: values.selectedToken,
      sender,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    const txs = await warpCore.getTransferRemoteTxs({
      originTokenAmount,
      destination,
      sender,
      recipient,
    });

    const hashes: string[] = [];
    let txReceipt: TypedTransactionReceipt | undefined = undefined;
    for (const tx of txs) {
      updateTransferStatus(transferIndex, (transferStatus = txCategoryToStatuses[tx.category][0]));
      const { hash, confirm } = await sendTransaction({
        tx,
        chainName: origin,
        activeChainName: activeChain.chainName,
      });
      updateTransferStatus(transferIndex, (transferStatus = txCategoryToStatuses[tx.category][1]));
      txReceipt = await confirm();
      const description = toTitleCase(tx.category);
      toastTxSuccess(`${description} transaction sent!`, hash, origin);
      hashes.push(hash);
    }

    const msgId = txReceipt ? tryGetMsgIdFromTransferReceipt(origin, txReceipt) : undefined;

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash: hashes.at(-1),
      msgId,
    });
  } catch (error) {
    updateTransferStatus(transferIndex, TransferStatus.Failed);

    // Check if user cancelled the transaction
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorMsg = error instanceof Error ? error.message?.toLowerCase() : '';

    const isUserCancellation =
      errorStr.includes('user rejected') ||
      errorStr.includes('user denied') ||
      errorStr.includes('rejected the request') ||
      errorMsg.includes('user rejected') ||
      errorMsg.includes('user denied');

    if (isUserCancellation) {
      // Silent cancellation - no error toast, just reset UI
    } else if (JSON.stringify(error).includes('ChainMismatchError')) {
      // Wagmi switchNetwork call helps prevent this but isn't foolproof
      toast.error('Wallet must be connected to origin chain');
    } else {
      toast.error(errorMessages[transferStatus] || 'Unable to transfer tokens.');
    }
  }

  setIsLoading(false);
  if (onDone) onDone();
}

const errorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: 'Error while preparing the transactions.',
  [TransferStatus.CreatingTxs]: 'Error while creating the transactions.',
  [TransferStatus.SigningApprove]: 'Error while signing the approve transaction.',
  [TransferStatus.ConfirmingApprove]: 'Error while confirming the approve transaction.',
  [TransferStatus.SigningTransfer]: 'Error while signing the transfer transaction.',
  [TransferStatus.ConfirmingTransfer]: 'Error while confirming the transfer transaction.',
};

const txCategoryToStatuses: Record<WarpTxCategory, [TransferStatus, TransferStatus]> = {
  [WarpTxCategory.Approval]: [TransferStatus.SigningApprove, TransferStatus.ConfirmingApprove],
  [WarpTxCategory.Transfer]: [TransferStatus.SigningTransfer, TransferStatus.ConfirmingTransfer],
  [WarpTxCategory.Revoke]: [TransferStatus.SigningApprove, TransferStatus.ConfirmingApprove],
};
