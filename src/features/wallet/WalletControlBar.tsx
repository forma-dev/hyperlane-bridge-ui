import { useState } from 'react';

// import { shortenAddress } from '@hyperlane-xyz/utils';
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
  const color = 'navBarButton';

  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="relative">
      <div className="relative">
        <button className="burger rounded" onClick={() => setIsSideBarOpen(true)}></button>

        {/* Removed Connect Wallet button */}
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
