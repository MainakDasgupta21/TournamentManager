import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const MIN_LENGTH = 8;

function validate(newPassword, confirmPassword) {
  if (newPassword.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (newPassword !== confirmPassword) return 'Passwords do not match.';
  return null;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const resetPassword = useAuth((s) => s.resetPassword);

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  useDocumentTitle('Set a new password');

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate(form.newPassword, form.confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const message = await resetPassword({ token, newPassword: form.newPassword });
      toast.success(message || 'Password reset');
      navigate('/login', { replace: true });
    } catch (err) {
      const message = apiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-start justify-center bg-grid px-4 py-10 sm:items-center">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-background" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-3xl tracking-wide">TourneyOps</span>
        </Link>

        <Card>
          <CardContent className="p-6">
            {!token ? (
              <div className="flex flex-col items-center text-center">
                <h1 className="text-xl font-semibold">Invalid reset link</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  This link is missing its token. Request a new password reset to continue.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/forgot-password"><ArrowLeft /> Request a new link</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Set a new password</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                  Choose a new password for your account.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">New password</Label>
                    <PasswordInput
                      id="newPassword"
                      autoComplete="new-password"
                      value={form.newPassword}
                      onChange={(e) => set({ newPassword: e.target.value })}
                      minLength={MIN_LENGTH}
                      required
                    />
                    <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <PasswordInput
                      id="confirmPassword"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={(e) => set({ confirmPassword: e.target.value })}
                      required
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
                  )}

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    <KeyRound /> {loading ? 'Updating…' : 'Reset password'}
                  </Button>
                </form>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
