import { MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";

interface AddressAutocompleteProps {
  value: string;
  latitude?: string;
  longitude?: string;
  onChange: (address: string, lat?: string, lng?: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter full salon address…",
  label = "Salon Address",
  required = false,
}: AddressAutocompleteProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value, "", "")}
          placeholder={placeholder}
          className="w-full min-h-[80px] bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Please enter the complete and exact address of your salon.
      </p>
    </div>
  );
}
