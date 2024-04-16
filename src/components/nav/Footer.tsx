interface Props {
  isSideBarOpen?: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
}

export function Footer({ isSideBarOpen = false, setIsSideBarOpen }: Props) {
  return (
    <footer
      className={`py-8 px-16 h-[96px] ${isSideBarOpen ? 'opacity-50' : ''}`}
      style={{ borderTop: '4px solid #FFFFFF' }}
      onClick={() => setIsSideBarOpen(false)}
    >
      <div className="flex flex-row justify-center items-center">
        <div className="flex items-center">
          <div className="hidden sm:flex flex-col">
            <p className="leading-6  font-bold text-white text-sm">
              Copyright &copy; Cocoding Labs 2024. All rights reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// const styles = {
//   linkCol: 'flex flex-col gap-1.5',
//   linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
// };
