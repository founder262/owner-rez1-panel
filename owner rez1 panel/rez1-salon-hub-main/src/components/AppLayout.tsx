import { ReactNode, useState, useEffect } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { supabase } from "@/lib/supabase";
import SuspendedPage from "@/pages/SuspendedPage";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Store } from "lucide-react";
import { primeAudioContext } from "@/hooks/use-notification-sound";
import { BookingNotification } from "./BookingNotification";

export function AppLayout({ children }: { children: ReactNode }) {
  const [salons, setSalons] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const loadSalons = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("salons").select("id, name, is_approved").eq("owner_id", user.id).order("created_at");
      if (data) {
         setSalons(data.filter(s => s.is_approved));
         const savedIdx = parseInt(localStorage.getItem("rez1-active-salon-idx") || "0");
         setActiveIdx(Math.min(savedIdx, data.length - 1 < 0 ? 0 : data.length - 1));
      }
    };
    loadSalons();

    const handleChanged = () => {
      const savedIdx = parseInt(localStorage.getItem("rez1-active-salon-idx") || "0");
      setActiveIdx(savedIdx);
    };
    window.addEventListener("salon-changed", handleChanged);
    return () => window.removeEventListener("salon-changed", handleChanged);
  }, []);

  // Prime audio context globally on first interaction
  useEffect(() => {
    const prime = () => primeAudioContext();
    window.addEventListener("click", prime, { once: true });
    window.addEventListener("touchstart", prime, { once: true });
    return () => {
      window.removeEventListener("click", prime);
      window.removeEventListener("touchstart", prime);
    };
  }, []);

  // BookingNotification component handles all realtime alerts + sounds (see below)

  return (
    <div className="flex min-h-screen w-full" onClick={primeAudioContext} onTouchStart={primeAudioContext}>
      {/* Global booking notification + sound listener — mounted once for all pages */}
      <BookingNotification />
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0">
        {/* Mobile Salon Switcher Header */}
        <div className="md:hidden sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter leading-none">My Salon</span>
              <span className="text-sm font-bold truncate max-w-[150px]">{salons[activeIdx]?.name}</span>
            </div>
          </div>

          {/* Only show switcher when owner has more than 1 approved salon */}
          {salons.length > 1 && (
            <Select
              value={salons[activeIdx]?.id}
              onValueChange={(val) => {
                const globalIdx = salons.findIndex(s => s.id === val);
                if(globalIdx !== -1) {
                   localStorage.setItem("rez1-active-salon-idx", globalIdx.toString());
                   window.dispatchEvent(new Event("salon-changed"));
                }
                window.location.reload();
              }}
            >
              <SelectTrigger className="w-10 h-10 rounded-xl bg-accent border-none p-0 flex items-center justify-center">
                <Store className="h-4 w-4 text-muted-foreground" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover shadow-xl mr-4">
                {salons.map((salon, i) => (
                  <SelectItem key={salon.id} value={salon.id} className="rounded-lg focus:bg-primary/10 focus:text-primary">
                    <div className="flex flex-col py-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Salon {i + 1}</span>
                      <span className="text-sm">{salon.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {children}
      </main>
      <BottomNav />
    </div>
  );
}
