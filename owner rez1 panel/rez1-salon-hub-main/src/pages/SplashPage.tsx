import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth check error:", error);
          if (error.message?.includes("Invalid Refresh Token") || error.message?.includes("Refresh Token Not Found") || error.status === 400) {
            await supabase.auth.signOut().catch(() => {});
          }
          timeout = setTimeout(() => navigate("/login"), 1500);
          return;
        }
        if (session) {
          timeout = setTimeout(() => navigate("/dashboard"), 1500);
        } else {
          timeout = setTimeout(() => navigate("/login"), 2500);
        }
      } catch (err) {
        console.error("Unexpected error during auth check:", err);
        timeout = setTimeout(() => navigate("/login"), 2500);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (timeout) clearTimeout(timeout);
        navigate("/dashboard");
      }
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          initial={{ rotate: -20 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex h-24 w-24 items-center justify-center"
        >
          <img src="/rez1-logo.svg" alt="REZ1 Logo" className="h-full w-full" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center flex flex-col items-center"
        >
          <img src="/rez1-text.svg" alt="REZ1" className="h-10 mb-1" />
          <p className="mt-1 text-sm text-muted-foreground">Owner Panel</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
