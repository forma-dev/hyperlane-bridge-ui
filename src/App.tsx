import Logo from './forma.png';

export function App() {
  return (
    <div className="min-h-screen w-full font-sans bg-[var(--color-background)]">
      <div className="max-w-screen-xl mx-auto flex flex-col justify-between min-h-screen px-4">
        <header className="pt-3 pb-2 w-full h-[96px] border-b-[0.5px] border-[#8c8d8f]">
          <a href="/" className="py-2 flex items-center">
            <img src={Logo} className="h-10 w-auto" alt="Forma Bridge" />
          </a>
        </header>
        <main className="w-full flex-1 pb-36 pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center text-center max-w-lg">
            <h1 className="text-2xl font-semibold mb-4 text-black">Forma has shut down</h1>
            <p className="text-lg mb-6 text-black">
              All unbridged TIA on Forma has been airdropped to Eden. You can bridge your TIA from
              Eden to Celestia.
            </p>
            <a
              href="https://eden.zone/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-button hover:bg-button-hover text-black font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Go to Eden
            </a>
          </div>
        </main>
        <footer className="py-8 px-8 h-[96px] border-t-[0.5px] border-[#8C8D8F] flex items-center justify-center">
          <p className="text-black text-sm">© Cocode Labs 2026</p>
        </footer>
      </div>
    </div>
  );
}
