'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { BRAND } from '@/lib/branding';
import { adminLogin } from '@/services/auth';

export default function LoginPage() {
  const router = useRouter();
  const { hydrated, accessToken, setSession } = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in, bounce straight through.
  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/dashboard');
    }
  }, [hydrated, accessToken, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await adminLogin(identifier.trim(), password);

      // The server-side RolesGuard is the real gate. This is only so a
      // non-admin gets a clear message instead of an empty panel that 403s
      // on every request.
      if (result.user.role !== 'admin') {
        throw new Error('This account is not an administrator.');
      }

      setSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      toast.success('Welcome back');
      router.replace('/dashboard');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel, hidden below lg so the form owns small screens. */}
      <div className="relative hidden overflow-hidden bg-[hsl(224_39%_9%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            {BRAND.name}
          </span>
        </div>

        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-semibold leading-tight">
            {BRAND.tagline}
          </h1>
          <ul className="space-y-3">
            {BRAND.highlights.map((label) => (
              <li key={label} className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          Authorised administrators only.
        </p>
      </div>

      <div className="flex items-center justify-center bg-muted/30 p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use your administrator account.
            </p>
          </div>

          <div className="space-y-2">
            {/* id="identifier" is what the verify script fills, keep it. */}
            <Label htmlFor="identifier">Email</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              required
              className="h-11"
              placeholder={BRAND.loginPlaceholder}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
