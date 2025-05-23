interface Props {
  isSideBarOpen?: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
}

export function Footer({ isSideBarOpen = false, setIsSideBarOpen }: Props) {
  return (
    <footer
      className={`w-full border-t-[0.5px] border-[#8C8D8F] py-4 ${
        isSideBarOpen ? 'opacity-25' : ''
      }`}
      onClick={() => setIsSideBarOpen(false)}
    >
      <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-center">
        <div className="flex items-center">
          <p className="text-black text-sm">
            Built with Hyperlane and Stride. © Cocode Labs 2024 ✨
          </p>
        </div>
      </div>
    </footer>
  );
}

// const styles = {
//   linkCol: 'flex flex-col gap-1.5',
//   linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
// };
