import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/theme';
import { useAuth } from '@/store/auth';
import { useUpdateThemePreference } from '@/hooks/queries';
import { Button } from '@/components/ui/button';

/**
 * Light/dark theme switch. The choice is applied to the DOM immediately; for a
 * signed-in user it is also persisted to the database (the source of truth).
 * Nothing is stored on the client.
 */
export default function ThemeToggle({ className }) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const isAuthenticated = useAuth((s) => s.status === 'authenticated');
  const persistTheme = useUpdateThemePreference();
  const isDark = theme === 'dark';

  const onToggle = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    if (isAuthenticated) persistTheme.mutate(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className={className}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
