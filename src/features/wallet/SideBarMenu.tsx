import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { Identicon } from '../../components/icons/Identicon';
import { tryFindToken } from '../../context/context';
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

import { useAccounts, useDisconnectFns } from './hooks/multiProtocol';
import { AccountInfo } from './hooks/types';

export function SideBarMenu({
  onConnectWallet,
  isOpen,
  onClose,
}: {
  onConnectWallet: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

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
      <div
        className={`fixed right-0 top-0 h-full w-88 bg-white bg-opacity-95 shadow-lg transform ease-in duration-100 transition-transform z-30 ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isMenuOpen && (
          <button
            className="absolute flex items-center justify-center w-9 h-full -translate-x-full left-0 top-0 bg-sideBar border-[0.5px] border-white border-solid transition-all hover:bg-hoverForm"
            onClick={() => onClose()}
          >
            <Image
              src={CollapseIcon}
              width={24}
              height={24}
              alt=""
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(95%) sepia(13%) saturate(5448%) hue-rotate(296deg) brightness(96%) contrast(110%)',
              }}
            />
          </button>
        )}
        <div className="bg-sideBar w-full h-full flex flex-col overflow-y-auto">
          <div className="w-full border-[0.5px] border-l-0 border-solid border-white bg-black py-2 px-3.5 text-white text-lg font-bold leading-6  tracking-wider">
            CONNECTED WALLETS
          </div>
          <div className="my-3 px-3 space-y-3">
            {readyAccounts.map((acc, i) =>
              acc.addresses.map((addr, j) => {
                //if (addr?.chainName?.includes(PLACEHOLDER_COSMOS_CHAIN)) return null;
                return <AccountSummary key={`${i}-${j}`} account={acc} address={addr.address} />;
              }),
            )}
            <button onClick={onConnectWallet} className={styles.btn}>
              <Icon src={Wallet} alt="" size={24} className="invert" />
              <div className="ml-2 text-white">Connect wallet</div>
            </button>
            <button onClick={onClickDisconnect} className={styles.btn}>
              <Icon src={Logout} alt="" size={24} className="invert" />
              <div className="ml-2 text-white">Disconnect all wallets</div>
            </button>
          </div>
          <div className="w-full border-[0.5px] border-l-0 border-solid border-white bg-black py-2 px-3.5 mb-4 text-white text-lg font-bold leading-6 tracking-wider">
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
                className="flex flex-row items-center px-2.5 py-2 my-5 hover:bg-hoverForm transition-all duration-500"
              >
                <Image className="mr-4 invert" src={ResetIcon} width={17} height={17} alt="" />
                <span className="text-white text-sm font-normal">Reset transaction history</span>
              </button>
            )}
          </div>
        </div>
      </div>
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

function AccountSummary({ address }: { account: AccountInfo; address: Address }) {
  const onClickCopy = async () => {
    if (!address) return;
    await tryClipboardSet(address);
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

  return (
    <button
      key={address}
      onClick={onClickCopy}
      className={`${styles.btn} bg-sideBar border-[0.5px] border-white border-solid`}
    >
      <div className="shrink-0">
        <Identicon address={address} size={40} />
      </div>
      <div className="flex flex-col mx-3 items-start">
        {/* <div className="text-gray-800 text-sm font-normal">{account.connectorName || 'Wallet'}</div> */}
        <div className="text-white font-medium leading-6 text-sm truncate w-64">
          {address ? address : 'Unknown'}
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
  const { amount, origin, destination, status, timestamp, originTokenAddressOrDenom } = transfer;
  const token = tryFindToken(origin, originTokenAddressOrDenom);

  return (
    <button
      key={timestamp}
      onClick={onClick}
      className="flex justify-between items-center border-[0.5px] border-white px-2.5 py-2 mb-3 hover:bg-hoverForm transition-all duration-500"
    >
      <div className="flex items-center">
        <div className="mr-2.5 flex flex-col items-center justify-center h-[2.25rem] w-[2.25rem] p-1.5">
          <ChainLogo chainName={origin} size={32} />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col">
            <div className="flex items items-baseline">
              <span className="text-white text-sm font-medium leading-6">{amount}</span>
              <span className="text-white text-sm font-medium leading-6 ml-1">
                {token?.symbol || ''}
              </span>
            </div>
            <div className="mt-1 flex flex-row items-center">
              <span className="text-white text-sm font-medium leading-6 tracking-wide">
                {getChainDisplayName(origin, true)}
              </span>
              <Image className="mx-1 invert" src={ArrowRightIcon} width={10} height={10} alt="" />
              <span className="text-white text-sm font-medium leading-6 tracking-wide">
                {getChainDisplayName(destination, true)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-6 h-6">
        {STATUSES_WITH_ICON.includes(status) ? (
          <Image
            src={getIconByTransferStatus(status)}
            width={28}
            height={26}
            alt=""
            style={{
              filter:
                'brightness(0) saturate(100%) invert(100%) sepia(3%) saturate(7474%) hue-rotate(232deg) brightness(105%) contrast(100%)',
            }}
          />
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
  btn: 'w-full flex items-center px-2.5 py-2 text-sm hover:bg-hoverForm transition-all duration-500',
};
