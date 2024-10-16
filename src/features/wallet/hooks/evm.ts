import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { TransactionReceipt as ViemTransactionReceipt, parseEther } from 'viem';
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from 'wagmi';
import { getPublicClient, waitForTransactionReceipt } from 'wagmi/actions';

import { ProviderType, TypedTransactionReceipt, WarpTypedTransaction } from '@hyperlane-xyz/sdk';
import { ProtocolType, assert, sleep } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getChainMetadata, tryGetChainMetadata } from '../../chains/utils';

import { AccountInfo, ActiveChainInfo, ChainTransactionFns } from './types';

//type that works with both Viem and Hyperlane SDK TransactionReceipt types
type CompatibleTransactionReceipt = Omit<ViemTransactionReceipt, 'contractAddress'> & {
  contractAddress: `0x${string}` | null;
};

export function useEvmAccount(): AccountInfo {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  
  const isReady = authenticated && wallets.length > 0;
  
  return useMemo<AccountInfo>(() => ({
    protocol: ProtocolType.Ethereum,
    addresses: wallets.map(wallet => ({ address: wallet.address })),
    connectorName: 'Privy',
    isReady,
  }), [wallets, authenticated]);
}

export function useEvmConnectFn(): () => Promise<void> {
  const { login, createWallet } = usePrivy();
  const { wallets } = useWallets();
  
  return useCallback(async () => {
    try {
      await login();
      // Check if the user has an embedded wallet, if not, create one
      if (!wallets.some(wallet => wallet.walletClientType === 'privy')) {
        await createWallet();
      }
    } catch (error) {
      console.error('Failed to login or create wallet with Privy:', error);
    }
  }, [login, createWallet, wallets]);
}

export function useEvmDisconnectFn(): () => Promise<void> {
  const { logout } = usePrivy();

  return useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout with Privy:', error);
    }
  }, [logout]);
}

export function useEvmActiveChain(): ActiveChainInfo {
  const { chain } = useAccount();
  return useMemo<ActiveChainInfo>(
    () => ({
      chainDisplayName: chain?.name,
      chainName: chain ? tryGetChainMetadata(chain.id)?.name : undefined,
    }),
    [chain],
  );
}

export function useEvmTransactionFns(): ChainTransactionFns {
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const config = useConfig();

  const onSwitchNetwork = useCallback(async (chainName: string) => {
    const chainId = getChainMetadata(chainName).chainId as number;
    await switchChainAsync({ chainId });
    // Some wallets seem to require a brief pause after switch
    await sleep(2000);
  }, [switchChainAsync]);

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: string;
      activeChainName?: string;
    }) => {
      if (tx.type !== ProviderType.EthersV5) throw new Error(`Unsupported tx type: ${tx.type}`);

      //if active chain is different from tx origin chain, try to switch network
      if (activeChainName && activeChainName !== chainName) await onSwitchNetwork(chainName);

      //force a network check here
      const chainId = getChainMetadata(chainName).chainId as number;
      logger.debug('Checking wallet current chain');
      const publicClient = getPublicClient(config);
      if (!publicClient) {
        throw new Error('Failed to get public client');
      }
      const latestChainId = await publicClient.getChainId();
      assert(
        latestChainId === chainId,
        `Wallet not on chain ${chainName} (ChainMismatchError)`,
      );

      logger.debug(`Sending tx on chain ${chainName}`);
      const viemTx = {
        to: tx.transaction.to as `0x${string}`,
        value: tx.transaction.value ? parseEther(tx.transaction.value.toString()) : undefined,
        data: tx.transaction.data as `0x${string}`,
        nonce: tx.transaction.nonce !== undefined ? Number(tx.transaction.nonce) : undefined,
        gas: tx.transaction.gasLimit ? BigInt(tx.transaction.gasLimit.toString()) : undefined,
        gasPrice: tx.transaction.gasPrice ? BigInt(tx.transaction.gasPrice.toString()) : undefined,
        maxFeePerGas: tx.transaction.maxFeePerGas ? BigInt(tx.transaction.maxFeePerGas.toString()) : undefined,
        maxPriorityFeePerGas: tx.transaction.maxPriorityFeePerGas
          ? BigInt(tx.transaction.maxPriorityFeePerGas.toString())
          : undefined,
      };

      const hash = await sendTransactionAsync({
        chainId,
        ...viemTx,
      });

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        const receipt = await waitForTransactionReceipt(config, { hash });
        const compatibleReceipt: CompatibleTransactionReceipt = {
          ...receipt,
          contractAddress: receipt.contractAddress ?? null,
        };
        return {
          type: ProviderType.Viem,
          receipt: compatibleReceipt,
        };
      };
      return { hash, confirm };
    },
    [onSwitchNetwork, sendTransactionAsync, config],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}

