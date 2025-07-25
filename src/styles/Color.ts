// Should match theme.css CSS custom properties
export enum Color {
  primaryBlack = 'var(--color-primary-black)',
  primaryWhite = 'var(--color-primary-white)',
  primaryGray = 'var(--color-primary-gray)',
  lightGray = 'var(--color-light-gray)',
  primaryBlue = 'var(--color-primary-blue)',
  primaryPink = 'var(--color-primary-pink)',
  primaryBeige = 'var(--color-primary-beige)',
  primaryRed = 'var(--color-primary-red)',
  primaryMint = 'var(--color-primary-mint)',
  button = 'var(--color-button)',
  accent = 'var(--color-accent)',
  background = 'var(--color-background)',
  primaryText = 'var(--color-text-primary)',
  secondaryText = 'var(--color-text-secondary)',
  disabledText = 'var(--color-text-disabled)',
  cardColor = 'var(--color-card)',
  disabledColor = 'var(--color-disabled)',
}

// Useful for cases when using class names isn't convenient
// such as in svg fills
export function classNameToColor(className) {
  switch (className) {
    case 'bg-blue-500':
      return Color.primaryBlue;
    case 'bg-red-500':
      return Color.primaryRed;
    case 'bg-gray-500':
      return Color.primaryGray;
    case 'bg-button':
      return Color.button;
    case 'text-primary':
      return Color.primaryText;
    case 'text-secondary':
      return Color.secondaryText;
    case 'text-disabled':
      return Color.disabledText;
    case 'bg-form':
      return Color.cardColor;
    case 'bg-disabled':
      return Color.disabledColor;
    default:
      throw new Error('Missing color for className: ' + className);
  }
}
