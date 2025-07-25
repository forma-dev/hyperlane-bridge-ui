import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getAccount, waitForTransactionReceipt } from '@wagmi/core';
import { useCallback, useMemo } from 'react';
import { TransactionReceipt as ViemTransactionReceipt, withTimeout } from 'viem';
import { useAccount, useConfig, useDisconnect, useSendTransaction, useSwitchChain } from 'wagmi';

import { ProviderType, TypedTransactionReceipt, WarpTypedTransaction } from '@hyperlane-xyz/sdk';
import { ProtocolType, assert, sleep } from '@hyperlane-xyz/utils';

import { logger } from '../../../utils/logger';
import { getChainMetadata, tryGetChainMetadata } from '../../chains/utils';
import { ethers5TxToWagmiTx } from '../utils';

import { AccountInfo, ActiveChainInfo, ChainTransactionFns } from './types';

//type that works with both Viem and Hyperlane SDK TransactionReceipt types
type CompatibleTransactionReceipt = Omit<ViemTransactionReceipt, 'contractAddress'> & {
  contractAddress: `0x${string}` | null;
};

export function useEvmAccount(): AccountInfo {
  const { ready } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { address: wagmiAddress, connector, chain } = useAccount();
  const isReady = ready && walletsReady && wallets.length > 0;
  const activeWallet = wallets.find((wallet) => wallet.address === wagmiAddress);

  // Map wagmi chain names to internal chain names
  const getInternalChainName = (chainId?: number): string => {
    if (!chainId) return 'ethereum';

    const chainMapping: Record<number, string> = {
      1: 'ethereum',
      42161: 'arbitrum',
      10: 'optimism',
      984122: 'forma', // Forma chain ID
      // Add more chain mappings as needed
    };

    return chainMapping[chainId] || 'ethereum';
  };

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Ethereum,
      addresses: activeWallet
        ? [{ address: activeWallet.address, chainName: getInternalChainName(chain?.id) }]
        : [],
      connectorName: connector?.name || 'Privy',
      isReady,
    }),
    [activeWallet, isReady, connector, chain],
  );
}

export function useEvmConnectFn(): () => Promise<void> {
  const { connectOrCreateWallet, logout, authenticated } = usePrivy();

  return useCallback(async () => {
    try {
      if (authenticated) {
        await logout();
      }
      connectOrCreateWallet();
    } catch (error) {
      logger.error('Failed to login with Privy:', error);
      throw error;
    }
  }, [connectOrCreateWallet, logout, authenticated]);
}

export function useEvmDisconnectFn(): () => Promise<void> {
  const { logout } = usePrivy();
  const { disconnect } = useDisconnect();
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();
  const activeWallet = wallets.find((wallet) => wallet.address === wagmiAddress);

  return useCallback(async () => {
    try {
      if (activeWallet?.connectorType === 'embedded') {
        await logout();
      } else {
        disconnect();
        for (const wallet of wallets) {
          wallet.disconnect();
        }
        if (typeof window.ethereum !== 'undefined') {
          try {
            await withTimeout(
              () =>
                window.ethereum.request({
                  method: 'wallet_revokePermissions',
                  params: [{ eth_accounts: {} }],
                }),
              { timeout: 100 },
            );
          } catch {} // eslint-disable-line no-empty
        }
      }
    } catch (error) {
      logger.error('Failed to logout with Privy:', error);
    }
  }, [activeWallet, wallets, disconnect, logout]);
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

  const onSwitchNetwork = useCallback(
    async (chainName: ChainName) => {
      const chainId = getChainMetadata(chainName).chainId as number;

      try {
        await switchChainAsync({ chainId });
        // Some wallets seem to require a brief pause after switch
        await sleep(2000);
      } catch (error) {
        throw error;
      }
    },
    [switchChainAsync],
  );

  // Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
  // The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
  // may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
  // See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
  // See https://github.com/wagmi-dev/wagmi/discussions/1564
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
      if (tx.type !== ProviderType.EthersV5) throw new Error(`Unsupported tx type: ${tx.type}`);

      // If the active chain is different from tx origin chain, try to switch network first
      if (activeChainName !== chainName) {
        await onSwitchNetwork(chainName);
      }

      // Since the network switching is not foolproof, we also force a network check here
      const expectedChainId = getChainMetadata(chainName).chainId as number;
      const { chainId: connectedChainId } = getAccount(config);

      assert(
        connectedChainId === expectedChainId,
        `Wallet not on chain ${chainName} (ChainMismatchError)`,
      );

      const wagmiTx = ethers5TxToWagmiTx(tx.transaction);

      let hash: `0x${string}`;
      try {
        // Add timeout to prevent hanging
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout after 30 seconds')), 30000),
        );

        const txPromise = sendTransactionAsync(wagmiTx);
        hash = (await Promise.race([txPromise, timeout])) as `0x${string}`;
      } catch (error) {
        // Check if it's a user rejection
        if (error instanceof Error && error.message.includes('rejected')) {
          throw error;
        }
        // Check if it's a timeout
        if (error instanceof Error && error.message.includes('timeout')) {
          throw new Error(
            'Transaction request timed out. Please ensure your wallet is connected and responsive.',
          );
        }
        throw error;
      }

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        const receipt = await waitForTransactionReceipt(config, { hash });
        return {
          type: ProviderType.Viem,
          receipt: receipt as CompatibleTransactionReceipt,
        };
      };
      return { hash, confirm };
    },
    [onSwitchNetwork, sendTransactionAsync, config],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
