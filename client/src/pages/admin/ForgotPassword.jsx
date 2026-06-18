import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Mail, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function ForgotPassword() {
  const forgotPassword = useAuth((s) => s.forgotPassword);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useDocumentTitle('Reset password');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      // The server's response is intentionally generic, so always confirm.
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
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <Mail className="h-7 w-7 text-primary" />
                </span>
                <h1 className="text-xl font-semibold">Check your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, we've
                  sent a link to reset your password. It expires in 30 minutes.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/login"><ArrowLeft /> Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Forgot your password?</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                  Enter your account email and we'll send you a link to set a new password.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    <Send /> {loading ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Remembered it?{' '}
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
