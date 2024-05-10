import type { NextPage } from 'next';

import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="pt-5 space-y-3">
      <TransferTokenCard />
    </div>
  );
};

export default Home;
