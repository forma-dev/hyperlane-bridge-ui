import { ProtocolType } from '@hyperlane-xyz/utils';
import { usePrivy } from '@privy-io/react-auth';
import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { logger } from '../../utils/logger'; // Assuming you have a logger utility
import { TransferFormValues } from '../transfer/types';
import { useAccountAddressForChain, useAccounts, useConnectFns, useDisconnectFns } from '../wallet/hooks/multiProtocol';
import { ChainSelectListModal } from './ChainSelectModal';
import { formatAddress, getChainDisplayName } from './utils';

type Props = {
  name: string;
  label: string;
  chains: ChainName[];
  onChange?: (id: ChainName) => void;
  disabled?: boolean;
  transferType: string;
};

const cosmosChainIds = ['stride', 'celestia'];
const evmChainIds = ['forma', 'sketchpad'];

export function ChainSelectField({ name, label, chains, onChange, disabled, transferType}: Props) {
  const { authenticated, user, logout, connectOrCreateWallet } = usePrivy();
  const [field, , helpers] = useField<ChainName>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const [chainId, setChainId] = useState<string>('');

  const { accounts } = useAccounts();
  const connectFns = useConnectFns();
  const disconnectFns = useDisconnectFns();

  const cosmosNumReady = accounts[ProtocolType.Cosmos].addresses.length;

  const accountAddress = useAccountAddressForChain(chainId);

  const handleChange = useCallback((newChainId: ChainName) => {
    helpers.setValue(newChainId);
    setFieldValue('recipient', '');
    setFieldValue('amount', '');
    setFieldValue('tokenIndex', 0);
    setChainId(newChainId);

    if (onChange) onChange(newChainId);
  }, [helpers, setFieldValue, onChange]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const onClick = () => {
    if (!disabled && !isLocked) setIsModalOpen(true);
  };

  const onClickEnv = useCallback(() => {
    logger.info(`onClickEnv called for chainId: ${chainId}`);

    if (cosmosChainIds.includes(chainId)) {
      logger.info('Cosmos chain detected');
      const connectFn = connectFns[ProtocolType.Cosmos];
      if (connectFn) {
        logger.info('Calling Cosmos connect function');
        connectFn();
      } else {
        logger.warn('Cosmos connect function not found');
      }
    } else {
      logger.info('Non-Cosmos chain detected, attempting to connect or create wallet');
      try {
        logger.info('Calling connectOrCreateWallet');
        connectOrCreateWallet();
      } catch (error) {
        logger.error('Error in connectOrCreateWallet:', error);
      }
    }
  }, [chainId, connectFns, connectOrCreateWallet]);

  const onDisconnectEnv = useCallback(() => {
    if (cosmosChainIds.includes(chainId)) {
      const disconnectFn = disconnectFns[ProtocolType.Cosmos];
      if (disconnectFn) {
        disconnectFn();
      }
    } else {
      logout();
    }
    setFieldValue('recipient', '');
    setFieldValue('forceUpdate', Date.now());
  }, [chainId, disconnectFns, logout, setFieldValue]);

  useEffect(() => {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    if (
      (transferType === 'withdraw' && label === 'From') ||
      (transferType === 'deposit' && label === 'To')
    ) {
      handleChange(isMainnet ? 'forma' : 'sketchpad');
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }

    if (transferType === 'withdraw' && label === 'To') {
      handleChange('stride');
    }

    if (transferType === 'deposit' && label === 'From') {
      handleChange('celestia');
    }
  }, [transferType, label, handleChange]);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex justify-between pr-1">
        <label htmlFor={name} className="block text-sm text-secondary leading-5 font-medium">
          {label}
        </label>
      </div>
      <div className="w-full flex gap-[12px] justify-between items-end">
        <button
          type="button"
          name={field.name}
          className={`mt-1.5 w-9/12 border-[1px] border-solid border-[#8C8D8F] h-[48px] ${
            disabled ? styles.disabled : styles.enabled
          } ${isLocked ? styles.locked : ''}`}
          onClick={onClick}
        >
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center">
              <ChainLogo chainName={field.value} size={32} />
              <div className="flex flex-col justify-center items-start">
                <span
                  className={`font-medium text-base leading-5 ml-2 ${
                    disabled
                      ? 'bg-disabled text-disabled cursor-default pointer-events-none'
                      : 'bg-black text-white'
                  }`}
                >
                  {getChainDisplayName(field.value, true)}
                </span>
                {(cosmosChainIds.includes(chainId) && cosmosNumReady > 0) ||
                (evmChainIds.includes(chainId) && authenticated && user?.wallet) ? (
                  <span
                    className={`font-medium text-xs leading-5 ml-2 ${
                      disabled
                        ? 'bg-disabled text-disabled cursor-default pointer-events-none'
                        : 'bg-black text-white'
                    }`}
                  >
                    {formatAddress(accountAddress || '')}
                  </span>
                ) : (
                  <></>
                )}
              </div>
            </div>
            <div>
              {!disabled && !isLocked && (
                <Image
                  src={ChevronIcon}
                  className="text-secondary"
                  width={12}
                  height={6}
                  alt=""
                  style={{ filter: 'invert(1)' }}
                />
              )}
            </div>
          </div>
        </button>
        {((cosmosChainIds.includes(chainId) && cosmosNumReady === 0) ||
          (evmChainIds.includes(chainId) && !authenticated)) && (
          <button
            disabled={disabled}
            type="button"
            onClick={onClickEnv}
            className={`w-4/12 border-[0.5px] border-white border-solid bg-white p-2 h-[48px] flex items-center justify-center hover:bg-[#FFFFFFCC] ${
              disabled ? styles.disabled : styles.enabled
            }`}
          >
            <span
              className={`w-full font-plex font-bold text-sm leading-6 px-2 py-4 ${
                disabled ? 'text-disabled' : 'text-black'
              }`}
            >
              CONNECT
            </span>
          </button>
        )}

        {((cosmosChainIds.includes(chainId) && cosmosNumReady > 0) ||
          (evmChainIds.includes(chainId) && authenticated)) && (
          <button
            disabled={disabled}
            type="button"
            onClick={onDisconnectEnv}
            className={`w-4/12 border-[0.5px] px-2 border-[#8C8D8F] border-solid  p-2 h-[48px] flex items-center justify-center hover:bg-[#FFFFFF1A] ${
              disabled ? styles.disabled : styles.enabled
            }`}
          >
            <span
              className={`w-full font-plex font-bold text-sm leading-6  ${
                disabled ? 'text-disabled' : 'text-white'
              }`}
            >
              DISCONNECT
            </span>
          </button>
        )}
      </div>

      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        chains={chains}
        onSelect={handleChange}
      />
    </div>
  );
}

const styles = {
  base: 'w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'cursor-pointer hover:border-white hover:border-[1px] bg-form',
  disabled: 'cursor-default bg-disabled pointer-events-none',
  locked: 'cursor-default pointer-events-none',
};
