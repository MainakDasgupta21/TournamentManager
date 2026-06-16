import { Toaster } from 'sonner';
import { useTheme } from '@/store/theme';

/** Sonner toaster that follows the active light/dark theme. */
export default function ThemedToaster() {
  const theme = useTheme((s) => s.theme);
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}
