import { PropsWithChildren } from 'react';

interface Props {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<Props>) {
  return (
    <div
      className={`bg-form overflow-auto max-w-full w-100 relative ${className}`}
      style={{ border: '2px solid #FFFFFF', boxShadow: '4px 6px 0px 0px #FFFFFF' }}
    >
      {children}
    </div>
  );
}
