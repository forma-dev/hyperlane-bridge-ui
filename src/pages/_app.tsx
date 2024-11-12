import type { AppProps } from 'next/app';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import '@hyperlane-xyz/widgets/styles.css';

import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { CosmosWalletContext } from '../features/wallet/context/CosmosWalletContext';
import { EvmWalletContext } from '../features/wallet/context/EvmWalletContext';
import { SolanaWalletContext } from '../features/wallet/context/SolanaWalletContext';
import '../styles/fonts.css';
import '../styles/globals.css';
import { useIsSsr } from '../utils/ssr';

export default function App({ Component, pageProps }: AppProps) {
  // Disable app SSR for now as it's not needed and
  // complicates graphql integration
  const isSsr = useIsSsr();
  if (isSsr) {
    return <div></div>;
  }

  return (
    <ErrorBoundary>
      <EvmWalletContext>
        <SolanaWalletContext>
          <CosmosWalletContext>
            <AppLayout>
              <Component {...pageProps} />
            </AppLayout>
            <ToastContainer transition={Zoom} position={toast.POSITION.BOTTOM_RIGHT} limit={2} />
          </CosmosWalletContext>
        </SolanaWalletContext>
      </EvmWalletContext>
    </ErrorBoundary>
  );
}
