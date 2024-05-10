import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { IToken } from '@hyperlane-xyz/sdk';

import { TokenIcon } from '../../components/icons/TokenIcon';
import { getIndexForToken, getTokenByIndex, getWarpCore } from '../../context/context';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { TokenListModal } from './TokenListModal';

type Props = {
  name: string;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

export function TokenSelectField({ name, disabled, setIsNft }: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<number | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);

  const { origin, destination } = values;
  useEffect(() => {
    const tokensWithRoute = getWarpCore().getTokensForRoute(origin, destination);
    let newFieldValue: number | undefined;
    let newIsAutomatic: boolean;
    // No tokens available for this route
    if (tokensWithRoute.length === 0) {
      newFieldValue = undefined;
      newIsAutomatic = true;
    }
    // Exactly one found
    else if (tokensWithRoute.length === 1) {
      newFieldValue = getIndexForToken(tokensWithRoute[0]);
      newIsAutomatic = true;
      // Multiple possibilities
    } else {
      newFieldValue = undefined;
      newIsAutomatic = false;
    }
    helpers.setValue(newFieldValue);
    setIsAutomaticSelection(newIsAutomatic);
  }, [origin, destination, helpers]);

  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(newToken));
    // Update nft state in parent
    setIsNft(newToken.isNft());
  };

  const onClickField = () => {
    if (!disabled && !isAutomaticSelection) setIsModalOpen(true);
  };

  return (
    <>
      <TokenButton
        token={getTokenByIndex(field.value)}
        disabled={isAutomaticSelection || disabled}
        onClick={onClickField}
        isAutomatic={isAutomaticSelection}
      />
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        origin={values.origin}
        destination={values.destination}
      />
    </>
  );
}

function TokenButton({
  token,
  disabled,
  onClick,
  isAutomatic,
}: {
  token?: IToken;
  disabled?: boolean;
  onClick?: () => void;
  isAutomatic?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={onClick}
      style={{
        borderLeft: '2px solid #6E6E6E',
        borderRadius: 'none',
      }}
    >
      <div className="flex items-center">
        {token ? (
          <>
            <TokenIcon token={token} size={24} />
            <span className={`text-primary ml-2 text-xl font-medium leading-5 ${!token?.symbol}`}>
              {token?.symbol || ''}
            </span>
          </>
        ) : (
          <span className={`text-secondary text-xl font-medium leading-5`}>Select</span>
        )}
      </div>
      {!isAutomatic && (
        <Image
          src={ChevronIcon}
          className="ml-2 texr-secondary"
          width={12}
          height={8}
          alt=""
          style={{ filter: 'invert(1)' }}
        />
      )}
    </button>
  );
}

const styles = {
  base: 'text-secondary px-3.5 py-2 flex items-center justify-center outline-none transition-colors duration-500 absolute right-0.5 top-2 bottom-0.5 px-2',
  enabled: 'bg-black',
  disabled: 'cursor-default pointer-events-none',
};
