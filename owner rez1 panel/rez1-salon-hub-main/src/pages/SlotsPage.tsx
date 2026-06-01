import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import { Lock, Unlock, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const getDayLabel = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const getDateKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

/**
 * Normalizes any time string to the slot key format: "H:MM AM/PM"
 * Handles: "09:30", "9:30", "9:30 AM", "09:30 PM"
 */
const normalizeToSlotKey = (t: string): string => {
  if (!t) return "";
  // Already has AM/PM → just normalize spacing
  const upper = t.trim().toUpperCase();
  const ampmMatch = upper.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10);
    const mm = ampmMatch[2];
    const ap = ampmMatch[3];
    return `${h}:${mm} ${ap}`;
  }
  // 24-hour format "HH:MM" or "H:MM"
  const parts = t.split(":");
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const mm = parts[1].slice(0, 2).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    const hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hr12}:${mm} ${ap}`;
  }
  return t;
};

export default function SlotsPage() {
  const [dayOffset, setDayOffset] = useState(0);
  const dateKey = getDateKey(dayOffset);
  const { toast } = useToast();
  
  const [salon, setSalon] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);

  const loadSlots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch user salon
      const { data: salonData } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!salonData) {
        console.log("No salon found for user", user.id);
        return;
      }
      setSalon(salonData);
      
      // Generate base times from salonData open_time, close_time
      const baseGenerator = [];
      
      let openHour = parseInt(salonData.open_time?.split(':')[0] || "10", 10);
      const openStr = (salonData.open_time || "").toLowerCase();
      if (openStr.includes("pm") && openHour < 12) openHour += 12;
      if (openStr.includes("am") && openHour === 12) openHour = 0;

      let closeHour = parseInt(salonData.close_time?.split(':')[0] || "8", 10);
      const closeStr = (salonData.close_time || "08:00 pm").toLowerCase();
      if (closeStr.includes("pm") && closeHour < 12) closeHour += 12;
      if (closeStr.includes("am") && closeHour === 12) closeHour = 0;

      if (openHour > closeHour) closeHour += 24;

      // Safety check to prevent infinite or massive loops
      if (isNaN(openHour) || isNaN(closeHour)) {
        openHour = 10;
        closeHour = 20;
      }

      const duration = salonData.slot_duration || 30;

      for (let h = openHour; h <= closeHour; h++) {
        const realH = h % 24;
        for (let m = 0; m < 60; m += duration) {
           const ampm = realH >= 12 ? "PM" : "AM";
           const hr12 = realH > 12 ? realH - 12 : (realH === 0 ? 12 : realH);
           const timeStr = `${hr12}:${m === 0 ? "00" : m} ${ampm}`;
           
           baseGenerator.push({
              id: timeStr,
              time: timeStr,
              status: "available",
              totalSeats: salonData.total_seats || 4,
              bookedSeats: 0
           });
        }
      }

      // Overlay owner-controlled slot status (blocked/available overrides)
      const { data: dbSlots } = await supabase
         .from("slots")
         .select("*")
         .eq("salon_id", salonData.id)
         .eq("slot_date", dateKey);

      // Build a map of owner-blocked slots
      const blockedTimes = new Set<string>();
      if (dbSlots) {
         for (const dbSlot of dbSlots) {
            if (dbSlot.status === "blocked") {
              blockedTimes.add(dbSlot.slot_time);
            }
         }
      }

      // Fetch real bookings for this date to compute occupied seats
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("booking_time, person_count")
        .eq("salon_id", salonData.id)
        .eq("booking_date", dateKey)
        .neq("status", "cancelled");

      if (bookingsError) {
        console.error("Bookings fetch error:", bookingsError);
      }

      // Aggregate bookedSeats per slot time — normalize DB time to slot key format
      const seatsByTime: Record<string, number> = {};
      if (bookingsData) {
        for (const bk of bookingsData) {
          const t = normalizeToSlotKey(bk.booking_time);
          if (t) {
            seatsByTime[t] = (seatsByTime[t] || 0) + (bk.person_count || 1);
          }
        }
      }

      // Overlay seat counts and derive status
      for (const slot of baseGenerator) {
        const bookedSeats = seatsByTime[slot.time] || 0;
        slot.bookedSeats = bookedSeats;

        if (blockedTimes.has(slot.time)) {
          slot.status = "blocked";
        } else if (bookedSeats >= slot.totalSeats) {
          slot.status = "full";
        } else if (bookedSeats > 0) {
          slot.status = "partial";
        } else {
          slot.status = "available";
        }
      }

      setSlots(baseGenerator);
    } catch (err) {
      console.error("loadSlots error:", err);
      toast({ title: "Error loading slots", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadSlots();
  }, [dateKey]);

  const toggleSlot = async (slotTime: string, currentStatus: string) => {
    if (!salon) return;
    const newStatus = currentStatus === "blocked" ? "available" : "blocked";
    
    // Optimistic
    setSlots(prev => prev.map(s => s.time === slotTime ? { ...s, status: newStatus } : s));

    const { error } = await supabase
       .from("slots")
       .upsert({
           salon_id: salon.id,
           slot_date: dateKey,
           slot_time: slotTime,
           status: newStatus
       }, { onConflict: "salon_id,slot_date,slot_time" });

    if (error) {
       toast({ title: "Failed to update slot", variant: "destructive" });
       loadSlots();
    } else {
       toast({ title: "Slot updated" });
    }
  };

  const closeFullDay = async () => {
    if (!salon) return;
    setSlots(prev => prev.map(s => ({ ...s, status: "blocked" })));
    toast({ title: `Blocking all slots for ${getDayLabel(dayOffset)}...` });
    
    const upserts = slots.map(s => ({
        salon_id: salon.id,
        slot_date: dateKey,
        slot_time: s.time,
        status: "blocked"
    }));

    await supabase.from("slots").upsert(upserts, { onConflict: "salon_id,slot_date,slot_time" });
  };

  const openFullDay = async () => {
    if (!salon) return;
    setSlots(prev => prev.map(s => ({ ...s, status: "available" })));
    toast({ title: `Opening slots for ${getDayLabel(dayOffset)}...` });
    
    // We can delete the blocks or upsert 'available'
    const upserts = slots.map(s => ({
        salon_id: salon.id,
        slot_date: dateKey,
        slot_time: s.time,
        status: "available"
    }));

    await supabase.from("slots").upsert(upserts, { onConflict: "salon_id,slot_date,slot_time" });
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Slot Management</h1>

        {/* Day Selector */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            disabled={dayOffset === 0}
            onClick={() => setDayOffset((d) => d - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-lg">{getDayLabel(dayOffset)}</p>
            <p className="text-xs text-muted-foreground">{dateKey}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={dayOffset >= 2}
            onClick={() => setDayOffset((d) => d + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={closeFullDay}>
            <Ban className="h-4 w-4" /> Close Day
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={openFullDay}>
            <Unlock className="h-4 w-4" /> Open All
          </Button>
        </div>

        {/* Slot Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slot-available" /> Available</div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slot-partial" /> Filling</div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slot-full" /> Full</div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slot-blocked" /> Blocked</div>
        </div>

        {/* Slots Grid */}
        <div className="space-y-2">
          {slots.map((slot) => (
            <Card key={slot.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="min-w-[70px]">
                  <p className="font-semibold text-sm">{slot.time}</p>
                </div>
                <StatusBadge status={slot.status} />
                {slot.status !== "blocked" && (
                  <p className="text-xs text-muted-foreground">
                    {slot.bookedSeats}/{slot.totalSeats} seats
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleSlot(slot.time, slot.status)}
                className="shrink-0"
              >
                {slot.status === "blocked" ? (
                  <Unlock className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
