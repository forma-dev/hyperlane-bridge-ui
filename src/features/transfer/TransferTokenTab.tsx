interface TabProps {
  activeTab: string;
  handleTabChange: (tab: string) => void;
  transferType: string;
}

export function TransferTokenTab({ activeTab, handleTabChange, transferType }: TabProps) {
  const formattedTransferType =
    transferType.charAt(0).toUpperCase() + transferType.slice(1).toLowerCase();
  // Define classes based on the condition
  const textClasses = activeTab === transferType ? 'text-primary' : 'text-secondary';

  return (
    <button onClick={() => handleTabChange(transferType)} className="w-1/2">
      <div
        className={`hover:text-white py-7 px-20 gap-2 flex justify-center ${textClasses}`}
        style={{ borderBottom: activeTab === transferType ? '4px solid #FFFFFF' : 'none' }}
        onClick={() => handleTabChange(transferType)}
      >
        {formattedTransferType}
      </div>
    </button>
  );
};
