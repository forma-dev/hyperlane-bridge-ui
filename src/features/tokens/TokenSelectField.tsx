import { useField, useFormikContext } from 'formik';
import { useEffect, useState } from 'react';

import { IToken } from '@hyperlane-xyz/sdk';

import { ChevronIcon } from '../../components/icons/ChevronIcon';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { getIndexForToken, getTokenByIndex, getWarpCore } from '../../context/context';
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
        isReview={disabled}
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
  isReview,
}: {
  token?: IToken;
  disabled?: boolean;
  onClick?: () => void;
  isAutomatic?: boolean;
  isReview?: boolean;
}) {
  const getStyleClass = () => {
    if (isReview) return styles.disabled;
    if (isAutomatic) return styles.locked;
    return styles.enabled;
  };

  return (
    <button
      type="button"
      className={`${styles.base} ${getStyleClass()}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center">
        {token ? (
          <>
            <TokenIcon token={token} size={28} />
            <div className="flex flex-col items-start ml-2">
              <span className="font-bold text-base leading-5 text-black">{token.symbol}</span>
            </div>
          </>
        ) : (
          <span className={`text-secondary text-xl font-medium leading-5`}>Select</span>
        )}
      </div>

      {!isAutomatic && <ChevronIcon className="w-4 h-4 text-arrow" />}
    </button>
  );
}

const styles = {
  base: 'h-full text-secondary px-3 py-2 flex items-center justify-between outline-none',
  enabled: 'bg-transparent',
  locked: 'cursor-default pointer-events-none bg-transparent',
  disabled: 'cursor-not-allowed bg-[#B5B5B5]',
};
