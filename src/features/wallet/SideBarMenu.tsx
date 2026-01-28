import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { Identicon } from '../../components/icons/Identicon';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon-red.svg';
import Logout from '../../images/icons/logout.svg';
import ResetIcon from '../../images/icons/reset-icon.svg';
import Wallet from '../../images/icons/wallet.svg';
import { tryClipboardSet } from '../../utils/clipboard';
import { STATUSES_WITH_ICON, getIconByTransferStatus } from '../../utils/transfer';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext } from '../transfer/types';

import { useRelaySupportedChains } from './context/RelayContext';
import { useAccounts, useDisconnectFns } from './hooks/multiProtocol';
import { AccountInfo, ChainAddress } from './hooks/types';

// Helper function to get consistent token display info (same as in modal)
function getTokenDisplayInfo(transfer: TransferContext, _relayChains: any[]) {
  const { origin, selectedToken } = transfer;

  // For withdrawals (Forma -> other chains), always show TIA
  const isWithdrawal = origin === 'forma';
  if (isWithdrawal) {
    return {
      symbol: 'TIA',
      logoURI: '/logos/celestia.png',
    };
  }

  // For deposits (other chains -> Forma), use selectedToken if available
  if (selectedToken && selectedToken.symbol) {
    return {
      symbol: selectedToken.symbol,
      logoURI: selectedToken.logoURI,
    };
  }

  // Fallback to TIA for Forma chains
  if (origin === 'forma') {
    return {
      symbol: 'TIA',
      logoURI: '/logos/celestia.png',
    };
  }

  return {
    symbol: 'TIA', // Default fallback
    logoURI: '/logos/celestia.png',
  };
}

export function SideBarMenu({
  onConnectWallet,
  isOpen,
  onClose,
}: {
  onConnectWallet: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferContext | null>(null);
  const disconnects = useDisconnectFns();
  const { readyAccounts } = useAccounts();
  const didMountRef = useRef(false);

  const { transfers, resetTransfers, transferLoading } = useStore((s) => ({
    transfers: s.transfers,
    resetTransfers: s.resetTransfers,
    transferLoading: s.transferLoading,
  }));

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
    } else if (transferLoading) {
      setSelectedTransfer(transfers[transfers.length - 1]);
      setIsModalOpen(true);
    }
  }, [transfers, transferLoading]);

  const onClickDisconnect = async () => {
    for (const disconnectFn of Object.values(disconnects)) {
      await disconnectFn();
    }
  };

  const sortedTransfers = useMemo(
    () => [...transfers].sort((a, b) => b.timestamp - a.timestamp) || [],
    [transfers],
  );

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-30" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-y-0 right-0 flex max-w-full">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-in-out duration-300"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="pointer-events-auto relative w-88">
                <button
                  className="absolute flex items-center justify-center w-9 h-full -translate-x-full left-0 top-0 bg-white border border-solid border-border transition-all hover:bg-bg-button-main-disabled"
                  onClick={onClose}
                >
                  <Image
                    src={CollapseIcon}
                    width={24}
                    height={24}
                    alt=""
                    style={{
                      filter:
                        'brightness(0) saturate(100%) invert(48%) sepia(85%) saturate(1638%) hue-rotate(3deg) brightness(101%) contrast(101%)',
                    }}
                  />
                </button>
                <div className="bg-white w-full h-full flex flex-col overflow-y-auto">
                  <div className="w-full border-t border-b border-solid border-border bg-white py-2 px-3.5 text-black text-lg font-bold leading-6  tracking-wider">
                    CONNECTED WALLETS
                  </div>
                  <div className="my-3 px-3 space-y-3">
                    {readyAccounts.map((acc, i) =>
                      acc.addresses.map((addr, j) => {
                        //if (addr?.chainName?.includes(PLACEHOLDER_COSMOS_CHAIN)) return null;
                        return (
                          <AccountSummary key={`${i}-${j}`} account={acc} chainAddress={addr} />
                        );
                      }),
                    )}
                    <button onClick={onConnectWallet} className={styles.btn}>
                      <Icon src={Wallet} alt="" size={24} />
                      <div className="ml-2 text-black">Connect wallet</div>
                    </button>
                    <button onClick={onClickDisconnect} className={styles.btn}>
                      <Icon src={Logout} alt="" size={24} />
                      <div className="ml-2 text-black">Disconnect all wallets</div>
                    </button>
                  </div>
                  <div className="w-full border-t border-b border-solid border-border bg-white py-2 px-3.5 mb-4 text-black text-lg font-bold leading-6 tracking-wider">
                    TRANSFER HISTORY
                  </div>
                  <div className="flex grow flex-col px-3.5">
                    <div className="grow flex flex-col w-full">
                      {sortedTransfers?.length > 0 &&
                        sortedTransfers.map((t, i) => (
                          <TransferSummary
                            key={i}
                            transfer={t}
                            onClick={() => {
                              setSelectedTransfer(t);
                              setIsModalOpen(true);
                            }}
                          />
                        ))}
                    </div>
                    {sortedTransfers?.length > 0 && (
                      <button
                        onClick={resetTransfers}
                        className="flex flex-row items-center px-2.5 py-2 my-5 hover:bg-bg-button-main-disabled transition-all duration-500"
                      >
                        <Image className="mr-4" src={ResetIcon} width={17} height={17} alt="" />
                        <span className="text-black text-sm font-normal">
                          Reset transaction history
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
      {selectedTransfer && (
        <TransfersDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransfer(null);
          }}
          transfer={selectedTransfer}
        />
      )}
    </>
  );
}

function AccountSummary({
  account: _account,
  chainAddress,
}: {
  account: AccountInfo;
  chainAddress: ChainAddress;
}) {
  const onClickCopy = async () => {
    if (!chainAddress.address) return;
    await tryClipboardSet(chainAddress.address);
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

  return (
    <button
      key={chainAddress.address}
      onClick={onClickCopy}
      className={`${styles.btn} bg-white border-[0.5px] border-border border-solid`}
    >
      <div className="shrink-0">
        <Identicon address={chainAddress.address} size={40} />
      </div>
      <div className="flex flex-col mx-3 items-start">
        {/* Show full chain name if available */}
        {chainAddress.chainName && (
          <div className="text-gray-600 text-xs font-medium">
            {getChainDisplayName(chainAddress.chainName, false)}
          </div>
        )}
        <div className="text-black font-medium leading-6 text-sm truncate w-64">
          {chainAddress.address ? chainAddress.address : 'Unknown'}
        </div>
      </div>
    </button>
  );
}

function TransferSummary({
  transfer,
  onClick,
}: {
  transfer: TransferContext;
  onClick: () => void;
}) {
  const { amount, origin, destination, status, timestamp } = transfer;

  const { relayChains } = useRelaySupportedChains();
  const tokenDisplayInfo = getTokenDisplayInfo(transfer, relayChains);

  return (
    <button
      key={timestamp}
      onClick={onClick}
      className="flex justify-between items-center border-[0.5px] border-border px-2.5 py-2 mb-3 hover:bg-bg-button-main-disabled transition-all duration-500"
    >
      <div className="flex items-center">
        <div className="mr-2.5 flex flex-col items-center justify-center h-[2.25rem] w-[2.25rem] p-1.5">
          <ChainLogo chainName={origin} size={32} />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col">
            <div className="flex items items-baseline">
              <span className="text-black text-sm font-medium leading-6">
                {amount?.toString().replace(/\s*(utia|TIA)\s*$/, '') || amount}
              </span>
              <span className="text-black text-sm font-medium leading-6 ml-1">
                {tokenDisplayInfo.symbol}
              </span>
            </div>
            <div className="mt-1 flex flex-row items-center">
              <span className="text-black text-sm font-medium leading-6 tracking-wide">
                {getChainDisplayName(origin, false)}
              </span>
              <Image className="mx-1" src={ArrowRightIcon} width={10} height={10} alt="" />
              <span className="text-black text-sm font-medium leading-6 tracking-wide">
                {getChainDisplayName(destination, false)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-6 h-6">
        {STATUSES_WITH_ICON.includes(status) ? (
          <Image src={getIconByTransferStatus(status)} width={28} height={26} alt="" />
        ) : (
          <SmallSpinner className="-ml-1 mr-3" />
        )}
      </div>
    </button>
  );
}

function Icon({
  src,
  alt,
  size,
  className,
}: {
  src: any;
  alt?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center w-[20px] ${className}`}>
      <Image src={src} alt={alt || ''} width={size ?? 16} height={size ?? 16} />
    </div>
  );
}

const styles = {
  btn: 'w-full flex items-center px-2.5 py-2 text-sm hover:bg-bg-button-main-disabled transition-all duration-500',
};
