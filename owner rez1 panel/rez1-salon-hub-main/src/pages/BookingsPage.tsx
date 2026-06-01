import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Clock, Download, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
// @ts-ignore
import html2pdf from "html2pdf.js";

/** Convert 24-hour "HH:MM" → 12-hour "H:MM AM/PM" */
const formatSlotLabel = (time: string): string => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

/** Format booking date as "22 May 2026" */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

type Tab = "today" | "upcoming" | "completed" | "history";

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [bookings, setBookings] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const { toast } = useToast();

  const loadBookings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get salon id for this owner
    const { data: salons } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id);

    if (!salons || !salons.length) return;
    const salonId = salons[0].id;

    // Fetch all bookings for this salon using service role
    const { data: bookingsRes } = await supabase.functions.invoke("admin-api", {
      body: {
        action: "SELECT",
        table: "bookings",
        query: "*, customers(full_name, phone)",
        filters: [{ column: "salon_id", value: salonId }],
      },
    });
    const allBookings = bookingsRes?.data || [];
    // Sort by date asc, time asc
    allBookings.sort((a: any, b: any) => {
      const da = `${a.booking_date}T${a.booking_time}`;
      const db = `${b.booking_date}T${b.booking_time}`;
      return da.localeCompare(db);
    });
    setBookings(allBookings);
  };

  useEffect(() => {
    loadBookings();

    const handleReload = () => loadBookings();
    window.addEventListener("rez1-dashboard-reload", handleReload);
    return () => window.removeEventListener("rez1-dashboard-reload", handleReload);
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const filtered = bookings.filter((b) => {
    // Never show pending_payment bookings to owner — these are incomplete payment sessions
    if (b.status === "pending_payment") return false;

    if (tab === "today")
      return (
        b.booking_date === todayStr &&
        b.status !== "completed" &&
        b.status !== "cancelled" &&
        b.payment_status !== "pending"  // hide unconfirmed payment sessions
      );
    if (tab === "upcoming")
      return (
        b.booking_date > todayStr &&
        b.status !== "completed" &&
        b.status !== "cancelled" &&
        b.payment_status !== "pending"  // hide unconfirmed payment sessions
      );
    if (tab === "history") {
      if (!fromDate || !toDate) return b.status === "completed" || b.status === "cancelled";
      return (b.status === "completed" || b.status === "cancelled") && b.booking_date >= fromDate && b.booking_date <= toDate;
    }
    return b.status === "completed";
  });

  const downloadStatement = () => {
    const dataToDownload = filtered.length > 0 ? filtered : bookings.filter(b => b.status === "completed" || b.status === "cancelled");
    if (dataToDownload.length === 0) {
      toast({ title: "No history to download", variant: "destructive" });
      return;
    }

    const totalRevenue = dataToDownload.filter(b => b.status === "completed").reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const dateRangeStr = fromDate && toDate ? `From ${fromDate} to ${toDate}` : "All Time";

    toast({ title: "Generating PDF...", description: "Please wait while your statement is being prepared." });

    const htmlContent = `
      <div id="statement-container" style="font-family: 'Inter', sans-serif; color: #fff; padding: 40px; margin: 0; background: #0a0a0a; min-height: 1048px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; display: flex; justify-content: center; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" width="48" height="48">
                <circle cx="256" cy="256" r="256" fill="#cca352"/>
                <g transform="translate(106, 106) scale(12.5)" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                  <circle cx="6" cy="6" r="3"></circle>
                  <path d="M8.12 8.12 12 12"></path>
                  <path d="M20 4 8.12 15.88"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <path d="M14.8 14.8 20 20"></path>
                </g>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0; color: #fff;">REZ1</h2>
              <p style="font-size: 12px; color: #D2AC47; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Premium Salon Platform</p>
            </div>
          </div>
          <div style="text-align: right;">
            <h1 style="margin: 0; font-size: 28px; color: #fff;">Booking Statement</h1>
            <p style="margin: 4px 0 0; color: #888; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; background: #111; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #333;">
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600;">Period</p>
            <h3 style="margin: 0; font-size: 20px; color: #fff;">${dateRangeStr}</h3>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600;">Total Bookings</p>
            <h3 style="margin: 0; font-size: 20px; color: #fff;">${dataToDownload.length}</h3>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600;">Total Revenue</p>
            <h3 style="margin: 0; font-size: 20px; color: #D2AC47;">₹${totalRevenue}</h3>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Date & Time</th>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Customer</th>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Service</th>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Persons</th>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Amount</th>
              <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; background: #111; font-weight: 600; color: #D2AC47; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${dataToDownload.map((b, i) => `
              <tr style="background: ${i % 2 === 0 ? '#0a0a0a' : '#111'};">
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 14px;">
                  <div style="font-weight: 500; color: #fff;">${b.booking_date}</div>
                  <div style="color: #888; font-size: 12px;">${b.booking_time}</div>
                </td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 14px; font-weight: 500; color: #fff;">${b.customers?.full_name || "Guest"}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 14px; color: #ccc;">${b.services?.map((s:any) => s.name).join(", ") || "Service"}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 14px; color: #fff;">${b.person_count || 1}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 14px; font-weight: 600; color: #D2AC47;">₹${b.total_amount || 0}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-size: 12px; font-weight: 700; color: ${b.status === 'completed' ? '#22c55e' : '#ef4444'};">${b.status.toUpperCase()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px;">
          This is an automatically generated statement from REZ1 Dashboard.
        </div>
      </div>
    `;

    const element = document.createElement("div");
    element.innerHTML = htmlContent;

    const opt = {
      margin:       0,
      filename:     `REZ1_Statement_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg' as const, quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      toast({ title: "Download complete!" });
    });
  };

  const markCompleted = async (id: string) => {
    const booking = bookings.find(b => b.id === id);
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "completed" } : b)),
    );
    await supabase.functions.invoke("admin-api", {
      body: {
        action: "UPDATE",
        table: "bookings",
        id,
        data: { status: "completed" },
      },
    });
    
    if (booking?.customer_id) {
       await supabase.functions.invoke("admin-api", {
         body: {
           action: "INSERT",
           table: "notifications",
           data: {
             target_type: "broadcast_customers",
             target_id: booking.customer_id,
             title: "✅ Booking Completed",
             message: `Thank you for visiting ${booking.salons?.name || 'the salon'}! We hope you enjoyed your service. See you again!`,
             notif_type: "booking",
             is_read: false,
             sent_by_admin: null,
           }
         }
       });
    }

    toast({ title: "Booking marked as completed" });
    loadBookings();
  };

  const cancelBooking = async (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      const slotTimeStr = `${booking.booking_date}T${booking.booking_time.padStart(5, '0')}:00`;
      const slotTime = new Date(slotTimeStr);
      const now = new Date();
      const diffMs = slotTime.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);
      if (diffMins < 180) {
        toast({
          title: "Cannot Cancel Booking",
          description: "Salon owners can only cancel bookings before 3 hours of the slot time.",
          variant: "destructive",
        });
        return;
      }
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
    );
    const { data: res, error } = await supabase.functions.invoke("cancel-booking", {
      body: {
        booking_id: id,
        cancel_reason: "Emergency cancellation by owner",
        cancelled_by: "owner",
      },
    });

    if (error || (res && !res.success)) {
      console.error(error || res);
      toast({
        title: "Failed to cancel booking",
        description: res?.error || error?.message || "Please try again.",
        variant: "destructive",
      });
      loadBookings();
      return;
    }

    toast({ title: "Booking cancelled — customer notified with refund/reschedule choice." });
    loadBookings();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
    { key: "history", label: "History" },
  ];

  return (
    <AppLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "history" && (
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3 items-end bg-card p-4 rounded-xl border border-border">
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">From Date</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">To Date</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <Button onClick={downloadStatement} className="w-full md:w-auto gap-2 whitespace-nowrap bg-primary text-primary-foreground">
                <Download className="h-4 w-4" /> Download Statement
              </Button>
            </div>
            
            {/* Total Revenue Summary */}
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-4 rounded-xl">
              <div>
                <p className="text-sm font-medium text-primary">Total Revenue (Completed)</p>
                <p className="text-xs text-muted-foreground">For selected date range</p>
              </div>
              <p className="text-2xl font-bold text-primary">
                ₹{filtered.filter(b => b.status === "completed").reduce((sum, b) => sum + (b.total_amount || 0), 0)}
              </p>
            </div>
          </div>
        )}

        {/* Bookings List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {tab === "history" ? <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" /> : <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />}
            <p className="font-medium">{tab === "history" ? "No history found for this date range" : "No bookings here"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => (
              <Card key={booking.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">
                      {booking.customers?.full_name || "Guest Customer"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {booking.service_names ||
                        (booking.services && booking.services.length > 0
                          ? booking.services.map((s: any) => s.name).join(", ")
                          : "Service")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary text-sm">
                      {formatSlotLabel(booking.booking_time)}
                    </p>
                    <p className="text-xs font-medium text-foreground mt-0.5">
                      {tab === "history" 
                        ? formatDate(booking.booking_date)
                        : (booking.booking_date !== todayStr ? formatDate(booking.booking_date) : "Today")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {booking.duration_minutes} min • ₹{booking.total_amount || 0}
                    </p>
                  </div>
                </div>
                {booking.status === "upcoming" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      className="gap-1.5 flex-1"
                      onClick={() => markCompleted(booking.id)}
                    >
                      <CheckCircle className="h-4 w-4" /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => cancelBooking(booking.id)}
                    >
                      <XCircle className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                )}
                {booking.status === "completed" && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                      <CheckCircle className="h-4 w-4" /> Completed
                    </div>
                  </div>
                )}
                {booking.status === "cancelled" && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                      <XCircle className="h-4 w-4" />
                      {booking.cancelled_by === "emergency"
                        ? "Emergency Closure"
                        : booking.cancelled_by === "owner"
                        ? "Cancelled by Salon"
                        : "Cancelled by Customer"}
                    </div>
                    {(booking.cancelled_by === "owner" || booking.cancelled_by === "emergency") &&
                      booking.refund_status === "pending_choice" && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          Awaiting customer choice
                        </span>
                      )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
