import { cn } from '@/lib/utils';

/**
 * Consistent page heading block: optional icon, title, supporting description,
 * and a right-aligned actions slot. Used across the admin pages so titles,
 * spacing, and primary actions stay uniform.
 */
export function PageHeader({ icon: Icon, title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-4xl tracking-wide">
          {Icon && <Icon className="h-7 w-7 shrink-0 text-primary" />}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
