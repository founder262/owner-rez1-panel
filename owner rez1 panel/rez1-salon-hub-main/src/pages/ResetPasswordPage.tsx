import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase fires an auth state change event when user lands on this page via reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if there's already a session (in case they reload the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim() || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      // Auto-redirect after 3 seconds
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center">
            <img src="/rez1-logo.svg" alt="REZ1 Logo" className="h-full w-full" />
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="flex items-center gap-2">
              <img src="/rez1-text.svg" alt="REZ1" className="h-7" />
              <h1 className="text-2xl font-bold tracking-tight">Owner Panel</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {done ? "Password updated!" : "Set a new password"}
            </p>
          </div>
        </div>

        {done ? (
          /* Success State */
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Password Updated!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your password has been changed successfully. Redirecting you to the dashboard...
              </p>
            </div>
          </div>
        ) : !sessionReady ? (
          /* No valid session — invalid or expired link */
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Invalid or Expired Link</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This password reset link has expired or is invalid. Please request a new one.
              </p>
            </div>
            <Button className="w-full h-12" onClick={() => navigate("/forgot-password")}>
              Request New Link
            </Button>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="h-12 text-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                className="h-12 text-base"
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}

      </div>
    </div>
  );
}
