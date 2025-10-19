import { Color } from '../../styles/Color';

import { ChevronIcon } from './Chevron';

export function WideChevron({ classes }: { classes?: string }) {
  return (
    <ChevronIcon width="17" height="100%" direction="e" color={Color.lightGray} classes={classes} />
  );
}
