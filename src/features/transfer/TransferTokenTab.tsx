interface TabProps {
  activeTab: string;
  handleTabChange: (tab: string) => void;
  transferType: string;
}

export function TransferTokenTab({ activeTab, handleTabChange, transferType }: TabProps) {
  const formattedTransferType = transferType.toUpperCase();
  // Define classes based on the condition
  const textClasses = activeTab === transferType ? 'text-black' : 'text-secondary';

  return (
    <div className="relative w-1/2">
      {/* Base bottom border */}
      <div className="absolute bottom-0 left-0 right-0 border-b-[0.5px] border-[#8C8D8F]" />
      
      {/* Active tab indicator */}
      {activeTab === transferType && (
        <div className="absolute bottom-0 left-0 right-0 border-b-[4px] border-black z-10" />
      )}
      
      {/* Tab content */}
      <button 
        onClick={() => handleTabChange(transferType)} 
        className="w-full"
      >
        <div
          className={`relative py-7 px-20 gap-2 flex justify-center font-semibold hover:text-black ${textClasses}`}
        >
          {formattedTransferType}
        </div>
      </button>
    </div>
  );
}
