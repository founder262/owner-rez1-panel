import { LayoutDashboard, CalendarClock, BookOpen, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/slots", icon: CalendarClock, label: "Slots" },
  { to: "/bookings", icon: BookOpen, label: "Bookings" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
