import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { mapRelayChainToInternalName } from './relayUtils';

import { getChainDisplayName } from './utils';

export function ChainSelectListModal({
  isOpen,
  close,
  chains,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  chains: ChainName[];
  onSelect: (chain: ChainName) => void;
}) {
  const { relayChains } = useRelaySupportedChains();

  // Helper function to determine if a chain is a Relay chain
  const isRelayChain = (chainName: string): boolean => {
    if (!chainName || !relayChains?.length) return false;
    
    return relayChains.some(chain => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName && internalName === chainName.toLowerCase() && chain.depositEnabled && !chain.disabled;
    });
  };

  // Separate chains by protocol
  const hyperlaneChains = chains.filter(chain => !isRelayChain(chain));
  const relayChainsList = chains.filter(chain => isRelayChain(chain));

  const onSelectChain = (chain: ChainName) => {
    return () => {
      onSelect(chain);
      close();
    };
  };

  const renderChainItem = (chain: ChainName, protocol: 'hyperlane' | 'relay') => (
    <button
      key={chain}
      className="pb-2 px-6 text-sm flex items-center"
      onClick={onSelectChain(chain)}
    >
      <div className="px-2 py-2 flex items-center justify-between w-full hover:bg-bg-button-main-disabled">
        <div className="flex items-center">
          <ChainLogo chainName={chain} size={32} background={false} />
          <span className="ml-2 font-medium text-sm leading-5 text-black">
            {getChainDisplayName(chain, false)}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            protocol === 'relay'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {protocol === 'relay' ? 'Relay' : 'Hyperlane'}
        </span>
      </div>
    </button>
  );

  return (
    <Modal width={'max-w-[450px]'} isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-4 flex flex-col space-y-1">
        {/* Hyperlane Chains Section */}
        {hyperlaneChains.length > 0 && (
          <>
            <div className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Hyperlane Networks
            </div>
            {hyperlaneChains.map((chain) => renderChainItem(chain, 'hyperlane'))}
          </>
        )}

        {/* Relay Chains Section */}
        {relayChainsList.length > 0 && (
          <>
            {hyperlaneChains.length > 0 && <div className="border-t border-gray-200 my-2" />}
            <div className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Relay Networks
            </div>
            {relayChainsList.map((chain) => renderChainItem(chain, 'relay'))}
          </>
        )}

        {/* No separation needed if only one type */}
        {(hyperlaneChains.length === 0 || relayChainsList.length === 0) && 
         chains.length > 0 && 
         (hyperlaneChains.length === 0 && relayChainsList.length === 0) && (
          <>
            {chains.map((chain) => 
              renderChainItem(chain, isRelayChain(chain) ? 'relay' : 'hyperlane')
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
