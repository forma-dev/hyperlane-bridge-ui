import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useBalance as useWagmiBalance } from 'wagmi';

import { IToken } from '@hyperlane-xyz/sdk';
import { isValidAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { getMultiProvider, getTokenByIndex, getTokens } from '../../context/context';
import { TransferFormValues } from '../transfer/types';
import { useRelaySupportedChains } from '../wallet/context/RelayContext';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

// Helper function to determine if a chain is a Relay chain
function isRelayChain(chainName: string, relayChains: any[]): boolean {
  if (!chainName) return false;
  
  // First check against known Relay chain names (hardcoded list)
  const knownRelayChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];
  const isKnownRelay = knownRelayChains.includes(chainName.toLowerCase());
  
  if (isKnownRelay) {
    return true;
  }
  
  // Also check against the dynamic Relay chains list if available
  if (relayChains?.length) {
    const dynamicMatch = relayChains.some(chain => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName && internalName === chainName.toLowerCase() && chain.depositEnabled && !chain.disabled;
    });
    
    return dynamicMatch;
  }
  
  return false;
}

// Helper function to map Relay chain names to internal names
function mapRelayChainToInternalName(relayChainName: string): string | null {
  const nameMapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'polygon': 'polygon', 
    'arbitrum-one': 'arbitrum',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'base': 'base',
    'binance-smart-chain': 'bsc',
    'bnb-smart-chain': 'bsc',
    'bsc': 'bsc',
    'avalanche': 'avalanche',
    'avalanche-c-chain': 'avalanche',
  };
  
  return nameMapping[relayChainName.toLowerCase()] || null;
}

// Get native token info for Relay chains
function getNativeTokenInfo(chainName: string) {
  const nativeTokens: Record<string, { symbol: string; decimals: number; name: string }> = {
    'ethereum': { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    'polygon': { symbol: 'MATIC', decimals: 18, name: 'Polygon' },
    'arbitrum': { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    'optimism': { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    'base': { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    'bsc': { symbol: 'BNB', decimals: 18, name: 'BNB' },
    'avalanche': { symbol: 'AVAX', decimals: 18, name: 'Avalanche' },
  };
  
  return nativeTokens[chainName.toLowerCase()];
}

// Get chain ID for supported Relay chains
function getChainIdForRelayChain(chainName: string): number | undefined {
  const chainIdMapping: Record<string, number> = {
    'ethereum': 1,
    'polygon': 137,
    'arbitrum': 42161,
    'optimism': 10,
    'base': 8453,
    'bsc': 56,
    'avalanche': 43114,
  };
  
  return chainIdMapping[chainName.toLowerCase()];
}

// Custom balance hook for Relay chains using wagmi
export function useRelayBalance(chain?: ChainName, address?: Address) {
  const chainId = chain ? getChainIdForRelayChain(chain) : undefined;
  
  // Get the correct token address for each chain
  const getTokenAddress = (chainName: string): `0x${string}` | undefined => {
    const tokenAddresses: Record<string, `0x${string}`> = {
      // Native tokens that are not gas tokens
      'optimism': '0x4200000000000000000000000000000000000042', // OP token
      'polygon': '0x0000000000000000000000000000000000001010', // MATIC token
      'arbitrum': '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB token  
      'base': '0xd07379a755A8f11B57610154861D694b2A0f615a', // BASE token (if it exists)
      // For these chains, use native ETH (undefined = native token)
      // 'ethereum': undefined, // ETH (native)
      // 'bsc': undefined, // BNB (native) 
      // 'avalanche': undefined, // AVAX (native)
    };
    
    return tokenAddresses[chainName.toLowerCase()];
  };
  
  const tokenAddress = chain ? getTokenAddress(chain) : undefined;
  
  // Use wagmi's useBalance hook for balance fetching
  const { data: wagmiBalance, isLoading, error, isError } = useWagmiBalance({
    address: address as `0x${string}`,
    chainId,
    token: tokenAddress, // Pass token address for branded tokens, undefined for native
    query: {
      enabled: !!chain && !!address && !!chainId,
      refetchInterval: 5000,
    },
  });

  useToastError(error, 'Error fetching Relay balance');

  // Create a simple balance object with just the method TokenBalance needs
  const balance = wagmiBalance ? {
    getDecimalFormattedAmount: () => {
      // Use the actual decimals from the token, not hardcoded values
      const decimals = wagmiBalance.decimals;
      const amount = Number(ethers.utils.formatUnits(wagmiBalance.value.toString(), decimals));
      
      return amount;
    },
  } : null;

  return {
    isLoading,
    isError,
    balance,
  };
}

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(getMultiProvider(), address);
    },
    refetchInterval: 5000,
  });

  useToastError(error, 'Error fetching balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance(values: TransferFormValues) {
  const { origin, destination, tokenIndex } = values;
  const address = useAccountAddressForChain(origin);
  const token = getTokenByIndex(tokenIndex);
  const { relayChains } = useRelaySupportedChains();
  
  console.log('🔍 BALANCE DEBUG:', {
    origin,
    destination,
    tokenIndex,
    address,
    hasToken: !!token,
    tokenSymbol: token?.symbol,
    tokenProtocol: token?.protocol,
    tokenAddress: token?.addressOrDenom,
    tokenChainName: token?.chainName
  });
  
  // Check if this is a Relay chain
  const isRelayOrigin = isRelayChain(origin, relayChains);
  
  // Check if this is a Relay transfer (either origin or destination is Relay)
  const isDestinationRelay = isRelayChain(destination, relayChains);
  const isRelayTransfer = isRelayOrigin || isDestinationRelay;
  
  // Special case: For Forma withdrawals to ANY destination (Relay chains OR Hyperlane chains like Stride),
  // we need to show the Forma TIA balance using the Hyperlane token approach since Forma is a Hyperlane chain
  const isFormaWithdrawal = (origin === 'forma' || origin === 'sketchpad');
  
  // For Relay transfers (excluding ALL Forma withdrawals), use Relay balance fetching
  const relayBalance = useRelayBalance(
    (isRelayOrigin && !isFormaWithdrawal) ? origin : undefined, 
    address
  );

  // For Hyperlane transfers (including ALL Forma withdrawals), use Hyperlane balance fetching
  // CRITICAL FIX: For Forma/Sketchpad origins, ALWAYS find the correct EVM TIA token
  // The tokenIndex system is unreliable and often picks the wrong TIA token
  let hyperlaneToken = token;
  if (origin === 'forma' || origin === 'sketchpad') {
    const tokens = getTokens();
    
    console.log('🚨 FORMA TOKEN OVERRIDE - Finding correct EVM TIA token for', origin);
    
    // ALWAYS find the EVM TIA token for Forma, regardless of what tokenIndex says
    let correctTiaToken = tokens.find(t => 
      t.chainName === origin && 
      t.symbol === 'TIA' && 
      t.protocol === 'ethereum'  // MUST be EVM protocol for Forma
    );
    
    if (!correctTiaToken) {
      // Fallback 1: Look for any EVM token with TIA in name
      correctTiaToken = tokens.find(t => 
        t.chainName === origin && 
        t.name?.toLowerCase().includes('tia') &&
        t.protocol === 'ethereum'
      );
    }
    
    if (!correctTiaToken) {
      // Fallback 2: Look for any token on Forma with ethereum protocol
      correctTiaToken = tokens.find(t => 
        t.chainName === origin && 
        t.protocol === 'ethereum'
      );
    }
    
    if (correctTiaToken) {
      console.log('✅ OVERRIDING with correct EVM TIA token:', {
        symbol: correctTiaToken.symbol,
        protocol: correctTiaToken.protocol,
        chainName: correctTiaToken.chainName,
        address: correctTiaToken.addressOrDenom
      });
      hyperlaneToken = correctTiaToken;
    } else {
      console.log('❌ CRITICAL ERROR: No EVM TIA token found for', origin);
      console.log('Available tokens on', origin, ':', tokens.filter(t => t.chainName === origin));
    }
  }

  const hyperlaneBalance = useBalance(
    (!isRelayOrigin || isFormaWithdrawal) ? origin : undefined,
    hyperlaneToken, 
    address
  );

  // CRITICAL DEBUG: Compare exact same values for deposit vs withdraw
  console.log('🚨 FINAL BALANCE LOGIC:', {
    scenario: `${origin} → ${destination}`,
    isRelayTransfer,
    isFormaWithdrawal,
    willUseRelayBalance: isRelayTransfer && !isFormaWithdrawal,
    willUseHyperlaneBalance: !isRelayTransfer || isFormaWithdrawal,
    relayBalanceValue: relayBalance.balance,
    hyperlaneBalanceValue: hyperlaneBalance.balance,
    hyperlaneIsLoading: hyperlaneBalance.isLoading,
    hyperlaneIsError: hyperlaneBalance.isError,
    selectedBalance: (isRelayTransfer && !isFormaWithdrawal) ? relayBalance.balance : hyperlaneBalance.balance,
    finalTokenUsed: hyperlaneToken ? {
      symbol: hyperlaneToken.symbol,
      protocol: hyperlaneToken.protocol,
      chainName: hyperlaneToken.chainName,
      address: hyperlaneToken.addressOrDenom
    } : 'NO TOKEN'
  });

  // Return the appropriate balance based on transfer type
  if (isRelayTransfer && !isFormaWithdrawal) {
    return { balance: relayBalance.balance };
  } else {
    return { balance: hyperlaneBalance.balance };
  }
}

export function useDestinationBalance(values: TransferFormValues) {
  const { origin, destination, tokenIndex, recipient } = values;
  const { relayChains } = useRelaySupportedChains();
  
  // Check if this is a Relay transfer
  const isOriginRelay = isRelayChain(origin, relayChains);
  const isDestinationRelay = isRelayChain(destination, relayChains);
  const isRelayTransfer = isOriginRelay || isDestinationRelay;
  
  // Special case: For Relay deposits to Forma, we need to show the TIA token balance on Forma
  const isRelayToFormaDeposit = isOriginRelay && (destination === 'forma' || destination === 'sketchpad');
  
  // Use Relay balance for Relay destination chains
  const relayBalance = useRelayBalance(isDestinationRelay ? destination : undefined, recipient);
  
  // Use Hyperlane balance for Hyperlane destination chains
  const originToken = getTokenByIndex(tokenIndex);
  const connection = originToken?.getConnectionForChain(destination);
  
  // For Relay deposits to Forma, manually find the TIA token on Forma
  let destinationToken = connection?.token;
  if (isRelayToFormaDeposit && !destinationToken) {
    // Find the TIA token on Forma for Relay deposits
    const tokens = getTokens();
    destinationToken = tokens.find(token => 
      token.chainName === destination && 
      token.symbol === 'TIA'
    );
  }
  
  const hyperlaneBalance = useBalance(!isDestinationRelay ? destination : undefined, destinationToken, recipient);
  
  // Return the appropriate balance based on chain type
  return isDestinationRelay ? relayBalance : hyperlaneBalance;
}

