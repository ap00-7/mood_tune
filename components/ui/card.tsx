import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />,
);
CardHeader.displayName = 'CardHeader';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardContent };
