import { useState } from 'react';

// import { shortenAddress } from '@hyperlane-xyz/utils';
// import { SolidButton } from '../../components/buttons/SolidButton';
// import { Identicon } from '../../components/icons/Identicon';
import { useIsSsr } from '../../utils/ssr';

import { SideBarMenu } from './SideBarMenu';
import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';

// import { useAccounts } from './hooks/multiProtocol';

interface Props {
  isSideBarOpen?: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
}

export function WalletControlBar({ isSideBarOpen = false, setIsSideBarOpen }: Props) {
  const [showEnvSelectModal, setShowEnvSelectModal] = useState(false);

  // const { readyAccounts } = useAccounts();
  const isSsr = useIsSsr();

  // const numReady = readyAccounts.length;
  // const color = 'navBarButton';

  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="relative">
      <div className="relative">
        <button className="burger" onClick={() => setIsSideBarOpen(true)}></button>

        {/* {numReady === 0 && (
          <SolidButton
            classes="py-1.5 px-2.5"
            onClick={() => setShowEnvSelectModal(true)}
            title="Choose wallet"
            color={color}
          >
            <div className="ml-1.5 text-white text-sm leading-6 font-bold ">CONNECT WALLET</div>
          </SolidButton>
        )}

        {numReady === 1 && (
          <button
            onClick={() => setIsSideBarOpen(true)}
            style={{ boxShadow: '2px 3px 0px 0px #FFFFFF' }}
            className="flex items-center justify-center bg-black py-3 px-8 text-white border-[0.5px] border-white hover:bg-hoverForm"
          >
            <Identicon address={readyAccounts[0].addresses[0].address} size={26} />
            <div className="flex flex-col mx-3 items-start">
              <div className="text-white text-sm leading-6 font-bold ">
                {readyAccounts[0].addresses
                  ? shortenAddress(readyAccounts[0].addresses[0].address, true)
                  : 'Unknown'}
              </div>
            </div>
          </button>
        )}

        {numReady > 1 && (
          <button
            onClick={() => setIsSideBarOpen(true)}
            className="px-2.5 py-1 flex items-center justify-center shadow-[2px_3px_0px_0px_#FFFFFF] border-2 border-solid border-white bg-black hover:bg-hoverForm transition-all duration-500"
          >
            <div
              style={{ height: 26, width: 26 }}
              className="bg-[#FFC901] text-black text-sm font-bold leading-6 flex items-center justify-center rounded-full"
            >
              {numReady}
            </div>
            <div className="flex flex-col mx-3 items-start font-plex">
              <div className="text-xs leading-6 text-white">WALLETS</div>
              <div className="text-sm font-bold leading-6 text-white">{`${numReady} CONNECTED`}</div>
            </div>
          </button>
        )} */}
      </div>

      <WalletEnvSelectionModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
        isSideBarOpen={isSideBarOpen}
        setIsSideBarOpen={setIsSideBarOpen}
      />

      <SideBarMenu
        onClose={() => setIsSideBarOpen(false)}
        isOpen={isSideBarOpen}
        onConnectWallet={() => setShowEnvSelectModal(true)}
      />
    </div>
  );
}
