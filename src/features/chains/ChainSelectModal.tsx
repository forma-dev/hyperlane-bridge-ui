import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';

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
  const onSelectChain = (chain: ChainName) => {
    return () => {
      onSelect(chain);
      close();
    };
  };

  return (
    <Modal width={'max-w-[405px]'} isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-4 flex flex-col space-y-1">
        {chains.map((c) => (
          <button
            key={c}
            className="pb-2 px-6  text-sm flex items-center"
            onClick={onSelectChain(c)}
          >
            <div className="px-2 py-2 flex items-center w-full hover:bg-hoverForm ">
              <ChainLogo chainName={c} size={32} background={false} />
              <span className="ml-2  font-medium text-sm leading-5">
                {getChainDisplayName(c, true)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
