import { useField, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { ChevronIcon } from '../../components/icons/ChevronIcon';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import {
    useAccountAddressForChain,
    useAccounts,
    useConnectFns,
    useDisconnectFns,
} from '../wallet/hooks/multiProtocol';

import { ChainSelectListModal } from './ChainSelectModal';
import { formatAddress, getChainDisplayName, mapRelayChainToInternalName } from './utils';

type Props = {
  name: string;
  label: string;
  chains: ChainName[];
  onChange?: (id: ChainName) => void;
  disabled?: boolean;
  transferType: string;
};

export function ChainSelectField({ name, label, chains, onChange, disabled, transferType }: Props) {
  const [field, , helpers] = useField<ChainName>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const { accounts } = useAccounts();
  const connectFns = useConnectFns();
  const disconnectFns = useDisconnectFns();
  const { relayChains } = useRelaySupportedChains();
  const { setFieldValue } = useFormikContext<any>();

  // Dynamic chain protocol detection
  const chainProtocols = useMemo(() => {
    const cosmos: string[] = [];
    const evm: string[] = [];

    // Add hardcoded known chains for this bridge
    cosmos.push('stride', 'celestia');
    evm.push('forma', 'sketchpad');

    // Add Relay chains (all EVM-based) - using centralized mapping
    relayChains.forEach((chain) => {
      if (chain.name) {
        const internalName = mapRelayChainToInternalName(chain.name);

        // Only add if not already present
        if (internalName && !evm.includes(internalName) && !cosmos.includes(internalName)) {
          evm.push(internalName);
        }
      }
    });

    return { cosmos, evm };
  }, [relayChains]);

  const cosmosNumReady = accounts[ProtocolType.Cosmos].addresses.length;
  const evmNumReady = accounts[ProtocolType.Ethereum].addresses.length;

  const chainId = field.value;
  const account = useAccountAddressForChain(chainId);

  // Wallet connection state for the current chain
  const isWalletConnected =
    (chainProtocols.cosmos.includes(chainId) && cosmosNumReady > 0) ||
    (chainProtocols.evm.includes(chainId) && evmNumReady > 0);

  const handleChange = useCallback(
    (newChainId: ChainName, token?: any) => {
      helpers.setValue(newChainId);
      onChange?.(newChainId);

      // If a token was selected, update the form with token details
      if (token) {
        const tokenData = {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.metadata?.logoURI,
          chainId: relayChains.find(
            (rc) => mapRelayChainToInternalName(rc.name) === newChainId.toLowerCase(),
          )?.id,
        };
        setFieldValue('selectedToken', tokenData);
      }
    },
    [helpers, onChange, setFieldValue, relayChains],
  );

  const onClick = () => {
    if (!disabled && !isLocked) setIsModalOpen(true);
  };

  const onDisconnectEnv = () => async () => {
    let env: string = '';
    if (chainProtocols.cosmos.includes(chainId)) {
      env = ProtocolType.Cosmos;
    } else {
      env = ProtocolType.Ethereum;
    }

    const disconnectFn = disconnectFns[env];
    if (disconnectFn) disconnectFn();
  };

  const onClickEnv = () => async () => {
    let env: string = '';
    if (chainProtocols.cosmos.includes(chainId)) {
      env = ProtocolType.Cosmos;
    } else {
      env = ProtocolType.Ethereum;
    }

    if (env == ProtocolType.Cosmos) {
      if (process.env.NEXT_PUBLIC_NETWORK === 'testnet' && window && (window as any).keplr) {
        const chains = await (window as any).keplr.getChainInfosWithoutEndpoints();
        const hasStrideTestnet = chains.find((el) => el.chainId === 'stride-internal-1')
          ? true
          : false;
        if (!hasStrideTestnet) {
          await (window as any).keplr.experimentalSuggestChain({
            chainId: 'stride-internal-1',
            chainName: 'Stride (Testnet)',
            rpc: 'https://stride.testnet-1.stridenet.co',
            rest: 'https://stride.testnet-1.stridenet.co/api/',
            stakeCurrency: {
              coinDenom: 'STRD',
              coinMinimalDenom: 'ustrd',
              coinDecimals: 6,
            },
            bip44: {
              coinType: 118,
            },
            bech32Config: {
              bech32PrefixAccAddr: 'stride',
              bech32PrefixAccPub: 'stridepub',
              bech32PrefixValAddr: 'stridevaloper',
              bech32PrefixValPub: 'stridevaloperpub',
              bech32PrefixConsAddr: 'stridevalcons',
              bech32PrefixConsPub: 'stridevalconspub',
            },
            currencies: [
              {
                coinDenom: 'STRD',
                coinMinimalDenom: 'ustrd',
                coinDecimals: 6,
              },
            ],
            feeCurrencies: [
              {
                coinDenom: 'STRD',
                coinMinimalDenom: 'ustrd',
                coinDecimals: 6,
              },
              {
                coinDenom: 'TIA',
                coinMinimalDenom:
                  'ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793',
                coinDecimals: 6,
                coinGeckoId: 'celestia',
                gasPriceStep: {
                  low: 0.01,
                  average: 0.01,
                  high: 0.01,
                },
              },
            ],
          });
        }
      }
    }

    const connectFn = connectFns[env];
    // Do not block connect based on wallet count; rely on wagmi address
    if (connectFn) connectFn();
  };

  useEffect(() => {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    if (
      (transferType == 'withdraw' && label == 'From') ||
      (transferType == 'deposit' && label == 'To')
    ) {
      handleChange(isMainnet ? 'forma' : 'sketchpad');
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }

    if (transferType == 'withdraw' && label == 'To') {
      handleChange('stride');
    }

    if (transferType == 'deposit' && label == 'From') {
      handleChange('celestia');
    }
  }, [transferType, label, handleChange]);

  const { values } = useFormikContext<any>();

  // Auto-set recipient address when wallet is connected for deposit "To" or withdrawal "To" field
  useEffect(() => {
    const isDepositTo = transferType === 'deposit' && name === 'destination';
    const isWithdrawTo = transferType === 'withdraw' && name === 'destination';
    if ((isDepositTo || isWithdrawTo) && isWalletConnected && account && !values.recipient) {
      setFieldValue('recipient', account);
    }
  }, [transferType, name, isWalletConnected, account, values.recipient, setFieldValue, chainId]);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex justify-between pr-1">
        <label htmlFor={name} className="block text-sm text-secondary leading-5 font-medium">
          {label}
        </label>
      </div>
      <div className="w-full flex gap-[12px] justify-between items-end">
        {/* Normal chain selection button (no inline address input) */}
        <button
          type="button"
          name={field.name}
          className={`mt-1.5 w-9/12 h-[48px] rounded-card flex items-center justify-between px-3 border border-solid border-border transition-colors duration-200 ${
            disabled
              ? 'cursor-not-allowed bg-[#B5B5B5]'
              : isLocked
              ? 'bg-white cursor-not-allowed'
              : 'bg-white cursor-pointer hover:border-border-hover'
          }`}
          onClick={onClick}
        >
          <div className="flex items-center">
            <ChainLogo chainName={field.value} size={32} />
            <div className="flex flex-col justify-center items-start ml-2 flex-1 min-w-0">
              <span
                className={`font-bold text-base leading-5 truncate w-full text-left ${
                  disabled ? 'text-secondary' : 'text-black'
                }`}
              >
                {getChainDisplayName(field.value, false)}
              </span>
              {isWalletConnected && (
                <span
                  className={`font-medium text-xs leading-5 text-left ${
                    disabled ? 'text-secondary' : 'text-black'
                  }`}
                >
                  {formatAddress(account || '')}
                </span>
              )}
            </div>
          </div>
          <div>
            {!disabled && !isLocked && (
              <ChevronIcon className="w-[1.375rem] h-[1.375rem] text-arrow" />
            )}
          </div>
        </button>

        {/* Connect / Disconnect buttons */}
        {!isWalletConnected && (
          <button
            disabled={disabled}
            type="button"
            onClick={onClickEnv()}
            className={`w-4/12 h-[48px] flex items-center justify-center rounded-card border-b border-solid border-black transition-colors duration-200 ${
              disabled ? 'cursor-not-allowed bg-gray-300' : 'bg-arrow hover:bg-[#FB9241]'
            }`}
            style={{ borderBottomWidth: '0.5px' }}
          >
            <span
              className={`w-full font-sans font-bold text-[12px] sm:text-14px leading-6 px-2 py-4 tracking-tight uppercase ${
                disabled ? 'text-secondary' : 'text-black'
              }`}
            >
              CONNECT
            </span>
          </button>
        )}

        {isWalletConnected && (
          <button
            disabled={disabled}
            type="button"
            onClick={onDisconnectEnv()}
            className={`w-4/12 h-[48px] flex items-center justify-center rounded-card border border-solid transition-colors duration-200 ${
              disabled
                ? 'cursor-not-allowed text-secondary border-border bg-[#B5B5B5]'
                : 'bg-white text-black border-black hover:bg-bg-button-main-disabled'
            }`}
          >
            <span className="w-full font-sans font-bold text-[12px] sm:text-14px leading-6 px-2 py-4 tracking-tight uppercase whitespace-nowrap">
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
