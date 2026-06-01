import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Tag, Calendar, Percent } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export function OfferSettings() {
  const { toast } = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [offer, setOffer] = useState<any>({
    activeType: "none",
    specificDay: { date: "", percentage: 0 },
    weekday: { percentage: 0 },
    weekend: { percentage: 0 },
    allDays: { percentage: 0 }
  });

  // Load existing offer from Supabase
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
      if (!salon) return;
      setSalonId(salon.id);

      const { data } = await supabase.from("salon_offers").select("*").eq("salon_id", salon.id).order("updated_at", { ascending: false }).maybeSingle();
      if (data) {
        setOfferId(data.id);
        setOffer({
          activeType: data.active_type || "none",
          specificDay: { date: data.specific_day_date || "", percentage: data.specific_day_percentage || 0 },
          weekday: { percentage: data.weekday_percentage || 0 },
          weekend: { percentage: data.weekend_percentage || 0 },
          allDays: { percentage: data.all_days_percentage || 0 }
        });
      }
    };
    load();
  }, []);

  const saveOffer = async () => {
    if (!salonId) {
      toast({ title: "No salon found. Please refresh and try again.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        salon_id: salonId,
        active_type: offer.activeType,
        specific_day_date: offer.specificDay.date || null,
        specific_day_percentage: offer.specificDay.percentage || 0,
        weekday_percentage: offer.weekday.percentage || 0,
        weekend_percentage: offer.weekend.percentage || 0,
        all_days_percentage: offer.allDays.percentage || 0,
        updated_at: new Date().toISOString(),
      };

      // Use upsert with salon_id as the conflict key — works whether row exists or not
      const { error } = await supabase
        .from("salon_offers")
        .upsert(payload, { onConflict: "salon_id" });

      if (error) throw error;
      toast({ title: "✅ Offer saved successfully" });
    } catch (err: any) {
      console.error("saveOffer error:", err);
      toast({ title: "Failed to save offer", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateOffer = (updates: any) => {
    setOffer((prev: any) => ({ ...prev, ...updates }));
  };

  const updateSpecificDay = (updates: any) => {
    setOffer((prev: any) => ({ ...prev, specificDay: { ...prev.specificDay, ...updates } }));
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Tag className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-lg">Offers & Discounts</h2>
      </div>

      <RadioGroup
        value={offer.activeType}
        onValueChange={(val) => updateOffer({ activeType: val })}
        className="flex flex-col space-y-3"
      >
        {/* No Offer */}
        <div className="flex items-center space-x-3">
          <RadioGroupItem value="none" id="offer-none" />
          <Label htmlFor="offer-none" className="font-normal cursor-pointer text-base">No active offers</Label>
        </div>

        {/* Specific Day */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="specific_day" id="offer-specific" />
            <Label htmlFor="offer-specific" className="font-normal cursor-pointer text-base">Specific Day Offer</Label>
          </div>
          {offer.activeType === "specific_day" && (
            <div className="pl-7 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/>Select Date</Label>
                <Input
                  type="date"
                  value={offer.specificDay.date}
                  onChange={(e) => updateSpecificDay({ date: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3"/>Discount %</Label>
                <Input
                  type="number"
                  placeholder="e.g. 20"
                  value={offer.specificDay.percentage || ""}
                  onChange={(e) => updateSpecificDay({ percentage: Number(e.target.value) })}
                  className="h-10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Weekday / Weekend */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="weekday_weekend" id="offer-week" />
            <Label htmlFor="offer-week" className="font-normal cursor-pointer text-base">Weekday & Weekend Offer</Label>
          </div>
          {offer.activeType === "weekday_weekend" && (
            <div className="pl-7 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weekday % (Mon-Fri)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 15"
                  value={offer.weekday.percentage || ""}
                  onChange={(e) => updateOffer({ weekday: { percentage: Number(e.target.value) } })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weekend % (Sat-Sun)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 30"
                  value={offer.weekend.percentage || ""}
                  onChange={(e) => updateOffer({ weekend: { percentage: Number(e.target.value) } })}
                  className="h-10"
                />
              </div>
            </div>
          )}
        </div>

        {/* All Days */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="all_days" id="offer-all" />
            <Label htmlFor="offer-all" className="font-normal cursor-pointer text-base">All Days Offer</Label>
          </div>
          {offer.activeType === "all_days" && (
            <div className="pl-7 animate-in fade-in slide-in-from-top-2 duration-300 w-1/2 min-w-[200px]">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3"/>Common Discount %</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25"
                  value={offer.allDays.percentage || ""}
                  onChange={(e) => updateOffer({ allDays: { percentage: Number(e.target.value) } })}
                  className="h-10"
                />
              </div>
            </div>
          )}
        </div>
      </RadioGroup>

      <div className="flex justify-end pt-2">
        <Button onClick={saveOffer} disabled={saving} className="px-6 h-10 font-semibold">
          {saving ? "Saving..." : "Save Offer"}
        </Button>
      </div>
    </Card>
  );
}
