import { cn } from '@/lib/utils';

/**
 * Consistent page heading block: optional icon, title, supporting description,
 * and a right-aligned actions slot. Used across the admin pages so titles,
 * spacing, and primary actions stay uniform.
 */
export function PageHeader({ icon: Icon, title, description, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-start gap-2.5 font-display text-3xl tracking-[-0.02em] sm:text-4xl">
          {Icon && <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" />}
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
