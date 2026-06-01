import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [otpMode, setOtpMode] = useState<"request" | "verify">("request");
  const [otpToken, setOtpToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({ title: "Please enter your username/email", variant: "destructive" });
      return;
    }

    if (loginMethod === "password" && !password.trim()) {
      toast({ title: "Please enter your password", variant: "destructive" });
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (loginMethod === "password") {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: username.trim(),
          password: password.trim(),
        });
        if (authError || !authData.user) throw new Error(authError?.message || "Invalid credentials. Please try again.");
        await checkUserRedirection(authData.user);
      } else {
        if (otpMode === "request") {
          const { error: authError } = await supabase.auth.signInWithOtp({
            email: username.trim(),
            options: {
              shouldCreateUser: false, // Only send OTP to already-registered owners
            }
          });
          if (authError) {
            if (authError.message.includes("Signups not allowed") || authError.message.includes("not found")) {
              throw new Error("This email is not registered as a salon owner. Please use Password login or Register first.");
            }
            throw new Error(authError.message);
          }
          toast({ title: "OTP sent to your email!" });
          setOtpMode("verify");
        } else {
          const { data: authData, error: authError } = await supabase.auth.verifyOtp({
            email: username.trim(),
            token: otpToken.trim(),
            type: "email",
          });
          if (authError || !authData.user) throw new Error(authError?.message || "Invalid OTP. Please try again.");
          await checkUserRedirection(authData.user);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkUserRedirection = async (user: any) => {
    // Check owner profile
    const { data: owner } = await supabase.from("owners").select("*").eq("id", user.id).maybeSingle();
    // Allow skipping strict owner check if they only have a request currently (fallback)

    // Check salon status
    const { data: salon } = await supabase.from("salons").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    localStorage.setItem("rez1-auth", "true");

    if (salon) {
      if (salon.is_suspended) {
         navigate("/suspended");
      } else {
         navigate("/dashboard");
      }
    } else {
      const { data: req } = await supabase.from("salon_requests").select("status").eq("email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (req && req.status === "pending") {
         navigate("/pending-approval");
      } else {
         navigate("/register");
      }
    }
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
            <p className="mt-1 text-sm text-muted-foreground">Sign in with your credentials</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-lg">
           <button 
             type="button"
             onClick={() => { setLoginMethod("password"); setError(""); }} 
             className={`text-sm font-medium h-9 rounded-md transition-colors ${loginMethod === "password" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
           >
             Password
           </button>
           <button 
             type="button"
             onClick={() => { setLoginMethod("otp"); setError(""); setOtpMode("request"); }} 
             className={`text-sm font-medium h-9 rounded-md transition-colors ${loginMethod === "otp" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
           >
             Email OTP
           </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">Username / Email</Label>
            <Input
              id="username"
              placeholder="Enter your email"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="h-12 text-base"
              autoComplete="username"
            />
          </div>

          {loginMethod === "password" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm font-medium text-primary hover:underline">
                   Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="h-12 text-base pr-12"
                  autoComplete="current-password"
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
          ) : (
            otpMode === "verify" && (
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium">Enter OTP Token</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter the 6-digit code"
                  value={otpToken}
                  onChange={(e) => { setOtpToken(e.target.value); setError(""); }}
                  className="h-12 text-base tracking-widest text-center"
                />
              </div>
            )
          )}

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

          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
            {loading 
               ? "Processing..." 
               : loginMethod === "password" 
                  ? "Sign In" 
                  : otpMode === "request" 
                     ? "Send OTP" 
                     : "Verify OTP & Sign In"
            }
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New salon?{" "}
          <button onClick={() => navigate("/register")} className="text-primary font-medium hover:underline">
            Register Your Salon
          </button>
        </p>
      </div>
    </div>
  );
}
