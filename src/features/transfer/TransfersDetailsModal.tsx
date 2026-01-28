import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { CopyButton } from '../../components/buttons/CopyButton';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { WideChevron } from '../../components/icons/WideChevron';
import { Modal } from '../../components/layout/Modal';
import { getMultiProvider, getWarpCore } from '../../context/context';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useTimeout } from '../../utils/timeout';
import {
  getIconByTransferStatus,
  getTransferStatusLabel,
  isTransferFailed,
  isTransferSent,
} from '../../utils/transfer';
import { mapRelayChainToInternalName } from '../chains/relayUtils';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { useAccountForChain } from '../wallet/hooks/multiProtocol';

import { TransferContext, TransferStatus } from './types';

// Helper function to get consistent token display info
function getTokenDisplayInfo(transfer: TransferContext, relayChains: any[]) {
  const { origin, destination, selectedToken } = transfer;

  // Check if this is a Relay transfer
  const isRelayTransfer =
    relayChains.some((chain) => mapRelayChainToInternalName(chain.name) === origin.toLowerCase()) ||
    relayChains.some(
      (chain) => mapRelayChainToInternalName(chain.name) === destination.toLowerCase(),
    ) ||
    origin === 'forma' ||
    destination === 'forma';

  // For withdrawals (Forma -> other chains), always show TIA
  const isWithdrawal = origin === 'forma';
  if (isWithdrawal) {
    return {
      symbol: 'TIA',
      logoURI: '/logos/celestia.png',
      isRelay: isRelayTransfer,
    };
  }

  // For deposits (other chains -> Forma), use selectedToken if available
  if (selectedToken && selectedToken.symbol) {
    return {
      symbol: selectedToken.symbol,
      logoURI: selectedToken.logoURI,
      isRelay: isRelayTransfer,
    };
  }

  // Fallback to TIA for Forma chains
  if (origin === 'forma') {
    return {
      symbol: 'TIA',
      logoURI: '/logos/celestia.png',
      isRelay: isRelayTransfer,
    };
  }

  return {
    symbol: 'TIA', // Default fallback
    logoURI: '/logos/celestia.png',
    isRelay: isRelayTransfer,
  };
}

export function TransfersDetailsModal({
  isOpen,
  onClose,
  transfer,
}: {
  isOpen: boolean;
  onClose: () => void;
  transfer: TransferContext;
}) {
  const [fromUrl, setFromUrl] = useState<string>('');
  const [toUrl, setToUrl] = useState<string>('');
  const [originTxUrl, setOriginTxUrl] = useState<string>('');

  const {
    status,
    origin,
    destination,
    amount,
    sender,
    recipient,
    originTokenAddressOrDenom,
    originTxHash,
    msgId,
    timestamp,
  } = transfer || {};

  const account = useAccountForChain(origin);
  const multiProvider = getMultiProvider();
  const { relayChains } = useRelaySupportedChains();

  const getMessageUrls = useCallback(async () => {
    try {
      if (originTxHash) {
        const originTxUrl = multiProvider.tryGetExplorerTxUrl(origin, { hash: originTxHash });
        if (originTxUrl) setOriginTxUrl(fixDoubleSlash(originTxUrl));
      }
      const [fromUrl, toUrl] = await Promise.all([
        multiProvider.tryGetExplorerAddressUrl(origin, sender),
        multiProvider.tryGetExplorerAddressUrl(destination, recipient),
      ]);
      if (fromUrl) setFromUrl(fixDoubleSlash(fromUrl));
      if (toUrl) setToUrl(fixDoubleSlash(toUrl));
    } catch (error) {
      logger.error('Error fetching URLs:', error);
    }
  }, [sender, recipient, originTxHash, multiProvider, origin, destination]);

  useEffect(() => {
    if (!transfer) return;
    getMessageUrls().catch((err) =>
      logger.error('Error getting message URLs for details modal', err),
    );
  }, [transfer, getMessageUrls]);

  const isAccountReady = !!account?.isReady;
  const connectorName = account?.connectorName || 'wallet';

  // Check for Relay transfer
  const isRelayTransfer = useMemo(() => {
    const { origin, destination, originTokenAddressOrDenom, relayTxHash } = transfer;

    // If we have a relayTxHash, this is definitely a Relay transfer
    if (relayTxHash) {
      return true;
    }

    // Check for Relay tokens - now dynamic from API
    const relayTokenAddresses: string[] = [];

    const hasRelayToken = originTokenAddressOrDenom
      ? relayTokenAddresses.includes(originTokenAddressOrDenom)
      : false;

    // Check for Relay chains using dynamic relayChains
    const originIsRelay = relayChains.some(
      (chain) => mapRelayChainToInternalName(chain.name) === origin.toLowerCase(),
    );
    const destinationIsRelay = relayChains.some(
      (chain) => mapRelayChainToInternalName(chain.name) === destination.toLowerCase(),
    );

    // Check for Forma involvement (Relay bridge)
    const isFormaInvolved = origin === 'forma' || destination === 'forma';

    return hasRelayToken || ((originIsRelay || destinationIsRelay) && isFormaInvolved);
  }, [transfer, relayChains]);

  // Get consistent token display info
  const tokenDisplayInfo = getTokenDisplayInfo(transfer, relayChains);
  const displaySymbol = tokenDisplayInfo.symbol;

  // For non-Relay transfers, use warp core to find token with error handling
  const token = useMemo(() => {
    if (isRelayTransfer) return null;

    try {
      return getWarpCore().findToken(origin, originTokenAddressOrDenom);
    } catch (error) {
      return null;
    }
  }, [isRelayTransfer, origin, originTokenAddressOrDenom]);

  const isPermissionlessRoute = hasPermissionlessChain([destination, origin]);

  const isSent = isTransferSent(status);
  const isFailed = isTransferFailed(status);
  const isFinal = isSent || isFailed;
  const statusDescription = getTransferStatusLabel(
    status,
    connectorName,
    isPermissionlessRoute,
    isAccountReady,
  );
  const showSignWarning = useSignIssueWarning(status);

  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(new Date().getTime())),
    [timestamp],
  );

  const explorerLink = getHypExplorerLink(origin, msgId);

  return (
    <Modal
      showCloseBtn={false}
      isOpen={isOpen}
      close={onClose}
      title=""
      padding="p-4 md:p-6"
      width="max-w-sm"
    >
      {isFinal && (
        <div className="flex justify-between">
          <h2 className="text-white font-medium text-base leading-6">{date}</h2>
          <div className="flex items-center font-medium text-base leading-6">
            {isSent ? (
              <h3 className="text-[#35D07F] font-bold">SENT</h3>
            ) : (
              <h3 className="text-red-500 font-bold">FAILED</h3>
            )}
            <Image
              src={getIconByTransferStatus(status)}
              width={25}
              height={25}
              alt=""
              className="ml-2"
            />
          </div>
        </div>
      )}

      <div className="mt-4 p-3 flex items-center justify-center w-full bg-gray-150 border border-gray-400 rounded-md">
        {isRelayTransfer ? (
          // For Relay transfers, show token icon using same logic as the form
          (() => {
            // For withdraws (Forma -> Relay chains), always show TIA logo
            const isWithdrawal = origin === 'forma';

            if (isWithdrawal) {
              return (
                <Image
                  src="/logos/celestia.png"
                  alt="TIA"
                  width={30}
                  height={30}
                  className="rounded-full"
                />
              );
            }

            // For deposits, use the token icon from display info
            if (tokenDisplayInfo.logoURI) {
              return (
                <Image
                  src={tokenDisplayInfo.logoURI}
                  alt={tokenDisplayInfo.symbol}
                  width={30}
                  height={30}
                  className="rounded-full"
                />
              );
            }

            // No icon available
            return null;
          })()
        ) : (
          <TokenIcon token={token} size={30} />
        )}
        <div className="ml-2 flex items items-baseline">
          <span className="text-xl font-medium">
            {amount?.toString().replace(/\s*(utia|TIA)\s*$/, '') || amount}
          </span>
          <span className="text-xl font-medium ml-1">{displaySymbol}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-around">
        <div className="ml-2 flex flex-col items-center">
          <ChainLogo chainName={origin} size={64} background={false} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(origin, false)}
          </span>
        </div>
        <div className="flex mb-5 sm:space-x-1.5">
          <WideChevron />
          <WideChevron />
        </div>
        <div className="mr-2 flex flex-col items-center">
          <ChainLogo chainName={destination} size={64} background={false} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(destination, false)}
          </span>
        </div>
      </div>

      {isFinal ? (
        <div className="mt-5 flex flex-col space-y-4">
          <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
          <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
          {(token?.addressOrDenom || (isRelayTransfer && originTokenAddressOrDenom)) && (
            <TransferProperty
              name="Token Address or Denom"
              value={isRelayTransfer ? displaySymbol : token?.addressOrDenom || ''}
            />
          )}
          {originTxHash && (
            <TransferProperty
              name="Origin Transaction Hash"
              value={originTxHash}
              url={originTxUrl}
            />
          )}
          {msgId && <TransferProperty name="Message ID" value={msgId} />}

          {/* Show fee information for Relay transfers */}
          {isRelayTransfer && transfer.fees && (
            <>
              {transfer.fees.gas && (
                <TransferProperty
                  name="Gas Fee"
                  value={`${transfer.fees.gas.amountFormatted || '0'} ${
                    transfer.fees.gas.currency?.symbol || 'Unknown'
                  }`}
                />
              )}
              {transfer.fees.relayer && (
                <TransferProperty
                  name="Relay Fee"
                  value={`${transfer.fees.relayer.amountFormatted || '0'} ${
                    transfer.fees.relayer.currency?.symbol || 'Unknown'
                  }`}
                />
              )}
            </>
          )}

          {/* Show Relay transaction link for Relay transfers */}
          {isRelayTransfer && transfer.relayTxHash && (
            <div className="flex justify-between">
              <span className="text-gray-350 text-sm leading-normal tracking-wider">
                <a
                  className="text-blue-500 text-sm leading-normal tracking-wider underline underline-offset-2 hover:opacity-80 active:opacity-70"
                  href={`https://relay.link/transaction/${transfer.relayTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View transaction in Relay Explorer
                </a>
              </span>
            </div>
          )}

          {explorerLink && !isRelayTransfer && (
            <div className="flex justify-between">
              <span className="text-gray-350 text-xs leading-normal tracking-wider">
                <a
                  className="text-gray-350 text-xs leading-normal tracking-wider underline underline-offset-2 hover:opacity-80 active:opacity-70"
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View message in Hyperlane Explorer
                </a>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-4 flex flex-col justify-center items-center">
          <Spinner />
          <div
            className={`mt-5 font-semibold text-sm text-center ${
              isFailed ? 'text-red-600' : 'text-primary'
            }`}
          >
            {statusDescription}
          </div>
          {showSignWarning && (
            <div className="mt-3 text-primary font-semibold text-sm text-center">
              Relay transactions may take up to 1 minute to complete. <br /> <br /> If your wallet
              does not show a transaction request, please try the transfer again.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// TODO consider re-enabling timeline
export function Timeline({
  transferStatus,
  originTxHash,
}: {
  transferStatus: TransferStatus;
  originTxHash?: string;
}) {
  const isFailed = transferStatus === TransferStatus.Failed;
  const { stage, timings, message } = useMessageTimeline({
    multiProvider: getMultiProvider() as any,
    originTxHash: isFailed ? undefined : originTxHash,
  });
  const messageStatus = isFailed ? MessageStatus.Failing : message?.status || MessageStatus.Pending;

  return (
    <div className="mt-6 mb-2 w-full flex flex-col justify-center items-center timeline-container">
      <MessageTimeline
        status={messageStatus}
        stage={stage}
        timings={timings}
        timestampSent={message?.origin?.timestamp}
        hideDescriptions={true}
      />
    </div>
  );
}

function TransferProperty({ name, value, url }: { name: string; value: string; url?: string }) {
  return (
    <div>
      <div className="flex justify-between items-center">
        <label className="text-gray-350 text-sm leading-normal tracking-wider">{name}</label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image
                className="color-[#1E1E1E] invert hover:opacity-70 active:opacity-90"
                src={LinkIcon}
                width={14}
                height={14}
                alt=""
              />
            </a>
          )}
          <CopyButton classes="color-[#1E1E1E] invert" copyValue={value} width={14} height={14} />
        </div>
      </div>
      <div className="mt-1 text-sm leading-normal tracking-wider truncate">{value}</div>
    </div>
  );
}

// TODO: Remove this once we have a better solution for wagmi signing issue
// https://github.com/wagmi-dev/wagmi/discussions/2928
function useSignIssueWarning(status: TransferStatus) {
  const [showWarning, setShowWarning] = useState(false);
  const warningCallback = useCallback(() => {
    if (status === TransferStatus.SigningTransfer) setShowWarning(true);
  }, [status, setShowWarning]);
  useTimeout(warningCallback, 20_000);
  return showWarning;
}

// TODO cosmos fix double slash problem in ChainMetadataManager
// Occurs when baseUrl has not other path (e.g. for manta explorer)
function fixDoubleSlash(url: string) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}
