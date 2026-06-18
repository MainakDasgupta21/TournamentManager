import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((s) => s.login);
  useDocumentTitle('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid px-4">
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
            <h1 className="text-xl font-semibold">Admin sign in</h1>
            <p className="mb-6 text-sm text-muted-foreground">Manage tournaments and review admin access</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="flex items-start gap-1.5 rounded-md bg-secondary/45 p-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Password reset is available for organiser accounts. Super admin passwords are managed by server configuration.
                </p>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <LogIn /> {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Want to run tournaments?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Request organiser access
              </Link>
            </p>
            <p className="mt-4 rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
              Super admin credentials are set by server configuration and cannot be reset from this
              screen. Contact the site maintainer if credentials have changed.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
