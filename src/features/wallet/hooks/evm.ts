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
  const { address: wagmiAddress, connector } = useAccount();
  const isReady = ready && walletsReady && wallets.length > 0;
  const activeWallet = wallets.find((wallet) => wallet.address === wagmiAddress);

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Ethereum,
      addresses: activeWallet ? [{ address: activeWallet.address }] : [],
      connectorName: connector?.name || 'Privy',
      isReady,
    }),
    [activeWallet, isReady, connector],
  );
}

export function useEvmConnectFn(): () => Promise<void> {
  const { connectOrCreateWallet, logout, authenticated, ready, user, createWallet } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();

  return useCallback(async () => {
    try {
      // If authenticated but wallet not properly connected
      if (authenticated && !wagmiAddress) {
        await logout();
      }

      // Start the connection process
      await connectOrCreateWallet();

      // Wait for Privy authentication to complete
      let attempts = 0;
      const maxAttempts = 30;
      while ((!ready || !user?.id) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      // If authentication succeeded but no wallet yet, create one
      if (user?.id && !wagmiAddress) {
        try {
          await createWallet();
        } catch (e) {
          logger.warn('Failed to create embedded wallet:', e);
        }
      }

      // Wait for wallet to be ready
      attempts = 0;
      while ((!wagmiAddress || wallets.length === 0) && attempts < maxAttempts) {
        const embeddedWallet = wallets.find(w => w.connectorType === 'embedded');
        if (embeddedWallet && !embeddedWallet.isConnected) {
          try {
            // @ts-ignore - Privy's type definitions are incomplete
            await embeddedWallet.connect();
            if (embeddedWallet.isConnected) break;
          } catch (e) {
            logger.warn('Failed to connect embedded wallet:', e);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      // Final check
      if (!wagmiAddress) {
        logger.warn('Wallet connection process incomplete');
        return; // Don't throw error as the process might still be ongoing
      }

    } catch (error: any) {
      const errorMsg = error?.message || '';
      if (!errorMsg.includes('User rejected') && 
          !errorMsg.includes('user closed modal') &&
          !errorMsg.includes('verification')) {
        throw error;
      }
    }
  }, [connectOrCreateWallet, createWallet, logout, authenticated, wagmiAddress, ready, user?.id, wallets]);
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
      console.error('Failed to logout with Privy:', error);
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

  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    const chainId = getChainMetadata(chainName).chainId as number;
    await switchChainAsync({ chainId });
    // Some wallets seem to require a brief pause after switch
    await sleep(2000);
  }, []);

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
      assert(connectedChainId === expectedChainId, `Wallet not on chain ${chainName} (ChainMismatchError)`);

      logger.debug(`Sending tx on chain ${chainName}`);
      const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
      const hash = await sendTransactionAsync(wagmiTx);

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        const receipt = await waitForTransactionReceipt(config, { hash });
        return {
          type: ProviderType.Viem,
          receipt: receipt as CompatibleTransactionReceipt,
        };
      };
      return { hash, confirm };
    },
    [onSwitchNetwork, sendTransactionAsync],
  );

  return { sendTransaction: onSendTx, switchNetwork: onSwitchNetwork };
}
