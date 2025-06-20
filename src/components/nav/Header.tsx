import Image from 'next/image';
import Link from 'next/link';

import { WalletControlBar } from '../../features/wallet/WalletControlBar';
import Logo from '../../images/logos/forma.png';

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
      className={`pt-3 pb-2 w-full border-b-[0.5px] ${
        isSideBarOpen ? 'border-[#8c8d8f]/[.5]' : 'border-[#8c8d8f]'
      } h-[96px]`}
      onClick={handleHeaderClick}
    >
      <div className="flex justify-between items-center">
        <Link href="/" className={`py-2 flex items-center ${isSideBarOpen ? 'opacity-50' : ''} `}>
          <Image src={Logo} height={40} alt="Forma Bridge" />
        </Link>
        <div className="flex flex-col items-end md:flex-row-reverse md:items-start gap-2">
          <WalletControlBar isSideBarOpen={isSideBarOpen} setIsSideBarOpen={setIsSideBarOpen} />
        </div>
      </div>
    </header>
  );
}
