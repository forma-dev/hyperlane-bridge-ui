import { PropsWithChildren, ReactElement } from 'react';

interface ButtonProps {
  type?: 'submit' | 'reset' | 'button';
  color?:
    | 'white'
    | 'blue'
    | 'green'
    | 'red'
    | 'gray'
    | 'button'
    | 'black'
    | 'navBarButton'
    | 'disabled'; // defaults to blue
  bold?: boolean;
  classes?: string;
  icon?: ReactElement;
}

export function SolidButton(
  props: PropsWithChildren<ButtonProps & React.HTMLProps<HTMLButtonElement>>,
) {
  const {
    type,
    onClick,
    color: _color,
    classes,
    bold,
    icon,
    disabled,
    title,
    ...passThruProps
  } = props;
  const color = _color ?? 'blue';

  const base = 'flex items-center justify-center transition-all duration-500';
  let baseColors, border, onHover, onActive, style;

  if (color === 'button') {
    baseColors = 'bg-button-active text-black';
    onHover = 'hover:bg-button-hover';
    border = 'border-b border-solid border-black';
    style = {
      borderBottomWidth: '0.5px',
    };
  } else if (color === 'navBarButton') {
    baseColors = 'bg-button text-white';
    style = { width: '188px', height: '40px' };
  } else if (color === 'blue') {
    baseColors = 'bg-blue-500 text-white';
    onHover = 'hover:bg-blue-600';
    onActive = 'active:bg-blue-700';
  } else if (color === 'green') {
    baseColors = 'bg-green-500 text-white';
    onHover = 'hover:bg-green-600';
    onActive = 'active:bg-green-700';
  } else if (color === 'red') {
    baseColors = 'text-white';
    onHover = 'hover:opacity-90';
    onActive = 'active:opacity-80';
    border = 'border-b border-solid border-black';
    style = {
      backgroundColor: '#FF4D3D',
      borderBottomWidth: '0.5px',
    };
  } else if (color === 'white') {
    baseColors = 'bg-white text-black';
    onHover = 'hover:bg-gray-100';
    onActive = 'active:bg-gray-200';
  } else if (color === 'gray') {
    baseColors = 'bg-gray-100 text-mint-700';
    onHover = 'hover:bg-gray-200';
    onActive = 'active:bg-gray-300';
  } else if (color === 'black') {
    baseColors = 'bg-white text-black';
    border = 'border border-solid border-black';
    onHover = 'hover:bg-bg-button-main-disabled';
    style = {
      borderWidth: '0.5px',
    };
  } else if (color === 'disabled') {
    baseColors = 'bg-bg-button-main-disabled text-black opacity-50 cursor-not-allowed';
    border = 'border-b border-solid border-black';
    onHover = 'hover:bg-bg-button-main-disabled';
    style = {
      borderBottomWidth: '0.5px',
    };
  }
  const onDisabled = 'disabled:bg-gray-300 disabled:text-gray-500';
  const weight = bold ? 'font-semibold' : '';
  const allClasses = `${base} ${baseColors} ${border} ${onHover} ${onDisabled} ${onActive} ${weight} ${classes}`;

  return (
    <button
      style={style}
      onClick={onClick}
      type={type ?? 'button'}
      disabled={disabled ?? false}
      title={title}
      className={`py-2 px-4 flex items-center justify-center font-bold text-sm leading-6 whitespace-nowrap transition-all duration-200 rounded-card ${allClasses} ${
        disabled ? 'disabled:bg-gray-300 disabled:text-gray-500' : ''
      }`}
      {...passThruProps}
    >
      {icon ? (
        <div className="flex items-center justify-center space-x-1">
          {props.icon}
          {props.children}
        </div>
      ) : (
        <>{props.children}</>
      )}
    </button>
  );
}
