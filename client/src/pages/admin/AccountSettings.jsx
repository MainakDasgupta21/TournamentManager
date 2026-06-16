import { useState } from 'react';
import { KeyRound, ShieldCheck, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

const MIN_LENGTH = 8;
const BLANK = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Mirror the server-side rules so the user gets instant feedback. */
function validate({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword) return 'Enter your current password.';
  if (newPassword.length < MIN_LENGTH) return `New password must be at least ${MIN_LENGTH} characters.`;
  if (newPassword === currentPassword) return 'New password must be different from your current password.';
  if (newPassword !== confirmPassword) return 'New passwords do not match.';
  return null;
}

export default function AccountSettings() {
  const user = useAuth((s) => s.user);
  const changePassword = useAuth((s) => s.changePassword);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  useDocumentTitle('Account · Admin');

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const message = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(message || 'Password changed');
      setForm(BLANK);
    } catch (err) {
      // Surface the server message (e.g. "Current password is incorrect") inline.
      const message = apiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Account" description="Manage your sign-in details" className="mb-8" />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
          <span className="font-medium">{user?.name}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {user?.email}
          </span>
          <Badge variant="secondary" className="ml-auto">
            {user?.role === 'superadmin' ? 'Super Admin' : 'Tournament Admin'}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => set({ currentPassword: e.target.value })}
                required
              />
            </div>
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
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <p className="flex items-start gap-1.5 rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Changing your password signs out every other device. This session stays active.
            </p>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <KeyRound /> {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
