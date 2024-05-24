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
    baseColors = 'bg-button text-white';
    onHover = 'hover:bg-[#FF9797]';
    border = 'border-[1px] border-solid border-white';
    style = {
      boxShadow: '2px 3px 0px 0px #FFFFFF',
    };
  } else if (color === 'navBarButton') {
    baseColors = 'bg-button text-white';
    style = { boxShadow: '2px 3px 0px 0px #FFFFFF', width: '188px', height: '40px' };
  } else if (color === 'blue') {
    baseColors = 'bg-blue-500 text-white';
    onHover = 'hover:bg-blue-600';
    onActive = 'active:bg-blue-700';
  } else if (color === 'green') {
    baseColors = 'bg-green-500 text-white';
    onHover = 'hover:bg-green-600';
    onActive = 'active:bg-green-700';
  } else if (color === 'red') {
    baseColors = 'bg-red-600 text-white';
    onHover = 'hover:bg-red-500';
    onActive = 'active:bg-red-400';
  } else if (color === 'white') {
    baseColors = 'bg-white text-black';
    onHover = 'hover:bg-gray-100';
    onActive = 'active:bg-gray-200';
  } else if (color === 'gray') {
    baseColors = 'bg-gray-100 text-mint-700';
    onHover = 'hover:bg-gray-200';
    onActive = 'active:bg-gray-300';
  } else if (color === 'black') {
    baseColors = 'bg-black text-secondary';
    border = 'border-[1px] border-solid border-white';
    style = {
      boxShadow: '2px 3px 0px 0px #FFFFFF',
    };
  } else if (color === 'disabled') {
    baseColors = 'bg-black text-secondary cursor-auto opacity-40';
    border = 'border-[1px] border-solid border-white';
    style = {
      boxShadow: '2px 3px 0px 0px #FFFFFF',
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
      className={allClasses}
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
