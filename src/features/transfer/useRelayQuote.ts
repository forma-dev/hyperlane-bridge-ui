import { useCallback, useEffect, useRef, useState } from 'react';

import { mapRelayChainToInternalName } from '../chains/relayUtils';
import { useRelayContext } from '../wallet/context/RelayContext';

import { RelayQuoteResponse, getNativeCurrency, getRelayChainId } from './relaySdk';

interface UseRelayQuoteParams {
  originChain: string;
  destinationChain: string;
  amount: string;
  transferType: string;
  relayChains: any[]; // Array of relay chain objects with full metadata
  user?: string;
  recipient?: string;
  selectedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    chainId: number;
    currency?: string; // Optional for compatibility with Relay token objects
    contractAddress?: string; // Optional for compatibility with Relay token objects
  };
  wallet?: any; // Optional wallet client for quote
}

interface EstimatedOutput {
  formatted: string;
  usd: string;
  raw: string;
  quote?: RelayQuoteResponse;
}

interface UseRelayQuoteResult {
  estimatedOutput: EstimatedOutput | null;
  isLoading: boolean;
  error: string | null;
}

export function useRelayQuote({
  originChain,
  destinationChain,
  amount,
  transferType,
  relayChains,
  user,
  recipient,
  selectedToken,
  wallet,
}: UseRelayQuoteParams): UseRelayQuoteResult {
  const [estimatedOutput, setEstimatedOutput] = useState<EstimatedOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentRequestRef = useRef<string | null>(null);

  const { getQuote, isReady } = useRelayContext();

  const getRelayQuoteData = useCallback(async () => {
    // Simple check to prevent quote requests when amount is being cleared
    if (!amount || (typeof amount === 'string' && amount.trim() === '') || amount === '') {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    // Additional check to prevent processing if amount is 0 or invalid
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    if (
      !isReady ||
      !originChain ||
      !destinationChain ||
      !amount ||
      (typeof amount === 'string' && amount.trim() === '') ||
      (typeof amount === 'string' && parseFloat(amount) === 0) ||
      !user ||
      !recipient
    ) {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    // Check if this is a Relay-supported transfer based on the current transfer type
    let isRelayTransfer = false;

    if (transferType === 'deposit') {
      // For deposits: Check if destination is Forma and origin is a Relay chain
      const isToForma = destinationChain === 'forma' || destinationChain === 'sketchpad';
      const isFromRelay = relayChains.some((chain) => {
        const internalName = mapRelayChainToInternalName(chain.name);
        return internalName === originChain.toLowerCase();
      });
      isRelayTransfer = isToForma && isFromRelay;
    } else if (transferType === 'withdraw') {
      // For withdrawals: Check if origin is Forma and destination is a Relay chain
      const isFromForma = originChain === 'forma' || originChain === 'sketchpad';
      const isToRelay = relayChains.some((chain) => {
        const internalName = mapRelayChainToInternalName(chain.name);
        return internalName === destinationChain.toLowerCase();
      });
      isRelayTransfer = isFromForma && isToRelay;
    }

    // Only get quotes for Relay transfers

    if (!isRelayTransfer) {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    // Check if the specific transfer is supported by Relay
    if (transferType === 'deposit') {
      // For deposits: Check if origin chain is supported by Relay
      const relayChain = relayChains.find((chain) => {
        const internalName = mapRelayChainToInternalName(chain.name);
        return (
          internalName === originChain.toLowerCase() && chain.depositEnabled && !chain.disabled
        );
      });

      if (!relayChain) {
        setEstimatedOutput(null);
        setError(null);
        return;
      }
    } else if (transferType === 'withdraw') {
      // For withdrawals: Check if destination chain is supported by Relay
      const relayChain = relayChains.find((chain) => {
        const internalName = mapRelayChainToInternalName(chain.name);
        const matches = internalName === destinationChain.toLowerCase();
        const isEnabled = chain.depositEnabled && !chain.disabled;

        return matches && isEnabled;
      });

      if (!relayChain) {
        setEstimatedOutput(null);
        setError(null);
        return;
      }
    }

    // Get chain IDs for Relay API
    const originChainIds = getRelayChainId(originChain);
    const destinationChainIds = getRelayChainId(destinationChain);

    // For this bridge, Forma is always involved (either origin or destination)
    const isFormaInvolved =
      originChain === 'forma' ||
      originChain === 'sketchpad' ||
      destinationChain === 'forma' ||
      destinationChain === 'sketchpad';

    if (isFormaInvolved) {
      // Check supported chains
      try {
        const { getRelaySupportedChains } = await import('./relaySdk');
        const supportedChains = await getRelaySupportedChains();
        const formaSupported = supportedChains.find(
          (chain) => chain.chainId === 984122 || chain.name?.toLowerCase().includes('forma'),
        );

        if (!formaSupported) {
          setError('Forma chain is not yet supported by Relay API');
          setIsLoading(false);
          return;
        }
      } catch (error) {
        // logger.error('Failed to check supported chains:', error); // Removed logger
      }
    }

    // For now, try mainnet first to test currency format
    // If either chain requires testnet, use testnet for both
    const needsTestnet = false; // Temporarily force mainnet to test currency format
    // const needsTestnet = destinationChainIds.mainnet === null || originChainIds.mainnet === null ||
    //                     destinationChainIds.testnet === 984123 || originChainIds.testnet === 984123; // Check for sketchpad testnet

    const originChainId = needsTestnet ? originChainIds.testnet : originChainIds.mainnet;
    const destinationChainId = needsTestnet
      ? destinationChainIds.testnet
      : destinationChainIds.mainnet;

    if (!originChainId || !destinationChainId) {
      setError('Swap combination not supported');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create a unique request identifier
    const requestId = `${originChain}-${destinationChain}-${amount}-${user}-${recipient}`;

    // Prevent duplicate requests
    if (currentRequestRef.current === requestId) {
      return;
    }

    currentRequestRef.current = requestId;

    try {
      // Determine currencies based on transfer type
      let originCurrency, destinationCurrency;

      if (transferType === 'deposit') {
        // Deposit: Relay token -> Forma TIA
        originCurrency =
          selectedToken?.address ||
          selectedToken?.currency ||
          selectedToken?.contractAddress ||
          getNativeCurrency(originChain);

        // Only use zero address for actual native tokens (ETH), not ERC20 tokens
        if (
          selectedToken?.symbol === 'ETH' &&
          selectedToken?.address === '0x0000000000000000000000000000000000000000'
        ) {
          originCurrency = '0x0000000000000000000000000000000000000000';
        }

        // Destination is Forma/Sketchpad native TIA -> use zero address per Relay expectations
        destinationCurrency =
          destinationChain === 'forma' || destinationChain === 'sketchpad'
            ? '0x0000000000000000000000000000000000000000'
            : getNativeCurrency(destinationChain);
      } else {
        // Withdraw: Forma TIA -> Relay token
        // For withdrawals, we're sending TIA from Forma to get OP on Optimism
        originCurrency = '0x0000000000000000000000000000000000000000'; // TIA on Forma

        destinationCurrency =
          selectedToken?.address ||
          selectedToken?.currency ||
          selectedToken?.contractAddress ||
          getNativeCurrency(destinationChain);

        // Only use zero address for actual native tokens (ETH), not ERC20 tokens
        if (
          selectedToken?.symbol === 'ETH' &&
          selectedToken?.address === '0x0000000000000000000000000000000000000000'
        ) {
          destinationCurrency = '0x0000000000000000000000000000000000000000';
        }
      }

      // Calculate amount in wei
      let amountWei;
      if (transferType === 'deposit') {
        // For deposits: user specifies how much Relay token to send
        const decimals = selectedToken?.decimals || 18;
        amountWei = (
          parseFloat(typeof amount === 'string' ? amount : String(amount)) * Math.pow(10, decimals)
        ).toString();
      } else {
        // For withdrawals: user specifies how much TIA to send (not OP to receive)
        // The amount should be the TIA amount, not a calculated estimate
        const decimals = 18; // TIA has 18 decimals
        amountWei = (
          parseFloat(typeof amount === 'string' ? amount : String(amount)) * Math.pow(10, decimals)
        ).toString();
      }

      // Determine trade type - both deposits and withdrawals use EXACT_INPUT
      // For deposits: user specifies how much Relay token to send
      // For withdrawals: user specifies how much TIA to send
      const tradeType = 'EXACT_INPUT';

      // Use SDK getQuote method with correct parameters
      const quoteParams = {
        chainId: originChainId,
        currency: originCurrency,
        toChainId: destinationChainId,
        toCurrency: destinationCurrency,
        tradeType,
        user,
        amount: amountWei,
        recipient,
        includeDefaultParameters: true, // Include default user and recipient parameters
        ...(wallet && { wallet }), // Include wallet if provided
      };

      const quote = await getQuote(quoteParams);

      // Debug: Log the quote response

      // Parse the quote response to extract the estimated output
      const outputAmount = quote.details.currencyOut.amount;
      const outputDecimals = quote.details.currencyOut.currency.decimals;

      // Use the formatted amount from the API response instead of calculating it
      const formattedOutput =
        quote.details.currencyOut.amountFormatted ||
        (parseFloat(outputAmount) / Math.pow(10, outputDecimals)).toFixed(4);

      // Calculate USD value from the API response
      const usdValue =
        quote.details.currencyOut.amountUsd || (parseFloat(formattedOutput) * 8.5).toFixed(2);

      setEstimatedOutput({
        formatted: formattedOutput,
        usd: usdValue,
        raw: outputAmount,
        quote,
      });
    } catch (err) {
      // logger.error('Failed to get Relay quote:', err); // Removed logger
      if (err instanceof Error && err.message.includes('404')) {
        setError('Swap combination not supported');
      } else if (err instanceof Error && err.message.includes('chain')) {
        setError('Swap combination not supported');
      } else {
        setError('Swap combination not supported');
      }
    } finally {
      setIsLoading(false);
      currentRequestRef.current = null;
    }
  }, [
    isReady,
    originChain,
    destinationChain,
    amount,
    relayChains,
    user,
    recipient,
    getQuote,
    transferType,
    selectedToken,
    wallet,
  ]);

  useEffect(() => {
    // Add a small delay to prevent race conditions during rapid changes
    const timeoutId = setTimeout(() => {
      getRelayQuoteData();
    }, 100); // Increased from 50ms to 100ms for better handling of rapid changes

    return () => clearTimeout(timeoutId);
  }, [getRelayQuoteData, transferType]);

  return {
    estimatedOutput,
    isLoading,
    error,
  };
}
