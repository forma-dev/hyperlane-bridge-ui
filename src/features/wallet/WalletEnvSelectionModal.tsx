import Image from 'next/image';
import { PropsWithChildren } from 'react';

//
import { ProtocolType } from '@hyperlane-xyz/utils';

// import { ChainLogo } from '@hyperlane-xyz/widgets';
import { Modal } from '../../components/layout/Modal';

import { useConnectFns } from './hooks/multiProtocol';

export function WalletEnvSelectionModal({
  isOpen,
  close,
  setIsSideBarOpen,
}: {
  isOpen: boolean;
  close: () => void;
  isSideBarOpen: boolean;
  setIsSideBarOpen: (isOpen: boolean) => void;
}) {
  const connectFns = useConnectFns();

  const onClickEnv = (env: ProtocolType) => async () => {
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

    close();
    setIsSideBarOpen(true);
    const connectFn = connectFns[env];
    if (connectFn) connectFn();
  };

  return (
    <Modal title="Select Network" isOpen={isOpen} close={close} width={'max-w-[405px]'}>
      <div className="px-8 pt-4 pb-8 mt-8 flex flex-col space-y-6">
        {/* <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          logoChainId={chainMetadata.solanadevnet.chainId}
        >
          Solana
        </EnvButton> */}
        <EnvButton
          onClick={onClickEnv(ProtocolType.Cosmos)}
          subTitle="a Celestia"
          logo={<Image src={'/logos/celestia.png'} width={34} height={34} alt="" />}
        >
          Celestia
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Ethereum)}
          subTitle="an EVM"
          logo={<Image src={'/logos/forma.png'} width={34} height={34} alt="" />}
        >
          Ethereum
        </EnvButton>
      </div>
    </Modal>
  );
}

function EnvButton({
  onClick,
  subTitle,
  logo,
  logoChainId,
  children,
}: PropsWithChildren<{
  subTitle: string;
  logoChainId?: number | string;
  logo?: React.ReactElement;
  onClick?: () => void;
}>) {
  if (!logo) {
    if (!logoChainId) throw new Error('Either logo or logoChainId must be provided');
    if (typeof logoChainId !== 'number') throw new Error('logoChainId must be a number');
    // Fallback: use Celestia icon as generic EVM logo
    logo = <Image src={'/logos/celestia.png'} width={34} height={34} alt="" />;
  }
  return (
    <button
      onClick={onClick}
      className="w-full py-6 space-y-2.5 flex flex-col items-center border-2 border-white hover:bg-hoverForm"
    >
      {logo}
      <div className="uppercase text-primary font-medium text-sm leading-5 tracking-wide">
        {children}
      </div>
      <div className="text-secondary font-normal text-sm leading-5">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
