import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function PhoneLoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    const formatted = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({ email: formatted });

    if (error) {
      setError(error.message || "Failed to send OTP");
      setLoading(false);
      return;
    }

    toast({ title: "OTP sent to " + formatted });
    setLoading(false);
    setError("");
    navigate("/verify-otp", { state: { email: formatted } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center">
            <img src="/rez1-logo.svg" alt="REZ1 Logo" className="h-full w-full" />
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="flex items-center gap-2">
              <img src="/rez1-text.svg" alt="REZ1" className="h-7" />
              <h1 className="text-2xl font-bold tracking-tight">Owner Panel</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with your email</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="salon@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className="h-12 text-base"
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-sm text-destructive">{error}</p>
                {error.includes("not registered") && (
                  <Button type="button" variant="outline" size="sm" className="mt-1 border-primary text-primary hover:bg-primary/10" onClick={() => navigate("/register")}>
                    Register Your Salon
                  </Button>
                )}

              </div>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold gap-2">
            {loading ? "Sending..." : "Send OTP"} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
        </div>

        <Button variant="outline" className="w-full h-12 text-base" onClick={() => navigate("/login-credentials")}>
          Login with Credentials
        </Button>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            New salon?{" "}
            <button onClick={() => navigate("/register")} className="text-primary font-medium hover:underline">
              Register Your Salon
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
