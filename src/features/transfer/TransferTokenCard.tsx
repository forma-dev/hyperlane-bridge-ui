import { useState } from 'react';

import { Card } from '../../components/layout/Card';

import { TransferTokenForm } from './TransferTokenForm';
import { TransferTokenTab } from './TransferTokenTab';

export function TransferTokenCard() {
  const [activeTab, setActiveTab] = useState<string>('deposit');
  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsReview(false);
  };

  const withdrawalEnabled = false;

  return (
    <Card className="w-100 relative">
      <>
        <div className="relative flex items-start justify-between z-20">
          <TransferTokenTab
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            transferType="deposit"
          />
          {withdrawalEnabled && (
            <TransferTokenTab
              activeTab={activeTab}
              handleTabChange={handleTabChange}
              transferType="withdraw"
            />
          )}
        </div>
        <TransferTokenForm transferType={activeTab} isReview={isReview} setIsReview={setIsReview} />
      </>
    </Card>
  );
}
