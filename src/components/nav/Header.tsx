import Image from 'next/image';
import Link from 'next/link';

import { WalletControlBar } from '../../features/wallet/WalletControlBar';
import Logo from '../../images/logos/Forma-Logo.svg';
import Name from '../../images/logos/nft4me.png';

interface Props {
  isSideBarOpen?: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
}

export function Header({ isSideBarOpen = false, setIsSideBarOpen }: Props) {
  const handleHeaderClick = (e) => {
    const clickX = e.clientX;
    // Calculate the width in pixels (22 rem)
    const headerElement = e.currentTarget;
    const sideBarWidth = 352; // You need to set your actual sidebar width
    const headerWidth = headerElement.offsetWidth - sideBarWidth;

    if (clickX >= 0 && clickX <= headerWidth && isSideBarOpen) {
      setIsSideBarOpen(false);
    }
  };
  return (
    <header
      className={`pt-3 pb-2 w-full border-b-4 ${
        isSideBarOpen ? 'border-white/[.5]' : 'border-white'
      } h-[96px]`}
      onClick={handleHeaderClick}
    >
      <div className="flex justify-between items-center">
        <Link href="/" className={`py-2 flex items-center ${isSideBarOpen ? 'opacity-50' : ''} `}>
          <Image src={Logo} width={40} height={40} alt="Forma Bridge Logo" />
          <Image src={Name} className="ml-[12px]" width={112} height={24} alt="Forma Bridge" />
          {/* <Image src={Name} width={110} alt="" className="hidden sm:block mt-0.5 ml-2" />
          <Image src={Title} width={185} alt="" className="mt-0.5 ml-2 pb-px" /> */}
        </Link>
        <div className="flex flex-col items-end md:flex-row-reverse md:items-start gap-2">
          <WalletControlBar isSideBarOpen={isSideBarOpen} setIsSideBarOpen={setIsSideBarOpen} />
        </div>
      </div>
    </header>
  );
}
