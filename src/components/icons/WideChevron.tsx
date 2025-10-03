import { Color } from '../../styles/Color';

export function WideChevron({ classes }: { classes?: string }) {
  return (
    <svg
      width="17"
      height="100%"
      viewBox="0 0 17 100"
      className={classes}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0 L17 50 L0 100"
        stroke={Color.lightGray}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
