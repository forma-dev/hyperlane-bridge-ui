import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { ChainSelectListModal } from './ChainSelectModal';
import { getChainDisplayName, formatAddress } from './utils';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useAccounts, useConnectFns, useDisconnectFns } from '../wallet/hooks/multiProtocol';
type Props = {
  name: string;
  label: string;
  chains: ChainName[];
  onChange?: (id: ChainName) => void;
  disabled?: boolean;
  transferType: string;
};

const cosmosChainIds = ["stride", "celestia"];
const evmChainIds = ["sketchpad"];

export function ChainSelectField({ name, label, chains, onChange, disabled, transferType }: Props) {
  const [field, , helpers] = useField<ChainName>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const [chainId, setChainId] = useState<string>("");
  
  const { accounts } = useAccounts();
  const cosmosNumReady = accounts[ProtocolType.Cosmos].addresses.length;
  const evmNumReady = accounts[ProtocolType.Ethereum].addresses.length;
  const cosmosAddress = accounts[ProtocolType.Cosmos].addresses[0]?.address;
  const evmAddress = accounts[ProtocolType.Ethereum].addresses[0]?.address;

  const handleChange = (newChainId: ChainName) => {
    helpers.setValue(newChainId);
    // Reset other fields on chain change
    setFieldValue('recipient', '');
    setFieldValue('amount', '');
    setFieldValue('tokenIndex', 0);
    setChainId(newChainId);
    if (onChange) onChange(newChainId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const onClick = () => {
    if (!disabled && !isLocked) setIsModalOpen(true);
  };

  const connectFns = useConnectFns();
  const disconnectFns = useDisconnectFns();

  const onDisconnectEnv = () => async () => {
    let env:string = "";
    if (cosmosChainIds.includes(chainId)) {
      env = ProtocolType.Cosmos;
    } else {
      env = ProtocolType.Ethereum;
    }

    close();
    const disconnectFn = disconnectFns[env];
    if (disconnectFn) disconnectFn();
  };

  const onClickEnv = () => async () => {
    let env:string = "";
    if (cosmosChainIds.includes(chainId)) {
      env = ProtocolType.Cosmos;
    } else {
      env = ProtocolType.Ethereum;
    }

    if (env == ProtocolType.Cosmos) {
      if (window && (window as any).keplr) {
        const chains = await (window as any).keplr.getChainInfosWithoutEndpoints();
        const hasStrideTestnet = chains.find(el => el.chainId === "stride-internal-1") ? true : false;
        if (!hasStrideTestnet) {
          await (window as any).keplr.experimentalSuggestChain({
            chainId: "stride-internal-1",
            chainName: "Stride (Testnet)",
            rpc: "https://stride.testnet-1.stridenet.co",
            rest: "https://stride.testnet-1.stridenet.co/api/",
            stakeCurrency: {
              coinDenom: "STRD",
              coinMinimalDenom: "ustrd",
              coinDecimals: 6,
            },
            bip44: {
              coinType: 118,
            },
            bech32Config: {
              bech32PrefixAccAddr: "stride",
              bech32PrefixAccPub: "stridepub",
              bech32PrefixValAddr: "stridevaloper",
              bech32PrefixValPub: "stridevaloperpub",
              bech32PrefixConsAddr: "stridevalcons",
              bech32PrefixConsPub: "stridevalconspub"
            },
            currencies: [{
              coinDenom: "STRD",
              coinMinimalDenom: "ustrd",
              coinDecimals: 6,
            }],
            feeCurrencies: [{
              coinDenom: "STRD",
              coinMinimalDenom: "ustrd",
              coinDecimals: 6,
            },{
                "coinDenom": "TIA",
                "coinMinimalDenom": "ibc/1A7653323C1A9E267FF7BEBF40B3EEA8065E8F069F47F2493ABC3E0B621BF793",
                "coinDecimals": 6,
                "coinGeckoId": "celestia",
                "gasPriceStep": {
                  "low": 0.01,
                  "average": 0.01,
                  "high": 0.01
                }
              }],
          });
        }
      }
    }

    close();
    const connectFn = connectFns[env];
    if (connectFn) connectFn();
  };


  useEffect(() => {
    if (
      (transferType == 'withdraw' && label == 'From') ||
      (transferType == 'deposit' && label == 'To')
    ) {
      handleChange('sketchpad');
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
  }, [transferType, label]);

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
          className={`mt-1.5 w-9/12 border-[1.5px] border-solid border-[#8C8D8F] h-[48px] ${
            disabled || isLocked ? styles.disabled : styles.enabled
          }`}
          onClick={onClick}
        >
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center">
              <ChainLogo chainName={field.value} size={32} />
              <div className="flex flex-col justify-center items-start">
                <span className="text-white font-medium text-base leading-5 ml-2">
                  {getChainDisplayName(field.value, true)}
                </span>
                {
                  (cosmosChainIds.includes(chainId) && cosmosAddress)
                    ?
                    <span className="text-white font-medium text-base leading-5 ml-2">
                      {formatAddress(cosmosAddress)}
                    </span>
                    : 
                      (evmChainIds.includes(chainId) && evmAddress) 
                      ?
                      <span className="text-white font-medium text-xs leading-4 ml-2">
                        {formatAddress(evmAddress)}
                      </span>
                      : <></>
                }
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
        {
        ((cosmosChainIds.includes(chainId) && cosmosNumReady === 0) ||
          (evmChainIds.includes(chainId) && evmNumReady === 0))
          &&
          <button onClick={onClickEnv()} className="w-3/12 border-[0.5px] border-white border-solid bg-white p-2 h-[48px] flex items-center justify-center cursor-pointer">
            <span className="font-plex font-bold text-sm leading-6">CONNECT</span>
          </button>
        }
        
        {
          ((cosmosChainIds.includes(chainId) && cosmosNumReady > 0) ||
          (evmChainIds.includes(chainId) && evmNumReady > 0))
            &&
            <button onClick={onDisconnectEnv()} className="w-3/12 border-[0.5px] border-white border-solid bg-white p-2 h-[48px] flex items-center justify-center cursor-pointer">
              <span className="font-plex font-bold text-sm leading-6">DISCONNECT</span>
            </button>
        }
        
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
  enabled: 'hover:border-white hover:border-[1px] bg-black',
  disabled: 'cursor-default bg-form',
};
