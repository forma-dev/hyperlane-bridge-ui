import Image from 'next/image';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';


export function Banner() {
  return (
    <a
      href="https://forma-devnet-modularspring.onrender.com/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="bg-[#D9D9D9] flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-center">
        <div className="flex items-center">
          <p className="text-black font-semibold text-xl flex gap-2">
              [Modularium] is live <Image className="ml-2 brightness-0" src={ArrowRightIcon} width={24} height={24} alt="" />
          </p>
        </div>
      </div>
    </a>
      
  );
}

// const styles = {
//   linkCol: 'flex flex-col gap-1.5',
//   linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
// };
