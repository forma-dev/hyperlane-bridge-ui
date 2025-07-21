import Image from 'next/image';
import { ComponentProps, useEffect, useMemo, useState } from 'react';

import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';

import { getChainDisplayName, tryGetChainMetadata } from '../../features/chains/utils';
import { useRelaySupportedChains } from '../../features/wallet/context/RelayContext';

// Custom fallback icons for Relay chains (used only if iconUrl from API fails)
function createRelayChainIcon(chainName: string, _size: number) {
  const chainConfig: Record<string, { symbol: string; color: string }> = {
    'ethereum': { symbol: 'ETH', color: '#627EEA' },
    'polygon': { symbol: 'MATIC', color: '#8247E5' },
    'arbitrum': { symbol: 'ARB', color: '#28A0F0' },
    'optimism': { symbol: 'OP', color: '#FF0420' },
    'base': { symbol: 'BASE', color: '#0052FF' },
    'bsc': { symbol: 'BNB', color: '#F3BA2F' },
    'avalanche': { symbol: 'AVAX', color: '#E84142' },
  };

  const config = chainConfig[chainName.toLowerCase()];
  if (!config) return undefined;

  const RelayChainIcon = (props: { width: number; height: number; title?: string }) => (
    <div 
      style={{ 
        width: props.width, 
        height: props.height,
        backgroundColor: config.color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: `${Math.max(8, props.width * 0.25)}px`,
        fontWeight: 'bold',
        fontFamily: 'sans-serif'
      }}
      title={props.title}
    >
      {config.symbol.slice(0, 3)}
    </div>
  );

  RelayChainIcon.displayName = `RelayChainIcon-${config.symbol}`;
  
  return RelayChainIcon;
}

// Helper function to map Relay chain names to internal names
function mapRelayChainToInternalName(relayChainName: string): string | null {
  const mapping: { [key: string]: string } = {
    // Full names (case-sensitive for display names)
    'Ethereum': 'ethereum',
    'Polygon': 'polygon', 
    'Arbitrum': 'arbitrum',
    'Optimism': 'optimism',
    'Base': 'base',
    'BNB Smart Chain': 'bsc',
    'Avalanche': 'avalanche',
    // Lowercase variants
    'ethereum': 'ethereum',
    'polygon': 'polygon',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'base': 'base',
    'bsc': 'bsc',
    'avalanche': 'avalanche',
    // Short names/symbols
    'ETH': 'ethereum',
    'MATIC': 'polygon',
    'OP': 'optimism',
    'ARB': 'arbitrum',
    'AVAX': 'avalanche',
    'BNB': 'bsc',
    // Other variations
    'Arbitrum One': 'arbitrum',
    'Binance Smart Chain': 'bsc',
  };
  
  return mapping[relayChainName] || null;
}

// Component to handle image loading with fallback
function ChainImage({ 
  src, 
  chainName, 
  width, 
  height, 
  title 
}: { 
  src: string; 
  chainName: string; 
  width: number; 
  height: number; 
  title?: string; 
}) {
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    setImageError(false);
  }, [src]);
  
  if (imageError) {
    const FallbackIcon = createRelayChainIcon(chainName, width);
    return FallbackIcon ? <FallbackIcon width={width} height={height} title={title} /> : null;
  }
  
  return (
    <Image 
      src={src} 
      alt={title || chainName}
      width={width}
      height={height}
      title={title}
      onError={() => setImageError(true)}
    />
  );
}

export function ChainLogo(props: ComponentProps<typeof ChainLogoInner>) {
  const { chainName, ...rest } = props;
  const { relayChains } = useRelaySupportedChains();
  
  const { chainId, chainDisplayName, icon } = useMemo(() => {
    if (!chainName) return {};
    const chainDisplayName = getChainDisplayName(chainName);
    const chainMetadata = tryGetChainMetadata(chainName);
    const chainId = chainMetadata?.chainId;
    
    let icon: ((props: { width: number; height: number; title?: string }) => JSX.Element) | undefined;
    
    // First, check if this is a Relay chain and get its iconUrl from the API
    const relayChain = relayChains.find(chain => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === chainName.toLowerCase();
    });
    
    if (relayChain && (relayChain.iconUrl || relayChain.logoUrl)) {
      // Use iconUrl from Relay API with fallback to logoUrl
      const imageUrl = relayChain.iconUrl || relayChain.logoUrl;
      icon = (props: { width: number; height: number; title?: string }) => (
        <ChainImage 
          src={imageUrl!} 
          chainName={chainName}
          width={props.width}
          height={props.height}
          title={props.title}
        />
      );
    } else if (chainMetadata?.logoURI) {
      // Use logoURI from Hyperlane metadata
      icon = (props: { width: number; height: number; title?: string }) => (
        <Image 
          src={chainMetadata.logoURI} 
          alt={chainDisplayName || chainName}
          width={props.width}
          height={props.height}
          title={props.title}
        />
      );
    } else {
      // Final fallback to custom icon for known Relay chains
      icon = createRelayChainIcon(chainName, rest.size || 32);
    }
    
    return {
      chainId,
      chainDisplayName,
      icon,
    };
  }, [chainName, relayChains, rest.size]);

  return <ChainLogoInner {...rest} chainId={chainId} chainName={chainDisplayName} icon={icon} />;
}
