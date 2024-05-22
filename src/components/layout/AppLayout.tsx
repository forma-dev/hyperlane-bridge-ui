import Head from 'next/head';
import { PropsWithChildren, useState } from 'react';

import { APP_NAME } from '../../consts/app';
import { Color } from '../../styles/Color';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';
import { Banner } from '../nav/Banner';

export function AppLayout({ children }: PropsWithChildren) {
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  const handleClick = () => {
    if (isSideBarOpen) {
      setIsSideBarOpen(false);
    }
  };

  return (
    <>
      <Head>
        {/* https://nextjs.org/docs/messages/no-document-viewport-meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{APP_NAME}</title>
      </Head>
      <div
        style={{ backgroundColor: Color.background }}
        id="app-content"
        className="h-full min-h-screen w-full min-w-screen font-plex"
      >
        <Banner/>
        <div className="max-w-screen-xl mx-auto flex flex-col justify-between min-h-screen px-4">
          
          <Header isSideBarOpen={isSideBarOpen} setIsSideBarOpen={setIsSideBarOpen} />
          <main
            className={`w-full flex-1 pb-36 pt-20 flex items-center justify-center ${
              isSideBarOpen ? 'opacity-50' : ''
            }`}
            onClick={handleClick}
          >
            {children}
          </main>
          <Footer isSideBarOpen={isSideBarOpen} setIsSideBarOpen={setIsSideBarOpen} />
        </div>
      </div>
    </>
  );
}
