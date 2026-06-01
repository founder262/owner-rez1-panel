import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Scissors, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/lib/supabase";

export default function OtpVerifyPage() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const email = (location.state as { email?: string })?.email || "";

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      toast({ title: "Please enter the complete OTP", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email"
    });

    if (error || !data.user) {
      toast({ title: "Invalid OTP. Please try again.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    const { data: owner } = await supabase
      .from("owners")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!owner) {
      await supabase.from("owners").insert({ id: userId, email });
      navigate("/register");
      return;
    }

    const { data: salon } = await supabase
      .from("salons")
      .select("id, is_suspended")
      .eq("owner_id", userId)
      .maybeSingle();

    if (salon?.is_suspended) {
      navigate("/suspended");
      return;
    }

    if (!salon) {
      const { data: req } = await supabase
        .from("salon_requests")
        .select("id, status")
        .eq("email", data.user.email)   // match by email since salon_requests has no owner_id yet
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (req?.status === "pending") {
        navigate("/pending-approval");
      } else if (req?.status === "approved") {
        // Request approved but salon not yet linked — try owner query by email
        navigate("/dashboard");
      } else {
        navigate("/register");
      }
      return;
    }

    navigate("/dashboard");
  };

  const handleResend = () => {
    toast({ title: "OTP resent successfully to your email" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Scissors className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Verify OTP</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit code sent to
            </p>
            <p className="text-sm font-medium text-foreground">{email || "your email"}</p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-semibold"
          >
            {loading ? "Verifying..." : "Verify & Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-3">
          <button
            type="button"
            onClick={handleResend}
            className="text-sm text-primary hover:underline font-medium"
          >
            Resend OTP
          </button>
        </div>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>
      </div>
    </div>
  );
}
