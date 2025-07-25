import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { ProviderType, TypedTransactionReceipt, WarpTxCategory } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { mapRelayChainToInternalName } from '../chains/relayUtils';
import { tryGetChainProtocol } from '../chains/utils';
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
          transactionFns,
          addTransfer,
          updateTransferStatus,
          setIsLoading,
          onDone,
          wallet,
        });
      } else {
        return executeHyperlaneTransfer({
          values,
          transferIndex,
          activeAccounts,
          activeChains,
          transactionFns,
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
  // const isWithdrawal = origin === 'forma' || origin === 'sketchpad'; // FROM Forma

  const originIsRelay = isRelayChain(origin, relayChains);
  const destinationIsRelay = isRelayChain(destination, relayChains);
  const originIsHyperlane = hyperlaneChains.includes(origin);
  const destinationIsHyperlane = hyperlaneChains.includes(destination);

  // STRATEGY: More specific routing logic

  // 1. If both chains are available on Hyperlane, prefer Hyperlane
  if (originIsHyperlane && destinationIsHyperlane) {
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
  if ((originIsRelay && !originIsHyperlane) || (destinationIsRelay && !destinationIsHyperlane)) {
    return 'relay';
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
  transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
  wallet,
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
  wallet?: any;
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
      throw new Error('No active account found for origin chain');
    }

    // Import Relay API functions
    const { getRelayQuote, executeRelaySwapSingleOrigin, getRelayChainId, getNativeCurrency } =
      await import('./relaySdk');

    // Get chain IDs for Relay API
    const originChainIds = getRelayChainId(origin);
    const destinationChainIds = getRelayChainId(destination);

    // For now, try mainnet first to test currency format
    // If either chain requires testnet, use testnet for both
    const needsTestnet = false; // Temporarily force mainnet to test currency format
    // const needsTestnet = destinationChainIds.mainnet === null || originChainIds.mainnet === null ||
    //                     destinationChainIds.testnet === 984123 || originChainIds.testnet === 984123; // Check for sketchpad testnet

    const originChainId = needsTestnet ? originChainIds.testnet : originChainIds.mainnet;
    const destinationChainId = needsTestnet
      ? destinationChainIds.testnet
      : destinationChainIds.mainnet;

    if (!originChainId || !destinationChainId) {
      throw new Error(`Unsupported chain for Relay: ${origin} -> ${destination}`);
    }

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: getNativeCurrency(origin),
      destTokenAddressOrDenom: 'TIA',
      sender,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    // Step 1: Get a quote from Relay
    const originCurrency = getNativeCurrency(origin);
    const destinationCurrency = getNativeCurrency(destination);

    // CRITICAL: Both ETH and TIA tokens use 18 decimals for Relay API
    // TIA token on Forma has 18 decimals (same as ETH)
    const decimals = 18;
    const amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();

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

    // Step 2: Execute the swap using NEW API format
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.SigningTransfer));

    // For now, pass null wallet to let Relay SDK handle wallet detection
    const walletToUse = wallet || null;

    const swapResponse = await executeRelaySwapSingleOrigin({
      user: sender,
      recipient,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountWei,
      tradeType: 'EXACT_INPUT',
      wallet: walletToUse,
    });

    // Step 3: Execute the transactions from the swap response
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmingTransfer));

    const originProtocol = tryGetChainProtocol(origin) || ProtocolType.Ethereum;
    const sendTransaction = transactionFns[originProtocol].sendTransaction;

    // Execute each step from the Relay response (NEW STRUCTURE)
    const hashes: string[] = [];

    // Use the correct path for steps (swapResponse.data.steps)
    const steps = (swapResponse as any).data?.steps;
    // If steps is missing or not an array, log the response and check for hashes
    if (!steps || !Array.isArray(steps)) {
      logger.warn('Relay swapResponse missing or invalid steps:', swapResponse);
      // If hashes were somehow created, treat as success
      if (hashes.length > 0) {
        updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
          originTxHash: hashes.at(-1),
        });
        setIsLoading(false);
        if (onDone) onDone();
        return;
      } else {
        updateTransferStatus(transferIndex, TransferStatus.Failed);
        throw new Error('Invalid response structure from Relay API - no steps found');
      }
    }

    for (const step of steps) {
      if (!step.items || !Array.isArray(step.items)) {
        continue;
      }
      for (const item of step.items) {
        // Check if this is an incomplete transaction that needs to be executed
        if (item.status === 'incomplete' && item.data) {
          const tx = {
            type: ProviderType.EthersV5,
            transaction: {
              to: item.data.to,
              data: item.data.data,
              value: item.data.value,
              from: item.data.from,
              // CRITICAL: Set chainId from the transaction data
              chainId: item.data.chainId,
              // Include gas fields if provided by new API
              ...(item.data.maxFeePerGas && { maxFeePerGas: item.data.maxFeePerGas }),
              ...(item.data.maxPriorityFeePerGas && {
                maxPriorityFeePerGas: item.data.maxPriorityFeePerGas,
              }),
            },
          };
          const result = await sendTransaction({
            tx,
            chainName: origin,
          });
          const { hash } = result;
          hashes.push(hash);
          // Show success toast
          const { toastTxSuccess } = await import('../../components/toast/TxSuccessToast');
          toastTxSuccess(`${step.action} completed!`, hash, origin);
        } else if (item.status === 'complete') {
          // Extract hashes from txHashes or internalTxHashes (handle string or object)
          if (Array.isArray(item.txHashes)) {
            for (const tx of item.txHashes) {
              if (typeof tx === 'string') {
                hashes.push(tx);
              } else if (tx && tx.txHash) {
                hashes.push(tx.txHash);
              } else if (tx && tx.hash) {
                hashes.push(tx.hash);
              }
            }
          }
          if (Array.isArray(item.internalTxHashes)) {
            for (const tx of item.internalTxHashes) {
              if (typeof tx === 'string') {
                hashes.push(tx);
              } else if (tx && tx.txHash) {
                hashes.push(tx.txHash);
              } else if (tx && tx.hash) {
                hashes.push(tx.hash);
              }
            }
          }
        }
      }
    }
    if (hashes.length === 0) {
      updateTransferStatus(transferIndex, TransferStatus.Failed);
      throw new Error('No transactions found to execute in Relay response');
    }
    // If we have hashes, always show success and clear error state
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash: hashes.at(-1),
    });
    setIsLoading(false);
    if (onDone) onDone();
    return;
  } catch (error) {
    updateTransferStatus(transferIndex, TransferStatus.Failed);
    // Log the error to the console
    logger.error('Relay transfer error:', error);
    if (JSON.stringify(error).includes('ChainMismatchError')) {
      toast.error('Wallet must be connected to origin chain');
    } else if (error instanceof Error) {
      toast.error(error.message || JSON.stringify(error));
    } else {
      toast.error(JSON.stringify(error));
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
  activeChains,
  transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  activeChains: ReturnType<typeof useActiveChains>;
  transactionFns: ReturnType<typeof useTransactionFns>;
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
    if (!originToken || !connection) throw new Error('No token route found between chains');

    const originProtocol = originToken.protocol;
    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const originTokenAmount = originToken.amount(weiAmountOrId);

    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const activeChain = activeChains.chains[originProtocol];
    const sender = getAccountAddressForChain(origin, activeAccounts.accounts);
    if (!sender) throw new Error('No active account found for origin chain');

    const warpCore = getWarpCore();

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
    });
    if (!isCollateralSufficient) {
      toast.error('Insufficient collateral on destination for transfer');
      throw new Error('Insufficient destination collateral');
    }

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: originToken.addressOrDenom,
      destTokenAddressOrDenom: connection.token.addressOrDenom,
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
    if (JSON.stringify(error).includes('ChainMismatchError')) {
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
};
