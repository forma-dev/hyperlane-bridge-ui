interface Props {
  isSideBarOpen?: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
}

export function Footer({ isSideBarOpen = false, setIsSideBarOpen }: Props) {
  return (
    <footer
      className={`py-8 px-8 h-[96px] ${isSideBarOpen ? 'opacity-50' : ''}`}
      style={{ borderTop: '4px solid #FFFFFF' }}
      onClick={() => setIsSideBarOpen(false)}
    >
      <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-center">
        <div className="flex items-center">
          <p className="font-bold text-white text-sm">
            Built with Hyperlane. © Cocoding Labs 2024 ✨
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
