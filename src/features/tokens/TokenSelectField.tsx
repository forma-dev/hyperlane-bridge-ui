import { useField, useFormikContext } from 'formik';
import { useEffect, useState } from 'react';

import { IToken } from '@hyperlane-xyz/sdk';

import { ChevronIcon } from '../../components/icons/ChevronIcon';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { getIndexForToken, getTokenByIndex, getWarpCore } from '../../context/context';
import { getRelayNativeTokenInfo } from '../chains/relayUtils';
// Import centralized Relay utilities
import { mapRelayChainToInternalName as relayMapChainName } from '../chains/relayUtils';
import { TransferFormValues } from '../transfer/types';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';

import { TokenListModal } from './TokenListModal';

type Props = {
  name: string;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName) return false;

  // Check against the dynamic Relay chains list if available
  if (relayChains?.length) {
    return relayChains.some((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      console.log('Checking Relay chain:', {
        chainName,
        relayChainName: chain.name,
        internalName,
        matches: internalName === chainName.toLowerCase()
      });
      return (
        internalName &&
        internalName === chainName.toLowerCase()
        // Removed depositEnabled and disabled checks as they might be preventing detection
      );
    });
  }

  return false;
}

// Helper function to map Relay chain names to internal names
function mapRelayChainToInternalName(relayChainName: string): string | null {
  const result = relayMapChainName(relayChainName);
  return result || null;
}

// Get native token info for Relay chains
function getNativeTokenInfo(chainName: string) {
  return getRelayNativeTokenInfo(chainName);
}

export function TokenSelectField({ name, disabled, setIsNft }: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<number | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);
  const { relayChains } = useRelaySupportedChains();

  const { origin, destination } = values;

  useEffect(() => {
    // Check if origin is a Relay chain
    const isOriginRelay = isRelayChain(origin, relayChains);
    
    console.log('TokenSelectField useEffect:', {
      origin,
      relayChainsCount: relayChains?.length,
      isOriginRelay,
      relayChains: relayChains?.map(c => c.name)
    });

    if (isOriginRelay) {
      // For Relay chains, allow manual token selection
      // We'll use a special token index of -1 to indicate Relay native token as default
      helpers.setValue(-1);
      setIsAutomaticSelection(false); // Allow manual selection
      setIsNft(false); // Native tokens are never NFTs
      console.log('Set Relay chain token selection to manual');
    } else if (origin === 'forma' || origin === 'sketchpad') {
      // Special case: Forma/Sketchpad withdrawals to ANY destination
      // We need to find the Forma TIA token in the Hyperlane token list
      const warpCore = getWarpCore();
      const tokens = warpCore.tokens;

      // For Forma withdrawals, we need to find the EVM TIA token, not the Cosmos one
      // Try multiple strategies to find the correct TIA token
      let formaToken = tokens.find(
        (token) =>
          token.chainName === origin && token.symbol === 'TIA' && token.protocol === 'ethereum', // Prioritize EVM protocol for Forma
      );

      if (!formaToken) {
        // Fallback 1: Look for any EVM token with TIA in name
        formaToken = tokens.find(
          (token) =>
            token.chainName === origin &&
            token.name?.toLowerCase().includes('tia') &&
            token.protocol === 'ethereum',
        );
      }

      if (!formaToken) {
        // Fallback 2: Look for any TIA token (any protocol)
        formaToken = tokens.find((token) => token.chainName === origin && token.symbol === 'TIA');
      }

      if (!formaToken) {
        // Fallback 3: Look for any token on Forma
        formaToken = tokens.find((token) => token.chainName === origin);
      }

      if (formaToken) {
        helpers.setValue(getIndexForToken(formaToken));
        setIsAutomaticSelection(true);
        setIsNft(false);
      } else {
        helpers.setValue(undefined);
        setIsAutomaticSelection(true);
      }
    } else {
      // For pure Hyperlane chains, use the existing logic
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
      }
      // Multiple possibilities
      else {
        newFieldValue = undefined;
        newIsAutomatic = false;
      }

      helpers.setValue(newFieldValue);
      setIsAutomaticSelection(newIsAutomatic);
    }
  }, [origin, destination, helpers, relayChains, setIsNft]);

  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(newToken));
    // Update nft state in parent
    setIsNft(newToken.isNft());
  };

  const onClickField = () => {
    console.log('TokenSelectField onClickField:', {
      disabled,
      isAutomaticSelection,
      origin,
      isRelayChain: isRelayChain(origin, relayChains),
      willOpenModal: !disabled && !isAutomaticSelection
    });
    if (!disabled && !isAutomaticSelection) {
      console.log('Opening token selection modal for Relay chain');
      setIsModalOpen(true);
    } else {
      console.log('Modal not opened because:', {
        disabled,
        isAutomaticSelection
      });
    }
  };

  // Get the token to display
  const displayToken = field.value === -1 ? null : getTokenByIndex(field.value);
  const nativeTokenInfo = field.value === -1 ? getNativeTokenInfo(origin) : null;

  return (
    <>
      <TokenButton
        token={displayToken}
        nativeTokenInfo={nativeTokenInfo}
        _chainName={origin}
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
  nativeTokenInfo,
  _chainName,
  disabled,
  onClick,
  isAutomatic,
  isReview,
}: {
  token?: IToken | null;
  nativeTokenInfo?: { symbol: string; decimals: number; name: string } | null;
  _chainName?: string;
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

  // Custom token icon for Relay native tokens
  const renderNativeTokenIcon = (tokenInfo: { symbol: string; decimals: number; name: string }) => {
    // Create a simple token icon based on the symbol
    const getTokenColor = (symbol: string) => {
      const colors: Record<string, string> = {
        ETH: '#627EEA',
        ARB: '#28A0F0',
        OP: '#FF0420',
      };
      return colors[symbol] || '#6B7280';
    };

    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: getTokenColor(tokenInfo.symbol) }}
      >
        {tokenInfo.symbol.slice(0, 3)}
      </div>
    );
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
        ) : nativeTokenInfo ? (
          <>
            {renderNativeTokenIcon(nativeTokenInfo)}
            <div className="flex flex-col items-start ml-2">
              <span className="font-bold text-base leading-5 text-black">
                {nativeTokenInfo.symbol}
              </span>
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
