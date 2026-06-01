import { Card } from "@/components/ui/card";
import { AlertCircle, LogOut, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SuspendedPage() {
  const navigate = useNavigate();
  const [reason, setReason] = useState("Your salon account has been suspended by the administration. All bookings and dashboard management are currently disabled.");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: salon } = await supabase
        .from("salons")
        .select("suspension_reason, name")
        .eq("owner_id", user.id)
        .eq("is_suspended", true)
        .maybeSingle();
      if (salon?.suspension_reason) setReason(salon.suspension_reason);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6 border-destructive/20 shadow-lg">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-destructive animate-pulse-soft" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Restricted</h1>
          <p className="text-muted-foreground">
            {reason}
          </p>
        </div>

        <div className="bg-muted/50 p-4 rounded-xl space-y-3">
          <p className="text-sm font-medium">Common reasons for suspension:</p>
          <ul className="text-xs text-muted-foreground text-left list-disc list-inside space-y-1">
            <li>Pending subscription payment</li>
            <li>Policy violation or invalid business documentation</li>
            <li>Incomplete shop profile verification</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="outline" className="h-12 gap-2" asChild>
            <a href="mailto:support@rez1.com">
              <Phone className="h-4 w-4" /> Contact Administration
            </a>
          </Button>
          <Button 
            variant="ghost" 
            className="h-12 gap-2 text-muted-foreground hover:text-destructive" 
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> Logout from Session
          </Button>
        </div>
      </Card>
      
      <p className="mt-8 text-xs text-muted-foreground">
        &copy; 2024 REZ1 Salon Network. All records are securely stored.
      </p>
    </div>
  );
}
