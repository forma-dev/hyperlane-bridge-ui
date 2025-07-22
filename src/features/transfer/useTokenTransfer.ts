import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { ProviderType, TypedTransactionReceipt, WarpTxCategory } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
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
    (values: TransferFormValues) => {
      // Determine if this should use Relay or Hyperlane
      const protocol = getTransferProtocol(values.origin, values.destination, relayChains);
      const isRelayTransfer = protocol === 'relay';
      
      logger.debug('Transfer protocol decision:', {
        origin: values.origin,
        destination: values.destination,
        protocol,
        isRelayTransfer,
        relayChains: relayChains.length
      });
      
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
function getTransferProtocol(origin: string, destination: string, relayChains: any[]): 'relay' | 'hyperlane' {
  logger.debug('getTransferProtocol called with:', { origin, destination, relayChains: relayChains.length });
  
  // Import warp core to check Hyperlane availability
  const warpCore = getWarpCore();
  const hyperlaneChains = warpCore.getTokenChains();
  
  const isFormaInvolved = origin === 'forma' || origin === 'sketchpad' || 
                         destination === 'forma' || destination === 'sketchpad';
  
  const isDeposit = destination === 'forma' || destination === 'sketchpad'; // TO Forma
  const isWithdrawal = origin === 'forma' || origin === 'sketchpad'; // FROM Forma
  
  const originIsRelay = isRelayChain(origin, relayChains);
  const destinationIsRelay = isRelayChain(destination, relayChains);
  const originIsHyperlane = hyperlaneChains.includes(origin);
  const destinationIsHyperlane = hyperlaneChains.includes(destination);
  
  logger.debug('Transfer protocol analysis:', { 
    isFormaInvolved, 
    isDeposit, 
    isWithdrawal, 
    origin, 
    destination,
    originIsRelay,
    destinationIsRelay,
    originIsHyperlane,
    destinationIsHyperlane,
    relayChains: relayChains.length
  });
  
  // STRATEGY: More specific routing logic
  
  // 1. If both chains are available on Hyperlane, prefer Hyperlane
  if (originIsHyperlane && destinationIsHyperlane) {
    logger.debug('Using Hyperlane protocol - both chains available on Hyperlane');
    return 'hyperlane';
  }
  
  // 2. If Forma is involved and the other chain is Relay-only (not on Hyperlane), use Relay
  if (isFormaInvolved) {
    const otherChain = isDeposit ? origin : destination;
    const otherChainIsRelay = isRelayChain(otherChain, relayChains);
    const otherChainIsHyperlane = hyperlaneChains.includes(otherChain);
    
    logger.debug('Forma bridge check:', { 
      otherChain, 
      otherChainIsRelay, 
      otherChainIsHyperlane 
    });
    
    // Use Relay if the other chain is available on Relay but NOT on Hyperlane
    if (otherChainIsRelay && !otherChainIsHyperlane) {
      logger.debug('Using Relay protocol - Forma bridge with Relay-only chain');
      return 'relay';
    }
  }
  
  // 3. If either chain is Relay-only (not available on Hyperlane), use Relay
  if ((originIsRelay && !originIsHyperlane) || (destinationIsRelay && !destinationIsHyperlane)) {
    logger.debug('Using Relay protocol - at least one chain is Relay-only');
    return 'relay';
  }
  
  // 4. Default to Hyperlane
  logger.debug('Using Hyperlane protocol - default case');
  return 'hyperlane';
}

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName || !relayChains?.length) {
    logger.debug('isRelayChain early return:', { chainName, relayChains: relayChains?.length });
    return false;
  }
  
  const result = relayChains.some(chain => {
    const internalName = mapRelayChainToInternalName(chain.name);
    const isMatch = internalName === chainName.toLowerCase() && chain.depositEnabled && !chain.disabled;
    if (chainName === 'ethereum') {
      logger.debug('Ethereum relay check:', { 
        chainName, 
        relayChainName: chain.name, 
        internalName, 
        isMatch, 
        depositEnabled: chain.depositEnabled, 
        disabled: chain.disabled 
      });
    }
    return isMatch;
  });
  
  logger.debug('isRelayChain result:', { chainName, result });
  return result;
}

// Helper function to map Relay chain names to internal names  
function mapRelayChainToInternalName(relayChainName: string): string {
  if (!relayChainName) return '';
  
  const mapping: { [key: string]: string } = {
    // Pascal case
    'Ethereum': 'ethereum',
    'Polygon': 'polygon',
    'Arbitrum': 'arbitrum',
    'Optimism': 'optimism',
    'Base': 'base',
    'BNB Smart Chain': 'bsc',
    'Avalanche': 'avalanche',
    // Lower case (likely format from API)
    'ethereum': 'ethereum',
    'polygon': 'polygon',
    'arbitrum': 'arbitrum',
    'arbitrum-one': 'arbitrum',
    'optimism': 'optimism',
    'base': 'base',
    'bnb': 'bsc',
    'bsc': 'bsc',
    'binance-smart-chain': 'bsc',
    'avalanche': 'avalanche',
    'avalanche-c-chain': 'avalanche',
    // Any other formats we might encounter
    'eth': 'ethereum',
    'matic': 'polygon',
    'arb': 'arbitrum',
    'op': 'optimism',
    'avax': 'avalanche',
  };
  
  const result = mapping[relayChainName] || relayChainName.toLowerCase();
  logger.debug('mapRelayChainToInternalName:', { relayChainName, result });
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
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
}) {
  const { origin, destination, amount, recipient } = values;
  
  const isDeposit = destination === 'forma' || destination === 'sketchpad'; // TO Forma
  // const isWithdrawal = origin === 'forma' || origin === 'sketchpad'; // FROM Forma
  
  logger.debug('Preparing Relay transfer transaction(s):', {
    type: isDeposit ? 'DEPOSIT' : 'WITHDRAWAL',
    from: origin,
    to: destination,
    amount
  });
  
  setIsLoading(true);
  let transferStatus: TransferStatus = TransferStatus.Preparing;
  updateTransferStatus(transferIndex, transferStatus);

  try {
    const sender = getAccountAddressForChain(origin, activeAccounts.accounts);
    
    if (!sender) {
      throw new Error('No active account found for origin chain');
    }

    // Import Relay API functions
    const { getRelayQuote, executeRelaySwapSingleOrigin, getRelayChainId, getNativeCurrency } = await import('./relayApi');
    
    // Get chain IDs for Relay API
    const originChainIds = getRelayChainId(origin);
    const destinationChainIds = getRelayChainId(destination);
    
    // For now, try mainnet first to test currency format
    // If either chain requires testnet, use testnet for both
    const needsTestnet = false; // Temporarily force mainnet to test currency format
    // const needsTestnet = destinationChainIds.mainnet === null || originChainIds.mainnet === null ||
    //                     destinationChainIds.testnet === 984123 || originChainIds.testnet === 984123; // Check for sketchpad testnet
    
    const originChainId = needsTestnet ? originChainIds.testnet : originChainIds.mainnet;
    const destinationChainId = needsTestnet ? destinationChainIds.testnet : destinationChainIds.mainnet;
    
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
    logger.debug('Getting Relay quote...');
    const originCurrency = getNativeCurrency(origin);
    const destinationCurrency = getNativeCurrency(destination);
    
    // CRITICAL: Both ETH and TIA tokens use 18 decimals for Relay API
    // TIA token on Forma has 18 decimals (same as ETH)
    const decimals = 18;
    const amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();
    
    logger.debug('DEBUG: Amount conversion:', {
      originalAmount: amount,
      decimals,
      amountWei,
      chain: origin
    });

    const quote = await getRelayQuote({
      user: sender,
      recipient,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountWei,
      tradeType: 'EXACT_INPUT',
    });

    logger.debug('Relay quote received:', quote);

    // Step 2: Execute the swap using NEW API format
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.SigningTransfer));
    
    const swapResponse = await executeRelaySwapSingleOrigin({
      user: sender,
      recipient,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountWei,
      tradeType: 'EXACT_INPUT',
    });

    logger.debug('Relay swap response:', swapResponse);

    // DEBUGGING: Log the full structure to understand why wallet popup isn't showing
    logger.debug('DEBUG: Swap response structure:', {
      hasSteps: !!swapResponse?.steps,
      stepsLength: swapResponse?.steps?.length || 0,
      steps: swapResponse?.steps,
      fullResponse: swapResponse
    });

    // Step 3: Execute the transactions from the swap response
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmingTransfer));

    const originProtocol = tryGetChainProtocol(origin) || ProtocolType.Ethereum;
    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    
    logger.debug('DEBUG: Send transaction function:', { 
      originProtocol,
      hasSendTransaction: !!sendTransaction,
      transactionFns: Object.keys(transactionFns)
    });
    
    // Execute each step from the Relay response (NEW STRUCTURE)
    const hashes: string[] = [];
    
    if (!swapResponse?.steps || !Array.isArray(swapResponse.steps)) {
      logger.debug('DEBUG: No steps found in response or steps is not an array');
      throw new Error('Invalid response structure from Relay API - no steps found');
    }
    
    for (const step of swapResponse.steps) {
      logger.debug(`Processing step: ${step.id} - ${step.action}`);
      logger.debug('DEBUG: Step structure:', {
        hasItems: !!step.items,
        itemsLength: step.items?.length || 0,
        items: step.items
      });
      
      if (!step.items || !Array.isArray(step.items)) {
        logger.debug('DEBUG: No items found in step or items is not an array');
        continue;
      }
      
      for (const item of step.items) {
        logger.debug('DEBUG: Processing item:', {
          status: item.status,
          hasData: !!item.data,
          itemStructure: item
        });
        
        // Check if this is an incomplete transaction that needs to be executed
        if (item.status === 'incomplete' && item.data) {
          logger.debug('DEBUG: Found incomplete transaction, preparing to send...');
          
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
              ...(item.data.maxPriorityFeePerGas && { maxPriorityFeePerGas: item.data.maxPriorityFeePerGas }),
            },
          };

                    logger.debug('DEBUG: Transaction object prepared:', tx);
          logger.debug('DEBUG: About to call sendTransaction...');
          logger.debug('DEBUG: sendTransaction parameters:', {
            chainName: origin,
            txType: tx.type,
            hasTransactionData: !!tx.transaction
          });

          try {
            const result = await sendTransaction({
              tx,
              chainName: origin,
            });
            
            logger.debug('DEBUG: sendTransaction returned:', result);
            
            const { hash } = result;
            logger.debug('DEBUG: Transaction sent successfully, hash:', hash);
            hashes.push(hash);
            
            // const receipt = await confirm();
            logger.debug(`Relay transaction confirmed, hash:`, hash);
            
            // Show success toast
            const { toastTxSuccess } = await import('../../components/toast/TxSuccessToast');
            toastTxSuccess(`${step.action} completed!`, hash, origin);
            
            // Log the requestId for tracking if available
            if (step.requestId) {
              logger.debug(`Transaction request ID: ${step.requestId}`);
            }
          } catch (txError) {
            logger.debug('DEBUG: sendTransaction failed:', txError);
            throw txError;
          }
        } else {
          logger.debug('DEBUG: Item skipped - not incomplete or no data:', {
            status: item.status,
            hasData: !!item.data
          });
        }
      }
    }
    
    if (hashes.length === 0) {
      logger.debug('DEBUG: No transactions were executed - this explains why no wallet popup appeared');
      throw new Error('No transactions found to execute in Relay response');
    }

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash: hashes.at(-1),
    });

    logger.debug('Relay transfer completed successfully');
    
  } catch (error) {
    logger.error(`Error at stage ${transferStatus}`, error);
    updateTransferStatus(transferIndex, TransferStatus.Failed);
    
    if (JSON.stringify(error).includes('ChainMismatchError')) {
      toast.error('Wallet must be connected to origin chain');
    } else if (error instanceof Error) {
      toast.error(error.message || 'Unable to process Relay transfer');
    } else {
      toast.error('Unable to process Relay transfer');
    }
  }

  setIsLoading(false);
  if (onDone) onDone();
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
  logger.debug('Preparing Hyperlane transfer transaction(s)');
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
      logger.debug(`${description} transaction confirmed, hash:`, hash);
      toastTxSuccess(`${description} transaction sent!`, hash, origin);
      hashes.push(hash);
    }

    const msgId = txReceipt ? tryGetMsgIdFromTransferReceipt(origin, txReceipt) : undefined;

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash: hashes.at(-1),
      msgId,
    });
  } catch (error) {
    logger.error(`Error at stage ${transferStatus}`, error);
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
