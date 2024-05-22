import Image from 'next/image';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';


export function Banner() {
  return (
      <div className="bg-[#D9D9D9] py-2 flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-center">
        <div className="flex items-center">
          <a
            href="https://forma-devnet-modularspring.onrender.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <p className="text-black font-semibold text-l flex gap-2 hover:underline">
                [Modularium] is live <Image className="ml-2 brightness-0" src={ArrowRightIcon} width={24} height={24} alt="" />
            </p>
          </a>
        </div>
      </div>
  );
}

// const styles = {
//   linkCol: 'flex flex-col gap-1.5',
//   linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
// };
