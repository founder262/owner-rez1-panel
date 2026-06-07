import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Power,
  CalendarClock,
  Sun,
  Moon,
  Bell,
  Tag,
  Percent,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { addNotification, getUnreadCount } from "@/pages/NotificationsPage";
import { OfferSettings } from "@/components/OfferSettings";
import { useNotificationSound } from "@/hooks/use-notification-sound";

/** Convert 24-hour "HH:MM" → 12-hour "H:MM AM/PM" */
const formatSlotLabel = (time: string): string => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

export default function DashboardPage() {
  const [salon, setSalon] = useState<any>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [nextBooking, setNextBooking] = useState<any>(null);
  const [stats, setStats] = useState({ today: 0, week: 0, completed: 0 });
  const [activeSalonIndex, setActiveSalonIndex] = useState(0);
  const [allSalons, setAllSalons] = useState<any[]>([]);

  // Stable ref so realtime callback can call it without recreating subscriptions
  const loadDashboardRef = useRef<() => Promise<void>>();

  const loadDashboard = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: salonsData } = await supabase
      .from("salons")
      .select("*, salon_offers(*)")
      .eq("owner_id", user.id)
      .order("created_at");
    setAllSalons(salonsData || []);

    const activeSalon = salonsData?.[activeSalonIndex];
    if (!activeSalon) {
      // No salons found — owner needs to register their salon
      navigate("/register");
      return;
    }
    setSalon(activeSalon);
    setEmergencyMode(activeSalon.is_emergency_mode || false);

    // 12-hour emergency check
    if (activeSalon.is_emergency_mode) {
      const emergencyStartedAt = localStorage.getItem(`emergency_start_${activeSalon.id}`);
      if (emergencyStartedAt) {
        const startedTime = new Date(emergencyStartedAt).getTime();
        const twelveHoursInMs = 12 * 60 * 60 * 1000;
        if (Date.now() - startedTime > twelveHoursInMs) {
          setShowEmergencyModal(true);
        }
      }
    }

    const { data: unreadRes } = await supabase.functions.invoke("admin-api", {
      body: {
        action: "SELECT",
        table: "owner_booking_alerts",
        filters: [
          { column: "salon_id", value: activeSalon.id },
          { column: "is_read", value: false }
        ]
      }
    });
    setUnreadCount((unreadRes?.data || []).length);

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    // Use admin-api (service role) to bypass RLS on bookings table
    const { data: allBookingsRes } = await supabase.functions.invoke(
      "admin-api",
      {
        body: {
          action: "SELECT",
          table: "bookings",
          query: "*, customers(full_name, phone)",
          filters: [{ column: "salon_id", value: activeSalon.id }],
        },
      },
    );
    const allBookings: any[] = allBookingsRes?.data || [];

    const todayBookingsList = allBookings.filter(
      (b: any) => b.booking_date === today && b.status !== "cancelled",
    );
    const weekCount = allBookings.filter(
      (b: any) => b.booking_date >= weekAgoStr,
    ).length;
    const completedCount = allBookings.filter(
      (b: any) => b.status === "completed",
    ).length;

    const upcomingBookings = allBookings
      .filter((b: any) => b.booking_date >= today && b.status === "upcoming")
      .sort((a: any, b: any) =>
        `${a.booking_date}T${a.booking_time}`.localeCompare(
          `${b.booking_date}T${b.booking_time}`,
        ),
      );

    setStats({
      today: todayBookingsList.length,
      week: weekCount,
      completed: completedCount,
    });
    setTodayBookings(todayBookingsList);
    setNextBooking(upcomingBookings[0] || null);
  }, [activeSalonIndex]);

  // Keep ref in sync with latest callback
  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const handleReload = () => loadDashboardRef.current?.();
    window.addEventListener("rez1-dashboard-reload", handleReload);
    return () => window.removeEventListener("rez1-dashboard-reload", handleReload);
  }, []);

  useEffect(() => {
    const handler = () => setUnreadCount(prev => prev + 1);
    window.addEventListener("rez1-notification-update", handler);
    return () =>
      window.removeEventListener("rez1-notification-update", handler);
  }, []);

  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { playBookingSound } = useNotificationSound();
  const navigate = useNavigate();

  const getCurrentOffer = () => {
    // Rely on dynamic database property instead of mock-data
    if (!salon || !salon.salon_offers || salon.salon_offers.length === 0)
      return null;
    const offer = salon.salon_offers[0];

    switch (offer.active_type) {
      case "all_days":
        return (offer.all_days_percentage || 0) > 0
          ? `${offer.all_days_percentage}% OFF on all services`
          : null;
      case "specific_day": {
        const today = new Date().toISOString().split("T")[0];
        return offer.specific_day_date === today &&
          (offer.specific_day_percentage || 0) > 0
          ? `${offer.specific_day_percentage}% OFF - Today only!`
          : null;
      }
      case "weekday_weekend": {
        const day = new Date().getDay();
        const isWeekend = day === 0 || day === 6;
        const pct = isWeekend
          ? offer.weekend_percentage || 0
          : offer.weekday_percentage || 0;
        return pct > 0
          ? `${pct}% OFF - ${isWeekend ? "Weekend" : "Weekday"} Special`
          : null;
      }
      default:
        return null;
    }
  };

  const handleEmergency = async (isExtension = false) => {
    setEmergencyMode(true);
    setShowEmergencyModal(false);
    if (salon) {
      // 1. Update salon status to emergency mode
      await supabase
        .from("salons")
        .update({ is_emergency_mode: true })
        .eq("id", salon.id);

      // Save start time
      localStorage.setItem(`emergency_start_${salon.id}`, new Date().toISOString());

      // 2. Fetch all upcoming/today bookings that are NOT yet cancelled
      const today = new Date().toISOString().split("T")[0];
      const { data: upcomingRes } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "SELECT",
          table: "bookings",
          query: "*",
          filters: [{ column: "salon_id", value: salon.id }],
        },
      });

      const now = new Date();
      const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      const upcomingBookings = (upcomingRes?.data || []).filter(
        (b: any) => {
          if (b.status === "cancelled" || b.status === "completed") return false;
          
          const bookingDateStr = b.booking_date;
          const bookingTimeStr = b.booking_time;
          if (!bookingDateStr || !bookingTimeStr) return false;

          const match = bookingTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (!match) return false;
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const ampm = match[3]?.toUpperCase();
          if (ampm === "PM" && h < 12) h += 12;
          if (ampm === "AM" && h === 12) h = 0;
          
          const bookingDateTime = new Date(`${bookingDateStr}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
          return bookingDateTime >= now && bookingDateTime <= twelveHoursFromNow;
        }
      );

      // 3. Cancel each booking for the next 12 hours via cancel-booking function
      for (const booking of upcomingBookings) {
        await supabase.functions.invoke("cancel-booking", {
          body: {
            booking_id: booking.id,
            cancelled_by: "emergency",
            cancel_reason: `Emergency closure by ${salon.name}`,
          },
        });
      }
    }
    toast({
      title: "🚨 Emergency Mode Activated",
      description: `Bookings for the next 12 hours cancelled. Customers have been notified.`,
      variant: "destructive",
    });
  };

  const handleDeactivateEmergency = async () => {
    setEmergencyMode(false);
    setShowEmergencyModal(false);
    if (salon) {
      localStorage.removeItem(`emergency_start_${salon.id}`);
      await supabase
        .from("salons")
        .update({ is_emergency_mode: false })
        .eq("id", salon.id);
    }
    toast({ title: "Emergency mode deactivated" });
  };

  const isDuringBusinessHours = () => {
    if (!salon || !salon.open_time || !salon.close_time) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    const parseTime = (timeStr: string) => {
      if (!timeStr) return 0;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    
    const openMins = parseTime(salon.open_time);
    const closeMins = parseTime(salon.close_time);
    return currentMins >= openMins && currentMins <= closeMins;
  };

  if (!salon)
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-screen">
        Loading dashboard...
      </div>
    );

  return (
    <AppLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{salon.name}</h1>
            <p className="text-sm text-muted-foreground">{salon.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={toggleTheme}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {showEmergencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full text-center space-y-4"
            >
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h3 className="text-xl font-bold">12 Hours Passed</h3>
              <p className="text-sm text-muted-foreground">
                Your shop has been in Emergency Close for 12 hours. Do you want to reopen the shop or keep it closed? (Keeping it closed will cancel bookings for the next 12 hours).
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" onClick={handleDeactivateEmergency}>
                  Reopen Shop
                </Button>
                <Button variant="destructive" onClick={() => handleEmergency(true)}>
                  Keep Closed
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {emergencyMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse-soft" />
              <div>
                <p className="font-semibold text-destructive">
                  Emergency Mode Active
                </p>
                <p className="text-xs text-muted-foreground">
                  Bookings paused
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeactivateEmergency}
            >
              Deactivate
            </Button>
          </motion.div>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${isDuringBusinessHours() ? "bg-primary animate-pulse-soft" : "bg-muted-foreground"}`}
              />
              <span className="font-semibold text-lg">
                {isDuringBusinessHours() ? "Shop Open" : "Shop Closed"}
              </span>
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {salon.open_time} - {salon.close_time}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayBookings.length}</p>
                <p className="text-xs text-muted-foreground">
                  Today's Bookings
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{salon.total_seats}</p>
                <p className="text-xs text-muted-foreground">Total Seats</p>
              </div>
            </div>
          </Card>
        </div>

        {nextBooking && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Next Booking</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {nextBooking.customers?.full_name || "Guest Customer"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nextBooking.services?.[0]?.name || "Service"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">
                  {formatSlotLabel(nextBooking.booking_time)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextBooking.duration_minutes} min
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Promotions & Offers Workflow */}
        <OfferSettings />

        <div className="space-y-3">
          <h2 className="font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="min-h-[56px] h-auto py-2 px-2 sm:px-4 justify-center sm:justify-start gap-1.5 sm:gap-3 text-xs sm:text-sm"
              onClick={() => navigate("/slots")}
            >
              <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="whitespace-normal text-center sm:text-left leading-tight">
                Manage Slots
              </span>
            </Button>
            <Button
              variant="outline"
              className="min-h-[56px] h-auto py-2 px-2 sm:px-4 justify-center sm:justify-start gap-1.5 sm:gap-3 text-[11px] sm:text-sm border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleEmergency}
              disabled={emergencyMode}
            >
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="whitespace-normal text-center sm:text-left leading-tight">
                Emergency Close
              </span>
            </Button>
            <Button
              variant="outline"
              className="min-h-[56px] h-auto py-2 px-3 justify-center gap-2 text-xs sm:text-sm col-span-2 border-secondary/30 text-secondary hover:bg-secondary/10"
              onClick={() => {
                const testTime = "10:30 AM";
                addNotification({
                  customerName: "Test Customer",
                  service: "Haircut",
                  time: testTime,
                });
                playBookingSound(testTime);
                toast({
                  title: "🔔 New Booking!",
                  description: `Slot booked for ${testTime}`,
                });
              }}
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="whitespace-normal text-center leading-tight">
                Test Booking Notification
              </span>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
