import Image from 'next/image';

import ArrowRight from '../../images/icons/arrow-right.svg';
import { Card } from '../layout/Card';

export function RelayCard() {
  return (
    <Card className="w-100 !bg-[#EBEBEB] !border-[#8C8D8F] py-3 px-3">
      <div className="flex items-center justify-between">
        <p
          className="text-black text-sm max-w-[60%]"
          style={{ fontWeight: 'var(--font-weight-medium)' }}
        >
          Bridging from Ethereum, Base, or another EVM chain?
        </p>
        <a
          href="https://relay.link/forma"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black font-bold w-4/12 border-[0.5px] border-black border-solid bg-white p-2 h-[48px] flex items-center justify-center hover:bg-bg-button-main-disabled cursor-pointer rounded-card"
        >
          <span className="mr-1.5 text-[14px]">USE RELAY</span>
          <Image src={ArrowRight} width={16} alt="" />
        </a>
      </div>
    </Card>
  );
}
