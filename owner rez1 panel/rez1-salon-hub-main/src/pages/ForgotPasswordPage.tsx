import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
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
            <p className="mt-1 text-sm text-muted-foreground">Reset your password</p>
          </div>
        </div>

        {sent ? (
          /* Success State */
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a password reset link to <strong className="text-foreground">{email}</strong>. Check your inbox and click the link to reset your password.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className="h-12 text-base"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                We'll send a reset link to this email address.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full h-12 text-muted-foreground"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </form>
        )}

      </div>
    </div>
  );
}
