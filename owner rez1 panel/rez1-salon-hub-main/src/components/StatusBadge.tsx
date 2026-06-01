import { cn } from "@/lib/utils";

type SlotStatus = "available" | "partial" | "full" | "blocked";

const statusConfig: Record<SlotStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-slot-available/15 text-slot-available" },
  partial: { label: "Filling", className: "bg-slot-partial/15 text-slot-partial" },
  full: { label: "Full", className: "bg-slot-full/15 text-slot-full" },
  blocked: { label: "Blocked", className: "bg-slot-blocked/15 text-slot-blocked" },
};

export function StatusBadge({ status }: { status: SlotStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
