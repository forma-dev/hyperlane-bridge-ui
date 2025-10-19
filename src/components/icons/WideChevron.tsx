import { ChevronIcon } from './Chevron';

import { Color } from '../../styles/Color';

export function WideChevron({ classes }: { classes?: string }) {
  return (
    <ChevronIcon
      width="17"
      height="100%"
      direction="e"
      color={Color.lightGray}
      classes={classes}
    />
  );
}
