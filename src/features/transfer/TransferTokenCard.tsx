import { useState } from 'react';

import { Card } from '../../components/layout/Card';

import { TransferTokenForm } from './TransferTokenForm';
import { TransferTokenTab } from './TransferTokenTab';

export function TransferTokenCard() {
  const [activeTab, setActiveTab] = useState<string>('deposit');
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <Card className="w-100 relative">
      <>
        <div className="relative flex items-start justify-between z-20">
          <TransferTokenTab
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            transferType="deposit"
          />
          <TransferTokenTab
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            transferType="withdraw"
          />
        </div>
        <TransferTokenForm transferType={activeTab} />
      </>
    </Card>
  );
}
