import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { TypedTransactionReceipt, WarpTxCategory } from '@hyperlane-xyz/sdk';
import { ProviderType } from '@hyperlane-xyz/sdk';
import { toTitleCase, toWei } from '@hyperlane-xyz/utils';
import { ProtocolType } from '@hyperlane-xyz/utils';

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
          activeChains,
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
  activeChains,
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
  activeChains: ReturnType<typeof useActiveChains>;
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
    const { getRelayQuote, getRelayChainId, getNativeCurrency } = await import('./relaySdk');

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
      throw new Error(`Swap combination not supported: ${origin} -> ${destination}`);
    }

    // Determine if this is a deposit or withdrawal
    const isDeposit = destination === 'forma' || destination === 'sketchpad';
    const isWithdrawal = origin === 'forma' || origin === 'sketchpad';

    // DEBUG: Log transfer type and chain information
    logger.info('=== RELAY TRANSFER DEBUG ===');
    logger.info('Transfer Type:', isDeposit ? 'DEPOSIT' : isWithdrawal ? 'WITHDRAWAL' : 'UNKNOWN');
    logger.info('Origin:', origin, 'Destination:', destination);
    logger.info('Origin Chain ID:', originChainId, 'Destination Chain ID:', destinationChainId);
    logger.info('Wallet object:', wallet);
    logger.info('Wallet type:', typeof wallet);
    logger.info('Wallet chainId:', wallet?.chainId);
    logger.info('Wallet address:', wallet?.address);
    logger.info('Wallet connected:', wallet?.connected);
    logger.info('Wallet methods:', {
      sendTransaction: typeof wallet?.sendTransaction,
      switchChain: typeof wallet?.switchChain,
      getAddresses: typeof wallet?.getAddresses,
      signMessage: typeof wallet?.signMessage,
    });
    logger.info('Sender:', sender);
    logger.info('Is Deposit:', isDeposit, 'Is Withdrawal:', isWithdrawal);

    // Get the correct token symbol for the origin chain
    const getTokenSymbol = (_chainName: string) => {
      // For deposits: use the selected token symbol or fallback to native token
      if (isDeposit) {
        return values.selectedToken?.symbol || 'OP'; // Default to OP for Optimism
      }
      // For withdrawals: always TIA from Forma
      return 'TIA';
    };

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: getTokenSymbol(origin),
      destTokenAddressOrDenom: getTokenSymbol(destination),
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
      originCurrency = values.selectedToken?.address || getNativeCurrency(origin);

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

      destinationCurrency = values.selectedToken?.address || getNativeCurrency(destination);

      // Only use zero address for actual native tokens (ETH), not ERC20 tokens
      if (
        values.selectedToken?.symbol === 'ETH' &&
        values.selectedToken?.address === '0x0000000000000000000000000000000000000000'
      ) {
        destinationCurrency = '0x0000000000000000000000000000000000000000';
      }
    } else {
      // Fallback to old logic
      originCurrency = getNativeCurrency(origin);
      destinationCurrency = getNativeCurrency(destination);
    }

    // Calculate amount in wei
    let amountWei;
    if (isDeposit) {
      // For deposits: user specifies how much Relay token to send
      const decimals = values.selectedToken?.decimals || 18;
      amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();
    } else if (isWithdrawal) {
      // For withdrawals: user specifies how much TIA to send
      const decimals = 18; // TIA has 18 decimals
      amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();
    } else {
      // Fallback
      const decimals = 18;
      amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();
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

    // Step 2: Get swap data from Relay and execute using existing transaction functions
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.SigningTransfer));

    // Get quote with transaction data (but don't execute)
    const { getClient } = await import('@reservoir0x/relay-sdk');
    const client = getClient();

    if (!client) {
      throw new Error('Relay client not initialized');
    }

    // Get quote which contains the transaction steps
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

    // Step 3: Execute transactions manually using existing transaction functions
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmingTransfer));

    const hashes: string[] = [];
    const steps = quote?.steps || [];

    if (!steps || steps.length === 0) {
      throw new Error('No transaction steps found in Relay response');
    }

    // Get transaction functions - use the same approach as working withdrawals
    const originProtocol = tryGetChainProtocol(origin) || ProtocolType.Ethereum;
    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const activeChain = activeChains.chains[originProtocol];

    // Execute each step manually
    for (const step of steps) {
      if (!step.items || !Array.isArray(step.items)) {
        continue;
      }

      for (const item of step.items) {
        if (item.status === 'incomplete' && item.data) {
          // Determine which chain this transaction should execute on
          const targetChainId = item.data.chainId;
          // Transaction should be executed on the chain that matches the transaction's chainId
          let targetChainName: string;
          if (targetChainId === originChainId) {
            targetChainName = origin;
          } else if (targetChainId === destinationChainId) {
            targetChainName = destination;
          } else {
            // Fallback: try to determine chain name from chainId
            targetChainName = origin;
          }

          // Create transaction object using the expected format
          const tx = {
            type: ProviderType.EthersV5 as const,
            transaction: {
              to: item.data.to,
              data: item.data.data,
              value: item.data.value,
              from: item.data.from,
              chainId: targetChainId,
              ...(item.data.gas && { gasLimit: item.data.gas }),
              ...(item.data.gasPrice && { gasPrice: item.data.gasPrice }),
              ...(item.data.maxFeePerGas && { maxFeePerGas: item.data.maxFeePerGas }),
              ...(item.data.maxPriorityFeePerGas && {
                maxPriorityFeePerGas: item.data.maxPriorityFeePerGas,
              }),
            },
            category: WarpTxCategory.Transfer,
          };

          // Use the same transaction execution approach that works for withdrawals
          const result = await sendTransaction({
            chainName: targetChainName,
            activeChainName: activeChain.chainName,
            tx,
          });

          const hash = typeof result === 'string' ? result : result?.hash;
          if (hash) hashes.push(hash);
        }
      }
    }

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer));
    setIsLoading(false);
    if (onDone) onDone();
    return;
  } catch (error) {
    updateTransferStatus(transferIndex, TransferStatus.Failed);
    // Log the error to the console
    logger.error('=== RELAY TRANSFER ERROR ===', error);
    logger.error('Error type:', typeof error);
    logger.error('Error message:', error instanceof Error ? error.message : 'No message');
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    logger.error('Full error object:', error);
    logger.error('Error JSON:', JSON.stringify(error));

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
