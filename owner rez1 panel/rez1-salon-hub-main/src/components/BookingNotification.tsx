import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Volume2 } from "lucide-react";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { addNotification } from "@/pages/NotificationsPage";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Convert 24-hour "HH:MM" → 12-hour "H:MM AM/PM" — safe to call on already-formatted times */
const formatSlotLabel = (time: string): string => {
  if (!time) return "";
  if (time.includes("AM") || time.includes("PM")) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

interface BookingAlert {
  id: string;
  customerName: string;
  service: string;
  time: string;
  isCancellation: boolean;
}

export function BookingNotification() {
  const [notifications, setNotifications] = useState<BookingAlert[]>([]);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const { playBookingSound } = useNotificationSound();

  // Track the last alert ID we've already processed (to avoid duplicates between realtime + polling)
  const lastSeenIdRef = useRef<string | null>(null);
  const salonIdsRef = useRef<string[]>([]);

  // Fetch all salon IDs owned by this user
  const loadSalonIds = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: salons } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id);
    const ids = salons?.map(s => s.id) || [];
    salonIdsRef.current = ids;
    return ids;
  }, []);

  // Process a new alert — deduplicated by ID
  const handleNewAlert = useCallback(async (newAlert: any) => {
    if (!newAlert?.id) return;
    if (lastSeenIdRef.current === newAlert.id) return;
    lastSeenIdRef.current = newAlert.id;

    const isCancellation = (newAlert.customer_name || "").includes("❌") || 
                           (newAlert.customer_name || "").toLowerCase().includes("cancel");

    let formattedTime = formatSlotLabel(newAlert.slot_time || newAlert.booking_time || "");

    // Fetch the actual booking date from the bookings table to display in the notification
    if (newAlert.booking_id) {
      try {
        const { data } = await supabase
          .from("bookings")
          .select("booking_date")
          .eq("id", newAlert.booking_id)
          .maybeSingle();
        if (data?.booking_date) {
          formattedTime += ` • ${new Date(data.booking_date).toLocaleDateString()}`;
        }
      } catch (err) {
        console.error("Failed to fetch booking date for alert:", err);
      }
    }

    const alertUi: BookingAlert = {
      id: newAlert.id,
      customerName: newAlert.customer_name || "Customer",
      service: newAlert.service_summary || "Service",
      time: formattedTime,
      isCancellation,
    };

    setNotifications(prev => [alertUi, ...prev].slice(0, 5));
    addNotification({ customerName: alertUi.customerName, service: alertUi.service, time: alertUi.time });

    // Update notification bell count
    window.dispatchEvent(new CustomEvent("rez1-notification-update", { detail: alertUi }));
    // Refresh dashboard stats / booking lists
    window.dispatchEvent(new Event("rez1-dashboard-reload"));

    // Try to play sound — if it fails due to browser policy, show unlock button
    // CRITICAL: ONLY play sound if it is NOT a cancellation alert!
    if (!isCancellation) {
      try {
        playBookingSound(alertUi.time, alertUi.service);
      } catch {
        setNeedsAudioUnlock(true);
      }
    }
  }, [playBookingSound]);

  // Preload voices
  useEffect(() => {
    if ("speechSynthesis" in window) speechSynthesis.getVoices();

    // Expose test function
    (window as any).__rez1_test_notification = (time?: string) => {
      const slotTime = time || "10:30 AM";
      handleNewAlert({ id: Date.now().toString(), customer_name: "Test Customer", service_summary: "Haircut", slot_time: slotTime });
    };
    return () => { delete (window as any).__rez1_test_notification; };
  }, [handleNewAlert]);

  // === REALTIME SUBSCRIPTION ===
  useEffect(() => {
    let active = true;
    let activeChannels: ReturnType<typeof supabase.channel>[] = [];

    const initRealtime = async () => {
      const salonIds = await loadSalonIds();
      if (!active || salonIds.length === 0) return;

      // Subscribe to ALL salons owned by this user
      salonIds.forEach(salonId => {
        const uniqueChannelId = Math.random().toString(36).substring(2, 9);
        const ch = supabase
          .channel(`booking-alerts-${salonId}-${uniqueChannelId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "owner_booking_alerts",
              filter: `salon_id=eq.${salonId}`,
            },
            (payload) => {
              if (active) handleNewAlert(payload.new);
            }
          )
          .subscribe((status) => {
            console.log(`[BookingNotification] Realtime channel ${salonId}:`, status);
          });
        activeChannels.push(ch);
      });
    };

    initRealtime();
    return () => {
      active = false;
      activeChannels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [loadSalonIds, handleNewAlert]);

  // === POLLING FALLBACK (every 20 seconds) ===
  // Guarantees notifications even if WebSocket realtime connection drops
  useEffect(() => {
    const poll = async () => {
      const salonIds = salonIdsRef.current;
      if (salonIds.length === 0) {
        await loadSalonIds();
        return;
      }

      // Fetch the latest unread alert we haven't seen yet
      const { data } = await supabase
        .from("owner_booking_alerts")
        .select("*")
        .in("salon_id", salonIds)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.id !== lastSeenIdRef.current) {
        handleNewAlert(data);
      }
    };

    // Run immediately, then every 20 seconds
    const timer = setInterval(poll, 20000);
    // Small delay on first run to let realtime connect first
    const firstRun = setTimeout(poll, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(firstRun);
    };
  }, [loadSalonIds, handleNewAlert]);

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Mark as read in DB
    supabase.from("owner_booking_alerts").update({ is_read: true }).eq("id", id).then(() => {});
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {/* Audio unlock button — shown if browser blocked autoplay */}
      {needsAudioUnlock && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto rounded-xl border border-primary/40 bg-card p-3 shadow-lg flex items-center gap-3"
        >
          <Volume2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-foreground flex-1">Tap to enable booking sounds</p>
          <button
            onClick={() => {
              playBookingSound("now");
              setNeedsAudioUnlock(false);
            }}
            className="text-xs font-bold text-primary hover:underline"
          >
            Enable
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            className={cn(
              "pointer-events-auto rounded-xl border p-4 shadow-lg",
              n.isCancellation 
                ? "border-red-500/30 bg-card" 
                : "border-primary/30 bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                n.isCancellation 
                  ? "bg-red-500/10" 
                  : "bg-primary/10 animate-pulse"
              )}>
                {n.isCancellation ? (
                  <X className="h-4 w-4 text-red-500" />
                ) : (
                  <Bell className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">
                  {n.isCancellation ? "❌ Booking Cancelled" : "🔔 New Booking!"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {/* Strip the emoji prefix from customerName if it exists for rendering */}
                  {n.customerName.replace("❌ ", "")} — {n.service}
                </p>
                <p className={cn(
                  "text-xs mt-1 font-medium",
                  n.isCancellation ? "text-red-400" : "text-primary"
                )}>
                  {n.time}
                </p>
              </div>
              <button onClick={() => dismiss(n.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
