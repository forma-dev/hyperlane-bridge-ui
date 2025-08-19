import Image from 'next/image';
import { memo } from 'react';

import { IToken } from '@hyperlane-xyz/sdk';
import { Circle } from '@hyperlane-xyz/widgets';

import { isValidUrl } from '../../utils/url';
import { ErrorBoundary } from '../errors/ErrorBoundary';

interface Props {
  token?: IToken | null;
  size?: number;
}

function _TokenIcon({ token, size = 32 }: Props) {
  const title = token?.symbol || '';
  const character = title ? title.charAt(0).toUpperCase() : '';
  const fontSize = Math.floor(size / 2);

  // Use direct loading for token images (CSP wildcard allows all HTTPS images)
  const getDirectImageSrc = (url: string) => {
    if (!url || !isValidUrl(url)) return null;
    return url;
  };

  const imageSrc = token?.logoURI ? getDirectImageSrc(token.logoURI) : null;

  const bgColorSeed =
    token && !imageSrc ? (Buffer.from(token.addressOrDenom).at(0) || 0) % 5 : undefined;

  return (
    <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
      {imageSrc ? (
        <ErrorBoundary hideError={true}>
          <Image src={imageSrc} alt="" width={size} height={size} />
        </ErrorBoundary>
      ) : (
        <div className={`text-[${fontSize}px]`}>{character}</div>
      )}
    </Circle>
  );
}

export const TokenIcon = memo(_TokenIcon);
