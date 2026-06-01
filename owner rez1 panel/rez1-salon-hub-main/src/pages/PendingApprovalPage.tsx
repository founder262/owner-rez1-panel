import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function PendingApprovalPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
      <div className="flex justify-center mb-6">
        <div className="h-20 w-20 rounded-full bg-[#D2AC47]/10 flex items-center justify-center">
          <Clock className="h-10 w-10 text-[#D2AC47] animate-pulse" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Under Review</h1>
      <p className="text-muted-foreground mt-4 max-w-sm">
        Your salon registration has been successfully submitted and is currently being reviewed by our administration team. 
        You will receive an email once it is approved.
      </p>
      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs mx-auto">
        <Button 
          variant="outline" 
          className="h-12 w-full gap-2 text-muted-foreground hover:text-foreground" 
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" /> Go back
        </Button>
      </div>
    </div>
  );
}
