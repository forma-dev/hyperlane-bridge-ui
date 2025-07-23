import Image from 'next/image';
import { ComponentProps, useEffect, useMemo, useState } from 'react';

import { ChainLogo as ChainLogoInner } from '@hyperlane-xyz/widgets';

import {
  getRelayNativeTokenInfo,
  mapRelayChainToInternalName,
} from '../../features/chains/relayUtils';
import { getChainDisplayName, tryGetChainMetadata } from '../../features/chains/utils';
import { useRelaySupportedChains } from '../../features/wallet/context/RelayContext';

// Custom fallback icons for Relay chains (used only if iconUrl from API fails)
function createRelayChainIcon(chainName: string, _size: number, relayChains?: any[]) {
  const currencyInfo = getRelayNativeTokenInfo(chainName, relayChains);

  // Use a color mapping for the fallback icons
  const colorMap: Record<string, string> = {
    ETH: '#627EEA',
    ARB: '#28A0F0',
    OP: '#FF0420',
  };

  const color = colorMap[currencyInfo?.symbol || 'ETH'] || '#6B7280';

  const RelayChainIcon = (props: { width: number; height: number; title?: string }) => (
    <div
      style={{
        width: props.width,
        height: props.height,
        backgroundColor: color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: `${Math.max(8, props.width * 0.25)}px`,
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
      }}
      title={props.title}
    >
      {(currencyInfo?.symbol || 'ETH').slice(0, 3)}
    </div>
  );

  RelayChainIcon.displayName = `RelayChainIcon-${currencyInfo?.symbol || 'ETH'}`;

  return RelayChainIcon;
}

// Component to handle image loading with fallback
function ChainImage({
  src,
  chainName,
  width,
  height,
  title,
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

    let icon:
      | ((props: { width: number; height: number; title?: string }) => JSX.Element)
      | undefined;

    // Check if this is a Relay chain and get its iconUrl from the API
    const relayChain = relayChains.find((chain) => {
      const internalName = mapRelayChainToInternalName(chain.name);
      return internalName === chainName.toLowerCase();
    });

    // For Forma, prioritize local logo over Relay's logo
    const shouldUseLocalLogo = chainName === 'forma' || chainName === 'sketchpad';

    if (shouldUseLocalLogo && chainMetadata?.logoURI) {
      // Use local logo for Forma/Sketchpad
      icon = (props: { width: number; height: number; title?: string }) => (
        <Image
          src={chainMetadata.logoURI}
          alt={chainDisplayName || chainName}
          width={props.width}
          height={props.height}
          title={props.title}
        />
      );
    } else if (relayChain && (relayChain.iconUrl || relayChain.logoUrl)) {
      // Use iconUrl from Relay API with fallback to logoUrl for other chains
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
      // Use logoURI from Hyperlane metadata for other chains
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
      icon = createRelayChainIcon(chainName, rest.size || 32, relayChains);
    }

    return {
      chainId,
      chainDisplayName,
      icon,
    };
  }, [chainName, relayChains, rest.size]);

  return <ChainLogoInner {...rest} chainId={chainId} chainName={chainDisplayName} icon={icon} />;
}
