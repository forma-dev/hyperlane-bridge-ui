import type { NextPage } from 'next';

import { MaintenanceCard } from '../components/tip/MaintenanceCard';
import { RelayCard } from '../components/tip/RelayCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  const maintenance = false;
  const relayEnabled = true;
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK === 'testnet';
  
  if (isTestnet) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-semibold mb-4 text-white">
          Testnet Bridge
        </h2>
        <p className="text-lg mb-6 text-gray-300">
          Need testnet tokens? Contact us on Discord for assistance.
        </p>
        <a 
          href="https://discord.gg/P6tEY8d7De"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          Join Discord
        </a>
      </div>
    );
  }
  
  return (
    <div className="pt-5 space-y-3">
      {maintenance ? (
        <MaintenanceCard />
      ) : (
        <>
          {relayEnabled && <RelayCard />}
          <TransferTokenCard />
        </>
      )}
    </div>
  );
};

export default Home;
