import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ConfirmContext = React.createContext(null);

const DEFAULTS = {
  title: 'Are you sure?',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'destructive', // 'destructive' | 'default'
};

/**
 * Provides a promise-based `confirm()` used in place of the native
 * `window.confirm`. Renders a single styled dialog and resolves to a boolean.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete?', description: '…' })) { … }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null);
  const resolver = React.useRef(null);
  const queue = React.useRef([]);

  const pumpQueue = React.useCallback(() => {
    if (resolver.current || queue.current.length === 0) return;
    const next = queue.current.shift();
    resolver.current = next.resolve;
    setState(next.options);
  }, []);

  const confirm = React.useCallback((opts = {}) => {
    return new Promise((resolve) => {
      queue.current.push({ options: { ...DEFAULTS, ...opts }, resolve });
      pumpQueue();
    });
  }, [pumpQueue]);

  const settle = React.useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
    queueMicrotask(pumpQueue);
  }, [pumpQueue]);

  const open = state !== null;
  const isDestructive = state?.variant !== 'default';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
        {state && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isDestructive && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </span>
                )}
                {state.title}
              </DialogTitle>
              {state.description && (
                <DialogDescription>{state.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => settle(false)}>
                {state.cancelLabel}
              </Button>
              <Button
                variant={isDestructive ? 'destructive' : 'default'}
                onClick={() => settle(true)}
                autoFocus
              >
                {state.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
