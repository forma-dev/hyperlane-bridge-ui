import type { NextPage } from 'next';

import { MaintenanceCard } from '../components/tip/MaintenanceCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  const maintenance = false;
  return (
    <div className="pt-5 space-y-3">
      {maintenance ? (
        <MaintenanceCard />
      ) : (
          <TransferTokenCard />
      )}
    </div>
  );
};

export default Home;
