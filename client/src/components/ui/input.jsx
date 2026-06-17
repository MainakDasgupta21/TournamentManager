import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-xl border border-input/85 bg-background/66 px-3 py-2 text-sm shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/90 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-xl border border-input/85 bg-background/66 px-3 py-2 text-sm shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/90 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, Textarea };
