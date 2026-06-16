import { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catches render-time errors anywhere in the tree and shows a branded
 * fallback instead of a blank screen. Reloading is the simplest recovery
 * path for an SPA, so we offer that plus a "back home" escape hatch.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; a real app would report here.
    console.error('Uncaught UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </span>
        <div>
          <h1 className="font-display text-4xl tracking-wide">Something broke</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            An unexpected error stopped this page from rendering. Reloading usually fixes it.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>
            <RotateCw /> Reload
          </Button>
          <Button variant="outline" onClick={() => { window.location.href = '/'; }}>
            Back to tournaments
          </Button>
        </div>
      </div>
    );
  }
}
