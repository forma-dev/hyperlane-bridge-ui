import { DeliverTxResponse, ExecuteResult, IndexedTx } from '@cosmjs/cosmwasm-stargate';
import { useChain, useChains } from '@cosmos-kit/react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProviderType, TypedTransactionReceipt, WarpTypedTransaction } from '@hyperlane-xyz/sdk';
import { HexString, ProtocolType, assert } from '@hyperlane-xyz/utils';

import { PLACEHOLDER_COSMOS_CHAIN } from '../../../consts/values';
import { logger } from '../../../utils/logger';
import { getCosmosChainNames } from '../../chains/metadata';
import { getChainMetadata } from '../../chains/utils';

import { AccountInfo, ActiveChainInfo, ChainAddress, ChainTransactionFns } from './types';

export function useCosmosAccount(): AccountInfo {
  const chainToContext = useChains(getCosmosChainNames());
  return useMemo<AccountInfo>(() => {
    const addresses: Array<ChainAddress> = [];
    let publicKey: Promise<HexString> | undefined = undefined;
    let connectorName: string | undefined = undefined;
    let isReady = false;
    for (const [chainName, context] of Object.entries(chainToContext)) {
      if (!context.address) continue;
      addresses.push({ address: context.address, chainName });
      publicKey = context.getAccount().then((acc) => Buffer.from(acc.pubkey).toString('hex'));
      isReady = true;
      connectorName ||= context.wallet?.prettyName;
    }
    return {
      protocol: ProtocolType.Cosmos,
      addresses,
      publicKey,
      connectorName,
      isReady,
    };
  }, [chainToContext]);
}

export function useCosmosConnectFn(): () => void {
  const { openView } = useChain(PLACEHOLDER_COSMOS_CHAIN);
  return openView;
}

export function useCosmosDisconnectFn(): () => Promise<void> {
  const { disconnect, address } = useChain(PLACEHOLDER_COSMOS_CHAIN);
  const safeDisconnect = async () => {
    if (address) await disconnect();
  };
  return safeDisconnect;
}

export function useCosmosActiveChain(): ActiveChainInfo {
  return useMemo(() => ({} as ActiveChainInfo), []);
}

export function useCosmosTransactionFns(): ChainTransactionFns {
  const chainToContext = useChains(getCosmosChainNames());

  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    const displayName = getChainMetadata(chainName).displayName || chainName;
    toast.warn(`Cosmos wallet must be connected to origin chain ${displayName}}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      const chainContext = chainToContext[chainName];
      if (!chainContext?.address) throw new Error(`Cosmos wallet not connected for ${chainName}`);

      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);

      logger.debug(`Sending tx on chain ${chainName}`);
      logger.debug(`Using RPC URL for ${chainName}:`, chainContext.getRpcEndpoint());
      logger.debug('Transaction details:', JSON.stringify(tx, null, 2));

      const { getSigningCosmWasmClient, getSigningStargateClient } = chainContext;
      let result: ExecuteResult | DeliverTxResponse;
      let txDetails: IndexedTx | null = null;

      try {
        if (tx.type === ProviderType.CosmJsWasm) {
          const client = await getSigningCosmWasmClient();
          // We can't directly access the RPC URL, so we'll log what we can
          logger.debug('Using CosmWasm client for transaction');
          result = await client.executeMultiple(chainContext.address, [tx.transaction], 'auto');
        } else if (tx.type === ProviderType.CosmJs) {
          const client = await getSigningStargateClient();
          // We can't directly access the RPC URL, so we'll log what we can
          logger.debug('Using Stargate client for transaction');
          result = await client.signAndBroadcast(chainContext.address, [tx.transaction], 'auto');
        } else {
          throw new Error(`Invalid cosmos provider type ${tx.type}`);
        }
        
        logger.debug('Transaction result:', JSON.stringify(result, null, 2));
        
        // Attempt to get transaction details
        try {
          if (tx.type === ProviderType.CosmJsWasm) {
            const client = await getSigningCosmWasmClient();
            txDetails = await client.getTx(result.transactionHash);
          } else if (tx.type === ProviderType.CosmJs) {
            const client = await getSigningStargateClient();
            txDetails = await client.getTx(result.transactionHash);
          }
        } catch (detailsError) {
          logger.warn('Failed to retrieve transaction details:', detailsError);
          // We'll proceed without txDetails
        }
      } catch (error: unknown) {
        logger.error('Transaction failed:', error);
        if (error instanceof Error && error.message.includes('transaction indexing is disabled')) {
          logger.warn('Transaction indexing is disabled on the RPC node. Unable to retrieve transaction details.');
        }
        throw error;
      }

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        assert(txDetails, `Cosmos tx failed: ${JSON.stringify(result)}`);
        return {
          type: tx.type,
          receipt: { ...txDetails, transactionHash: result.transactionHash },
        };
      };
      return { hash: result.transactionHash, confirm };
    },
    [onSwitchNetwork, chainToContext],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
