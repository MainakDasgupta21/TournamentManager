import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EmptyState,
  ErrorState,
  Pager,
  SearchInput,
  SkeletonGrid,
  Spinner,
} from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/**
 * Shared shell for super-admin request queues: heading, filters, states, list and pagination.
 */
export default function RequestQueuePage({
  icon,
  title,
  description,
  query,
  onQueryChange,
  searchPlaceholder,
  searchLabel,
  searchWidthClassName = 'sm:w-64',
  status,
  onStatusChange,
  statusOptions,
  statusLabel = 'Filter by status',
  statusWidthClassName = 'sm:w-44',
  isFetching,
  isLoading,
  isError,
  onRetry,
  errorTitle,
  errorDescription,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  hasSearch,
  onClearSearch,
  clearSearchLabel = 'Clear search',
  gridClassName,
  page,
  pages,
  onPage,
  children,
}) {
  const searchId = useId();
  const statusId = useId();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor={searchId} className="sr-only">{searchLabel}</Label>
              <SearchInput
                id={searchId}
                aria-label={searchLabel}
                value={query}
                onChange={onQueryChange}
                placeholder={searchPlaceholder}
                className={cn('w-full', searchWidthClassName)}
              />
              {isFetching && <Spinner className="h-4 w-4 shrink-0" />}
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor={statusId} className="sr-only">{statusLabel}</Label>
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger
                  id={statusId}
                  aria-label={statusLabel}
                  className={cn('w-full', statusWidthClassName)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasSearch && onClearSearch && (
                <Button variant="ghost" size="sm" onClick={onClearSearch} className="shrink-0">
                  {clearSearchLabel}
                </Button>
              )}
            </div>
          </div>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={3} media={false} />
      ) : isError ? (
        <ErrorState title={errorTitle} description={errorDescription} onRetry={onRetry} />
      ) : isEmpty ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            hasSearch && onClearSearch
              ? <Button variant="outline" onClick={onClearSearch}>{clearSearchLabel}</Button>
              : undefined
          }
        />
      ) : (
        <>
          <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', gridClassName)}>{children}</div>
          <Pager page={page} pages={pages} onPage={onPage} className="mt-8" />
        </>
      )}
    </div>
  );
}
