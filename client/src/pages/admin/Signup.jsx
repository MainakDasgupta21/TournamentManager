import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, UserPlus, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function Signup() {
  const signup = useAuth((s) => s.signup);
  const [form, setForm] = useState({ name: '', email: '', password: '', organization: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useDocumentTitle('Request organiser access');

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        organization: form.organization || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(apiError(err));
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
            {submitted ? (
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success)/0.15)]">
                  <CheckCircle2 className="h-7 w-7 text-[hsl(var(--success))]" />
                </span>
                <h1 className="text-xl font-semibold">Request submitted</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your organiser account is awaiting approval from the site maintainer. You'll be able
                  to sign in once it's approved.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/login"><ArrowLeft /> Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Request organiser access</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                  Create an account to run tournaments. A site maintainer reviews every request.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="organization">Organization <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="organization" value={form.organization} onChange={(e) => set({ organization: e.target.value })} placeholder="Club, league or company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} minLength={8} required />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    <UserPlus /> {loading ? 'Submitting…' : 'Request access'}
                  </Button>
                </form>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Already approved?{' '}
                  <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
