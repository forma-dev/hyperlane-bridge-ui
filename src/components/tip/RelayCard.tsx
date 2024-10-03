import Image from 'next/image';

import ArrowRight from '../../images/icons/arrow-right.svg';
import { Card } from '../layout/Card';

export function RelayCard() {
  return (
    <Card className="w-100 !bg-[#1E1E1E] !border-[#8C8D8F] py-3 px-3">
      <div className="flex items-center justify-between">
        <p className="text-primary text-sm max-w-[60%]">Bridging from Ethereum, Base, or another EVM chain?</p>
        <a
          href="https://relay.link/forma"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black font-bold w-4/12 border-[0.5px] border-white border-solid bg-white p-2 h-[48px] flex items-center justify-center hover:bg-[#FFFFFFCC] cursor-pointer hover:border-white hover:border-[1px]"
        >
          <span className="mr-1.5">USE RELAY</span>
          <Image src={ArrowRight} width={16} alt="" />
        </a>
      </div>
    </Card>
  );
}
