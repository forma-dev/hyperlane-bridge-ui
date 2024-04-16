import Image from 'next/image';
import { PropsWithChildren } from 'react';

import { chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { ChainLogo } from '@hyperlane-xyz/widgets';

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

  const onClickEnv = (env: ProtocolType) => () => {
    close();
    setIsSideBarOpen(true);
    const connectFn = connectFns[env];
    if (connectFn) connectFn();
  };

  return (
    <Modal title="Select Network" isOpen={isOpen} close={close} width={'max-w-[405px]'}>
      <div className="px-8 pt-4 pb-8 mt-8 flex flex-col space-y-6">
        <EnvButton
          onClick={onClickEnv(ProtocolType.Ethereum)}
          subTitle="an EVM"
          logoChainId={chainMetadata.ethereum.chainId}
        >
          Ethereum
        </EnvButton>
        {/* <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          logoChainId={chainMetadata.solanadevnet.chainId}
        >
          Solana
        </EnvButton> */}
        <EnvButton
          onClick={onClickEnv(ProtocolType.Cosmos)}
          subTitle="a Cosmos"
          logo={<Image src={'/logos/cosmos.svg'} width={34} height={34} alt="" />}
        >
          Cosmos
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
    logo = <ChainLogo chainId={logoChainId} size={34} />;
  }
  return (
    <button
      onClick={onClick}
      className="w-full py-6 space-y-2.5 flex flex-col items-center border-2 border-white hover:bg-hoverForm"
    >
      {logo}
      <div className="uppercase text-primary font-medium text-sm leading-5 tracking-wide">{children}</div>
      <div className="text-secondary font-normal text-sm leading-5">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
