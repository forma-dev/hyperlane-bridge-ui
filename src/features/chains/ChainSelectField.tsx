import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { ChainSelectListModal } from './ChainSelectModal';
import { getChainDisplayName } from './utils';

type Props = {
  name: string;
  label: string;
  chains: ChainName[];
  onChange?: (id: ChainName) => void;
  disabled?: boolean;
  transferType: string;
};

export function ChainSelectField({ name, label, chains, onChange, disabled, transferType }: Props) {
  const [field, , helpers] = useField<ChainName>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();

  const handleChange = (newChainId: ChainName) => {
    helpers.setValue(newChainId);
    // Reset other fields on chain change
    setFieldValue('recipient', '');
    setFieldValue('amount', '');
    setFieldValue('tokenIndex', undefined);
    if (onChange) onChange(newChainId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const onClick = () => {
    if (!disabled && !isLocked) setIsModalOpen(true);
  };

  useEffect(() => {
    if (
      (transferType == 'withdraw' && label == 'From') ||
      (transferType == 'deposit' && label == 'To')
    ) {
      handleChange('sketchpad');
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }

    if (transferType == 'withdraw' && label == 'To') {
      handleChange('stride');
    }

    if (transferType == 'deposit' && label == 'From') {
      handleChange('celestia');
    }
  }, [transferType, label]);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex justify-between pr-1">
        <label htmlFor={name} className="block text-sm text-secondary leading-5 font-medium">
          {label}
        </label>
      </div>
      <button
        type="button"
        name={field.name}
        className={`mt-1.5 w-full border-[1.5px] border-solid border-[#FFFFFF66] h-[48px] shadow-dropdown ${
          disabled || isLocked ? styles.disabled : styles.enabled
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center">
            <ChainLogo chainName={field.value} size={32} />
            <span className="text-white font-medium text-base leading-5 ml-2">
              {getChainDisplayName(field.value, true)}
            </span>
          </div>
          <div>
            {!disabled && !isLocked && (
              <Image
                src={ChevronIcon}
                className="text-secondary"
                width={12}
                height={6}
                alt=""
                style={{ filter: 'invert(1)' }}
              />
            )}
          </div>
        </div>
      </button>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        chains={chains}
        onSelect={handleChange}
      />
    </div>
  );
}

const styles = {
  base: 'w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:border-white hover:shadow-white bg-black',
  disabled: 'cursor-default bg-form',
};
