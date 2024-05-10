import { PropsWithChildren } from 'react';

interface Props {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<Props>) {
  return (
    <div
      className={`bg-form overflow-auto max-w-full w-100 relative border-[0.5px] border-solid border-white ${className}`}
    >
      {children}
    </div>
  );
}
