import Image from 'next/image';

import ArrowRightIcon from '../../images/icons/arrow-right.svg';

const SHUTDOWN_URL = 'https://x.com/Formachain/status/2113385579555495982?s=20';

export function Banner() {
  return (
    <div className="bg-button py-2 px-4 flex items-center justify-center">
      <a href={SHUTDOWN_URL} target="_blank" rel="noopener noreferrer">
        <p className="text-black font-semibold text-l text-center flex items-center gap-2 hover:underline">
          Forma is shutting down. Please withdraw your funds as soon as possible. Read more
          <Image className="brightness-0" src={ArrowRightIcon} width={24} height={24} alt="" />
        </p>
      </a>
    </div>
  );
}
