import { DeliverTxResponse, ExecuteResult, IndexedTx } from '@cosmjs/cosmwasm-stargate';
import { useChain, useChains } from '@cosmos-kit/react';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { ProviderType, TypedTransactionReceipt, WarpTypedTransaction } from '@hyperlane-xyz/sdk';
import { HexString, ProtocolType, assert } from '@hyperlane-xyz/utils';

import { PLACEHOLDER_COSMOS_CHAIN } from '../../../consts/values';
import { getCosmosChainNames } from '../../chains/metadata';
import { getChainMetadata } from '../../chains/utils';

import { GasPrice } from '@cosmjs/stargate';
import { SigningHyperlaneModuleClient } from '@hyperlane-xyz/cosmos-sdk';
import { AccountInfo, ActiveChainInfo, ChainAddress, ChainTransactionFns } from './types';

// Helper function to convert Long objects to strings for amino encoding
function convertLongToString(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  // Check if this is a Long object (has low, high, unsigned properties)
  if (typeof obj === 'object' && 'low' in obj && 'high' in obj && 'unsigned' in obj) {
    // Convert Long object to string
    const long = obj.unsigned
      ? (BigInt(obj.high >>> 0) << 32n) | BigInt(obj.low >>> 0)
      : (BigInt(obj.high | 0) << 32n) | BigInt(obj.low >>> 0);
    return long.toString();
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map(convertLongToString);
  }

  // Recursively process objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertLongToString(value);
    }
    return result;
  }

  return obj;
}

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
      if (!chainContext?.address) throw new Error('Please connect your Cosmos wallet to continue');

      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);

      // Convert Long objects to strings for amino encoding compatibility
      const processedTransaction = convertLongToString(tx.transaction);
      const { getSigningCosmWasmClient, getSigningStargateClient, getOfflineSigner, chain } = chainContext;
      let result: ExecuteResult | DeliverTxResponse;
      let txDetails: IndexedTx | null;
      if (tx.type === ProviderType.CosmJsWasm) {
        const client = await getSigningCosmWasmClient();
        result = await client.executeMultiple(chainContext.address, [processedTransaction], 'auto');
        txDetails = await client.getTx(result.transactionHash);
      } else if (tx.type === ProviderType.CosmJs) {
        const client = await getSigningStargateClient();
        result = await client.signAndBroadcast(
          chainContext.address,
          [processedTransaction],
          'auto',
        );
        txDetails = await client.getTx(result.transactionHash);
      } else if (tx.type === ProviderType.CosmJsNative) {
        const signer = getOfflineSigner();
        const client = await SigningHyperlaneModuleClient.connectWithSigner(
          chain.apis!.rpc![0].address,
          signer,
          {
            // set zero gas price here so it does not error. actual gas price
            // will be injected from the wallet registry like Keplr or Leap
            gasPrice: GasPrice.fromString('0token'),
          },
        );

        result = await client.signAndBroadcast(
          chainContext.address,
          [tx.transaction],
          2,
        );
        txDetails = await client.getTx(result.transactionHash);
      } else {
        throw new Error(`Invalid cosmos provider type ${tx.type}`);
      }

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        assert(txDetails, `Cosmos tx failed: Transaction hash ${result.transactionHash}`);
        return {
          type: tx.type,
          receipt: {
            ...(txDetails as any),
            transactionHash: String(result.transactionHash),
          },
        };
      };
      return { hash: result.transactionHash, confirm };
    },
    [onSwitchNetwork, chainToContext],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
