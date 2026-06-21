import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[0.01em] transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px',
  {
    variants: {
      variant: {
        default:
          'border-primary/55 bg-gradient-to-b from-primary to-primary/86 text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-110 hover:shadow-[var(--shadow-elevated)]',
        destructive:
          'border-destructive/55 bg-gradient-to-b from-destructive to-destructive/82 text-destructive-foreground shadow-[var(--shadow-soft)] hover:brightness-110',
        outline:
          'border-border/85 bg-card/72 text-foreground hover:border-primary/35 hover:bg-secondary/65 hover:text-foreground',
        secondary:
          'border-border/70 bg-secondary/76 text-secondary-foreground hover:border-border hover:bg-secondary/92',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/58 hover:text-foreground',
        accent:
          'border-accent/55 bg-gradient-to-b from-accent to-accent/84 text-accent-foreground shadow-[var(--shadow-soft)] hover:brightness-110',
        link: 'border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
