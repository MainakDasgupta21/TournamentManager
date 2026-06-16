import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import { ConfirmProvider } from '@/components/ui/confirm';
import { TooltipProvider } from '@/components/ui/tooltip';
import ErrorBoundary from '@/components/ErrorBoundary';
import ThemedToaster from '@/components/ThemedToaster';
import App from '@/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <TooltipProvider delayDuration={250} skipDelayDuration={400}>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </TooltipProvider>
          </ErrorBoundary>
          <ThemedToaster />
        </BrowserRouter>
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>
);

// Register the PWA service worker (production builds only, to avoid caching
// the dev server's modules).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW registration is best-effort */
    });
  });
}
