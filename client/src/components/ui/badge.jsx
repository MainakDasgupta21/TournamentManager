import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.01em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/12 text-primary',
        secondary: 'border-border/70 bg-secondary/70 text-secondary-foreground',
        outline: 'border-border/80 bg-background/35 text-foreground',
        live: 'border-destructive/35 bg-destructive/15 text-destructive',
        success: 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]',
        warning: 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]',
        accent: 'border-accent/35 bg-accent/15 text-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
