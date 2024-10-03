import type { NextPage } from 'next';

import { RelayCard } from '../components/tip/RelayCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="pt-5 space-y-3">
      <RelayCard />
      <TransferTokenCard />
    </div>
  );
};

export default Home;
