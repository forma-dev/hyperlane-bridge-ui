import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../utils/logger';
import { useRelayContext } from '../wallet/context/RelayContext';
import { getNativeCurrency, getRelayChainId, RelayQuoteResponse } from './relayApi';

interface UseRelayQuoteParams {
  originChain: string;
  destinationChain: string;
  amount: string;
  transferType: string;
  relayChains: any[]; // Array of relay chain objects with full metadata
  user?: string;
  recipient?: string;
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
  transferType: _transferType,
  relayChains,
  user,
  recipient,
}: UseRelayQuoteParams): UseRelayQuoteResult {
  const [estimatedOutput, setEstimatedOutput] = useState<EstimatedOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getQuote, isReady } = useRelayContext();
  
  const getRelayQuoteData = useCallback(async () => {
    if (!isReady || !originChain || !destinationChain || !amount || parseFloat(amount) === 0 || !user || !recipient) {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    // Check if this is a Relay-supported transfer (either deposit or withdrawal)
    const isDeposit = destinationChain === 'forma' || destinationChain === 'sketchpad'; // TO Forma
    const isWithdrawal = originChain === 'forma' || originChain === 'sketchpad'; // FROM Forma
    
    // Only get quotes for Relay transfers involving Forma
    if (!isDeposit && !isWithdrawal) {
      setEstimatedOutput(null);
      setError(null);
      return;
    }

    // For deposits: Check if origin chain is supported by Relay
    if (isDeposit) {
      const relayChain = relayChains.find(chain => {
        const internalName = mapRelayChainToInternalName(chain.name);
        return internalName === originChain.toLowerCase() && chain.depositEnabled && !chain.disabled;
      });

      if (!relayChain) {
        setEstimatedOutput(null);
        setError(null);
        return;
      }
    }

    // For withdrawals: Check if destination chain is supported by Relay  
    if (isWithdrawal) {
      const relayChain = relayChains.find(chain => {
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
    const isFormaInvolved = originChain === 'forma' || originChain === 'sketchpad' || 
                           destinationChain === 'forma' || destinationChain === 'sketchpad';
    
    if (isFormaInvolved) {
      // Check supported chains
      try {
        const { getRelaySupportedChains } = await import('./relayApi');
        const supportedChains = await getRelaySupportedChains();
        const formaSupported = supportedChains.find(chain => 
          chain.chainId === 984122 || chain.name?.toLowerCase().includes('forma')
        );
        
        if (!formaSupported) {
          setError('Forma chain is not yet supported by Relay API');
          setIsLoading(false);
          return;
        }
      } catch (error) {
        logger.error('Failed to check supported chains:', error);
      }
    }
    
    // For now, try mainnet first to test currency format
    // If either chain requires testnet, use testnet for both  
    const needsTestnet = false; // Temporarily force mainnet to test currency format
    // const needsTestnet = destinationChainIds.mainnet === null || originChainIds.mainnet === null ||
    //                     destinationChainIds.testnet === 984123 || originChainIds.testnet === 984123; // Check for sketchpad testnet
    
    const originChainId = needsTestnet ? originChainIds.testnet : originChainIds.mainnet;
    const destinationChainId = needsTestnet ? destinationChainIds.testnet : destinationChainIds.mainnet;
    
    if (!originChainId || !destinationChainId) {
      setError('Unsupported chain for Relay');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get native currency for the origin and destination chains
      const originCurrency = getNativeCurrency(originChain);
      const destinationCurrency = getNativeCurrency(destinationChain);
      
      // CRITICAL: Both ETH and TIA tokens use 18 decimals for Relay API
      // TIA token on Forma has 18 decimals (same as ETH)
      const decimals = 18;
      const amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();

      // Use SDK getQuote method with correct parameters
      const quote = await getQuote({
        chainId: originChainId,
        currency: originCurrency,
        toChainId: destinationChainId,
        toCurrency: destinationCurrency,
        tradeType: 'EXACT_INPUT',
        user,
        amount: amountWei,
        recipient,
      });



      // Parse the quote response to extract the estimated output
      const outputAmount = quote.details.currencyOut.amount;
      const outputDecimals = quote.details.currencyOut.currency.decimals;
      
      // Convert from wei to human readable
      const formattedOutput = (parseFloat(outputAmount) / Math.pow(10, outputDecimals)).toFixed(4);
      
      // Calculate USD value (assuming TIA price of ~$8.50 for now)
      const usdValue = (parseFloat(formattedOutput) * 8.5).toFixed(2);

      setEstimatedOutput({
        formatted: formattedOutput,
        usd: usdValue,
        raw: outputAmount,
        quote,
      });
    } catch (err) {
      logger.error('Failed to get Relay quote:', err);
      if (err instanceof Error && err.message.includes('404')) {
        setError('Route not supported by Relay');
      } else if (err instanceof Error && err.message.includes('chain')) {
        setError('Chain not supported by Relay');
      } else {
        setError('Failed to get conversion rate from Relay');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isReady, originChain, destinationChain, amount, relayChains, user, recipient, getQuote]);

  useEffect(() => {
    getRelayQuoteData();
  }, [getRelayQuoteData]);

  return {
    estimatedOutput,
    isLoading, 
    error,
  };
}

// Helper function to map Relay chain names (duplicated here for now)
function mapRelayChainToInternalName(relayChainName: string): string {
  const nameMapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'polygon': 'polygon', 
    'arbitrum-one': 'arbitrum',
    'arbitrum': 'arbitrum', 
    'optimism': 'optimism',
    'base': 'base',
    'binance-smart-chain': 'bsc',
    'bsc': 'bsc',
    'avalanche': 'avalanche',
  };
  
  return nameMapping[relayChainName.toLowerCase()] || relayChainName.toLowerCase();
} 