import { LayoutDashboard, CalendarClock, BookOpen, Settings, Scissors, ChevronDown, Store } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useState, useEffect } from "react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/slots", icon: CalendarClock, label: "Slots" },
  { to: "/bookings", icon: BookOpen, label: "Bookings" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function DesktopSidebar() {
  const { theme, toggleTheme } = useTheme();
  const [salons, setSalons] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const loadSalons = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("salons").select("id, name, is_approved").eq("owner_id", user.id).order("created_at");
      if (data) {
         const approved = data.filter(s => s.is_approved);
         setSalons(approved);
         // Clamp saved index — prevents stale index from old multi-salon sessions
         const savedIdx = parseInt(localStorage.getItem("rez1-active-salon-idx") || "0");
         const clampedIdx = Math.min(savedIdx, Math.max(approved.length - 1, 0));
         if (clampedIdx !== savedIdx) {
           localStorage.setItem("rez1-active-salon-idx", clampedIdx.toString());
         }
         setActiveIdx(clampedIdx);
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

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border bg-card h-screen sticky top-0">
      <div className="flex flex-col gap-4 px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center">
            <img src="/rez1-logo.svg" alt="REZ1 Logo" className="h-full w-full" />
          </div>
          <div>
            <img src="/rez1-text.svg" alt="REZ1" className="h-5" />
            <p className="text-xs text-muted-foreground mt-0.5">Owner Panel</p>
          </div>
        </div>

        <div className="mt-2">
          {salons.length > 0 ? (
            <Select 
              value={salons[activeIdx]?.id} 
              onValueChange={(val) => {
                const globalIdx = salons.findIndex(s => s.id === val);
                if(globalIdx !== -1) {
                   localStorage.setItem("rez1-active-salon-idx", globalIdx.toString());
                   window.dispatchEvent(new Event("salon-changed"));
                }
                window.location.reload(); // Hard reload to refresh references
              }}
            >
              <SelectTrigger className="w-full h-12 bg-accent/50 border-border rounded-xl px-3 hover:bg-accent transition-colors animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-left truncate">
                  <Store className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Active Salon</span>
                    <span className="text-sm font-semibold truncate leading-tight">{salons[activeIdx]?.name}</span>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover shadow-gold-sm">
                {salons.map((salon) => (
                  <SelectItem key={salon.id} value={salon.id} className="rounded-lg focus:bg-primary/10 focus:text-primary">
                    <div className="flex flex-col py-0.5">
                      <span className="text-sm">{salon.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="w-full h-12 bg-accent/30 border border-dashed border-border rounded-xl px-3 flex items-center gap-2 select-none opacity-70">
              <Store className="h-4 w-4 text-muted-foreground shrink-0 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Active Salon</span>
                <span className="text-xs text-muted-foreground leading-tight">Loading salon...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </aside>
  );
}
