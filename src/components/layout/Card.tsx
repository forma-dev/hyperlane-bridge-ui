import { PropsWithChildren } from 'react';

interface Props {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<Props>) {
  return (
    <div
      className={`bg-form overflow-auto max-w-full w-100 relative ${className}`}
      style={{ border: '0.5px solid #FFFFFF' }}
    >
      {children}
    </div>
  );
}
