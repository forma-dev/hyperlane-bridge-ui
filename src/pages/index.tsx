import type { NextPage } from 'next';

import { MaintenanceCard } from '../components/tip/MaintenanceCard';
import { RelayCard } from '../components/tip/RelayCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  const maintenance = false;
  const relayEnabled = true;
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
