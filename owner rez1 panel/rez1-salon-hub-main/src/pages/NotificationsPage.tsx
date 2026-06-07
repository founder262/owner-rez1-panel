import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Bell, Clock, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Convert 24-hour "HH:MM" → 12-hour "H:MM AM/PM" */
const formatSlotLabel = (time: string): string => {
  if (!time) return "";
  // Already formatted (e.g. "7:30 PM") — return as-is
  if (time.includes("AM") || time.includes("PM")) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

export const addNotification = (n: any) => {
  // Legacy stub for BookingNotification.tsx so it doesn't break,
  // real implementation saves directly to DB and triggers realtime on client
};

export const getUnreadCount = (): number => {
  return 0; // Legacy stub
};

export const markAllRead = () => {
  // Legacy stub
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [salonIds, setSalonIds] = useState<string[]>([]);
  const [dismissedBroadcasts, setDismissedBroadcasts] = useState<string[]>(() => {
    const stored = localStorage.getItem('rez1-owner-dismissed-notifs');
    return stored ? JSON.parse(stored) : [];
  });

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Fetch all salons owned by this user via admin-api SELECT to prevent RLS issues
    const { data: salonsRes } = await supabase.functions.invoke("admin-api", {
      body: {
        action: "SELECT",
        table: "salons",
        filters: [{ column: "owner_id", value: user.id }]
      }
    });
    const salons = salonsRes?.data || [];
    if (salons.length === 0) return;
    
    const ids = salons.map((s: any) => s.id);
    setSalonIds(ids);

    // 1. Fetch booking alerts (new bookings) via admin-api to bypass RLS
    let alerts: any[] = [];
    for (const salonId of ids) {
      const { data: alertsRes } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "SELECT",
          table: "owner_booking_alerts",
          filters: [{ column: "salon_id", value: salonId }]
        }
      });
      if (alertsRes?.data) {
        alerts = [...alerts, ...alertsRes.data];
      }
    }

    // 2. Fetch all notifications via admin-api
    const { data: broadcastsRes } = await supabase.functions.invoke("admin-api", {
      body: {
        action: "SELECT",
        table: "notifications",
        query: "*"
      }
    });
    const allNotifs = broadcastsRes?.data || [];

    // 2a. Broadcast notifications (from admin to all owners / all users)
    const broadcasts = allNotifs.filter((b: any) =>
      ["broadcast_owners", "broadcast_all"].includes(b.target_type)
    );

    // 2b. Direct cancellation notifications sent to this owner's user ID
    const directOwnerNotifs = allNotifs.filter((b: any) =>
      b.target_id === user.id &&
      (b.target_type === "individual" || b.target_type === "broadcast_owners")
    );

    // 1b. Fetch booking dates for these alerts
    const bookingIds = alerts.map(a => a.booking_id).filter(Boolean);
    let bookingDates: Record<string, string> = {};
    if (bookingIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("id, booking_date")
        .in("id", bookingIds);
      if (bookingsData) {
        bookingsData.forEach(b => {
          if (b.booking_date) bookingDates[b.id] = b.booking_date;
        });
      }
    }

    const combined = [
      // Booking alerts (new bookings) — shown as "New Booking"
      ...alerts.map((a: any) => {
        const bDate = bookingDates[a.booking_id];
        const dateStr = bDate ? new Date(bDate).toLocaleDateString() : "";
        return {
          ...a,
          _kind: "alert",
          actual_booking_date: dateStr, // Attach actual date
        };
      }),
      // Direct owner notifications (cancellations from customer)
      ...directOwnerNotifs.map((n: any) => ({
        id: n.id,
        _kind: "direct",
        _type: n.title?.includes("Cancelled") ? "booking_cancelled" : "booking_created",
        customer_name: n.title,
        service_summary: n.message,
        booking_time: "",
        created_at: n.created_at,
        is_read: n.is_read,
      })),
      // System broadcasts
      ...broadcasts.map((b: any) => ({
        id: b.id,
        _kind: "broadcast",
        customer_name: "Rez1 System",
        service_summary: b.title,
        booking_time: b.message,
        created_at: b.created_at,
      }))
    ];

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(combined);
  };

  useEffect(() => { 
    loadNotifications(); 
    // Smart Polling: Fetch notifications every 5 seconds silently in the background
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const clearAll = async () => {
    // Delete booking alerts
    const alertIds = notifications.filter(n => n._kind === "alert").map(n => n.id);
    for (const alertId of alertIds) {
      await supabase.functions.invoke("admin-api", {
        body: { action: "DELETE", table: "owner_booking_alerts", id: alertId }
      });
    }
    // Mark direct notifications as read
    const directIds = notifications.filter(n => n._kind === "direct").map(n => n.id);
    for (const nId of directIds) {
      await supabase.functions.invoke("admin-api", {
        body: { action: "UPDATE", table: "notifications", id: nId, data: { is_read: true } }
      });
    }
    // Dismiss broadcasts locally
    const broadcastIds = notifications.filter(n => n._kind === "broadcast").map(n => n.id);
    const updatedDismissed = [...new Set([...dismissedBroadcasts, ...broadcastIds])];
    setDismissedBroadcasts(updatedDismissed);
    localStorage.setItem('rez1-owner-dismissed-notifs', JSON.stringify(updatedDismissed));
    setNotifications([]);
  };

  const removeOne = async (n: any) => {
    const updated = notifications.filter((item) => item.id !== n.id);
    setNotifications(updated);
    if (n._kind === "broadcast") {
      const updatedDismissed = [...dismissedBroadcasts, n.id];
      setDismissedBroadcasts(updatedDismissed);
      localStorage.setItem('rez1-owner-dismissed-notifs', JSON.stringify(updatedDismissed));
    } else if (n._kind === "direct") {
      await supabase.functions.invoke("admin-api", {
        body: { action: "UPDATE", table: "notifications", id: n.id, data: { is_read: true } }
      });
    } else {
      await supabase.functions.invoke("admin-api", {
        body: { action: "DELETE", table: "owner_booking_alerts", id: n.id }
      });
    }
  };

  const visibleNotifications = notifications.filter(n =>
    n._kind !== "broadcast" || !dismissedBroadcasts.includes(n.id)
  );

  return (
    <AppLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          {visibleNotifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground gap-2">
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {visibleNotifications.length === 0 ? (
          <Card className="p-12 flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll see booking alerts here when customers book slots.
            </p>
          </Card>
        ) : (
          <AnimatePresence>
            {visibleNotifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                layout
              >
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon: red X for cancellations, gold bell for new bookings/broadcasts */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      n._kind === "direct" && n._type === "booking_cancelled"
                        ? "bg-red-500/10"
                        : "bg-primary/10"
                    }`}>
                      {n._kind === "direct" && n._type === "booking_cancelled" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Bell className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <p className={`font-semibold text-sm ${
                        n._kind === "direct" && n._type === "booking_cancelled" ? "text-red-500" : ""
                      }`}>
                        {n._kind === "alert" ? "🔔 New Booking" :
                         n._kind === "direct" ? n.customer_name :
                         n.service_summary}
                      </p>
                      {/* Body */}
                      <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                        {n._kind === "alert"
                          ? `${n.customer_name} — ${n.service_summary}`
                          : n._kind === "direct"
                            ? n.service_summary
                            : n.booking_time}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-primary" />
                        {n._kind === "alert" ? (
                          <span className="text-xs font-medium text-primary">
                            {formatSlotLabel(n.booking_time)} {n.actual_booking_date ? `• ${n.actual_booking_date}` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                        )}
                        {n._kind === "alert" && (
                           <span className="text-xs text-muted-foreground ml-auto opacity-70">
                             Booked: {new Date(n.created_at).toLocaleString()}
                           </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeOne(n)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
}
