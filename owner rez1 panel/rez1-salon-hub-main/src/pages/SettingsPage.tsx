import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { 
  LogOut, Store, Clock, CreditCard, Crown, ImagePlus, X, Pencil, 
  Image as ImageIcon, Bell, User, Mail, Phone, MapPin, Info, 
  Scissors, Banknote, Trash2, Plus, Smartphone, QrCode, HelpCircle, Lock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getNotificationSoundEnabled, setNotificationSoundEnabled, primeAudioContext, useNotificationSound } from "@/hooks/use-notification-sound";
import { OfferSettings } from "@/components/OfferSettings";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const MAX_IMAGES = 8;

function NotificationSoundToggle() {
  const [enabled, setEnabled] = useState(getNotificationSoundEnabled());
  return (
    <Switch
      checked={enabled}
      onCheckedChange={(val) => {
        setEnabled(val);
        setNotificationSoundEnabled(val);
      }}
    />
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playBookingSound } = useNotificationSound();
  const [salon, setSalon] = useState({
    ownerName: "",
    name: "", address: "", latitude: null as number | null, longitude: null as number | null, phone: "", email: "", description: "",
    openTime: "", closeTime: "", slotDuration: 30, seats: 4, subscription: "free",
    services: [] as any[], categories: [] as string[], amenities: [] as string[],
    bankDetails: { accountHolderName: "", bankName: "", accountNumber: "", ifscCode: "", upiNumber: "", upiScannerImage: "", razorpayAccountId: "" }
  });
  const [amenityInput, setAmenityInput] = useState("");
  const [profileDetails, setProfileDetails] = useState({ username: "" });
  const [salonId, setSalonId] = useState<string | null>(null);
  // No hardcoded fallback — only show categories that are active in the DB
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("name")
          .eq("is_active", true)
          .order("name", { ascending: true });
        
        if (!error && data && data.length > 0) {
          setDbCategories(data.map((c: any) => c.name));
        }
      } catch (err) {
        console.warn("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);
  
  // Support Email State
  const [showSupportInput, setShowSupportInput] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: owner } = await supabase.from("owners").select("*").eq("id", user.id).maybeSingle();
      if (owner) setProfileDetails({ username: owner.email || owner.phone || owner.id });

      const { data: salonRes } = await supabase.from("salons").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (salonRes) {
        setSalonId(salonRes.id);
        const imagesArr = salonRes.salon_images || [];
        setImages(imagesArr.map((img: string) => ({ preview: img })));
        setUpiScanner(salonRes.upi_scanner_url ? { preview: salonRes.upi_scanner_url } : null);

        const { data: servicesData } = await supabase.from("services").select("*").eq("salon_id", salonRes.id);

        setSalon({
          ownerName: owner?.full_name || "",   // from owners table
          name: salonRes.name,
          address: salonRes.address,
          latitude: salonRes.latitude,
          longitude: salonRes.longitude,
          phone: owner?.phone || "",            // from owners table
          email: owner?.email || "",            // from owners table
          description: salonRes.description || "",
          categories: salonRes.categories || [],
          amenities: salonRes.amenities || [],
          services: servicesData || [],
          bankDetails: {
             accountHolderName: salonRes.account_holder_name || "",
             bankName: salonRes.bank_name || "",
             accountNumber: salonRes.account_number || "",
             ifscCode: salonRes.ifsc_code || "",
             upiNumber: salonRes.upi_number || "",
             upiScannerImage: salonRes.upi_scanner_url || "",
             razorpayAccountId: salonRes.razorpay_account_id || "",
          },
          openTime: salonRes.open_time || "",
          closeTime: salonRes.close_time || "",
          slotDuration: salonRes.slot_duration || 30,
          seats: salonRes.total_seats || 4,
          subscription: salonRes.subscription || "free",
        });
      }
    };
    loadProfile();
  }, []);

  // Real-time listener for services changes (Admin Sync)
  useEffect(() => {
    if (!salonId) return;
    const servicesChannel = supabase
      .channel('services-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `salon_id=eq.${salonId}` }, async () => {
        const { data: servicesData } = await supabase.from("services").select("*").eq("salon_id", salonId);
        if (servicesData) {
          setSalon(prev => ({ ...prev, services: servicesData }));
          toast({ title: "Services Updated", description: "Your services were updated by the admin.", duration: 3000 });
        }
      })
      .subscribe();

    const salonChannel = supabase
      .channel('salon-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salons', filter: `id=eq.${salonId}` }, (payload) => {
        const updatedSalon = payload.new as any;
        setSalon(prev => ({
          ...prev,
          name: updatedSalon.name || prev.name,
          address: updatedSalon.address || prev.address,
          description: updatedSalon.description || prev.description,
          latitude: updatedSalon.latitude || prev.latitude,
          longitude: updatedSalon.longitude || prev.longitude,
          categories: updatedSalon.categories || prev.categories,
          amenities: updatedSalon.amenities || prev.amenities,
        }));
        toast({ title: "Salon Updated", description: "Your salon details were updated by the admin.", duration: 3000 });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(servicesChannel);
      supabase.removeChannel(salonChannel);
    };
  }, [salonId]);

  // Refs for file uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upiInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  
  // State for images
  const [images, setImages] = useState<{ file?: File; preview: string }[]>([]);
  const [upiScanner, setUpiScanner] = useState<{ file?: File; preview: string } | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSection, setPendingSection] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  const handleSaveSection = (sectionName: string) => {
    setPendingSection(sectionName);
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    if (!salonId) return;
    const { data: { user } } = await supabase.auth.getUser();
    setIsSaving(true);
    try {
      if (pendingSection === "owner profile") {
        if (user) {
          const { data: res, error } = await supabase.functions.invoke('admin-api', {
            body: {
              action: 'UPDATE',
              table: 'owners',
              id: user.id,
              data: {
                full_name: salon.ownerName,
                phone: salon.phone,
                email: salon.email
              }
            }
          });
          if (error || !res?.success) throw new Error(res?.error?.message || error?.message || "Failed to update owner profile");
        }
      } else if (pendingSection === "salon profile") {
        const { data: res, error } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'UPDATE',
            table: 'salons',
            id: salonId,
            data: { 
              name: salon.name, 
              address: salon.address,
              description: salon.description,
              categories: salon.categories,
              amenities: salon.amenities,
              latitude: salon.latitude,
              longitude: salon.longitude
            }
          }
        });
        if (error || !res?.success) throw new Error(res?.error?.message || error?.message || "Failed to update salon profile");
      } else if (pendingSection === "services") {
        // Fetch current services for this salon to identify what to delete
        const { data: currentServicesRes } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'SELECT',
            table: 'services',
            filters: [{ column: 'salon_id', value: salonId }]
          }
        });
        
        const currentServices = currentServicesRes?.data || [];
        const currentIds = currentServices.map((s: any) => s.id);
        const newIds = salon.services.filter(s => s.id).map(s => s.id);

        // Delete services no longer in the list
        for (const idToDelete of currentIds) {
          if (!newIds.includes(idToDelete)) {
            await supabase.functions.invoke('admin-api', {
              body: { action: 'DELETE', table: 'services', id: idToDelete }
            });
          }
        }

        // Insert new or update existing services
        for (const svc of salon.services) {
          if (svc.id) {
            await supabase.functions.invoke('admin-api', {
              body: {
                action: 'UPDATE',
                table: 'services',
                id: svc.id,
                data: { name: svc.name, price: Number(svc.price) }
              }
            });
          } else {
            await supabase.functions.invoke('admin-api', {
              body: {
                action: 'INSERT',
                table: 'services',
                data: { 
                  salon_id: salonId, 
                  name: svc.name, 
                  price: Number(svc.price),
                  duration: 30,
                  category: "",
                  is_active: true
                }
              }
            });
          }
        }

        // Re-fetch services to update client state with database IDs
        const { data: updatedServicesRes } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'SELECT',
            table: 'services',
            filters: [{ column: 'salon_id', value: salonId }]
          }
        });
        if (updatedServicesRes?.data) {
          setSalon(prev => ({ ...prev, services: updatedServicesRes.data }));
        }
      } else if (pendingSection === "timings") {
        const { data: res, error } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'UPDATE',
            table: 'salons',
            id: salonId,
            data: {
              open_time: salon.openTime, 
              close_time: salon.closeTime, 
              slot_duration: 30, // Fixed — always 30 min, not changeable
              total_seats: salon.seats
            }
          }
        });
        if (error || !res?.success) throw new Error(res?.error?.message || error?.message || "Failed to update timings");
      } else if (pendingSection === "bank details") {
        let finalUpiUrl = salon.bankDetails.upiScannerImage;
        if (upiScanner?.preview.startsWith("blob:") && upiScanner.file) {
           const path = `${user?.id}/upi-${Date.now()}-${Math.random().toString(36).slice(2)}-${upiScanner.file.name}`;
           const { data: up, error: resErr } = await supabase.storage.from("upi-scanners").upload(path, upiScanner.file);
           
           if (!resErr && up) {
               const { data: url } = supabase.storage.from("upi-scanners").getPublicUrl(up.path);
               finalUpiUrl = url.publicUrl;
           } else {
               throw new Error(`Failed to upload UPI Image: ${resErr?.message || 'Unknown'}`);
           }
        }
        
        const { data: res, error } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'UPDATE',
            table: 'salons',
            id: salonId,
            data: {
              account_holder_name: salon.bankDetails.accountHolderName,
              bank_name: salon.bankDetails.bankName,
              account_number: salon.bankDetails.accountNumber,
              ifsc_code: salon.bankDetails.ifscCode,
              upi_number: salon.bankDetails.upiNumber,
              upi_scanner_url: finalUpiUrl
            }
          }
        });
        if (error || !res?.success) throw new Error(res?.error?.message || error?.message || "Failed to update bank details");
        
        if (upiScanner && finalUpiUrl) {
           setUpiScanner({ preview: finalUpiUrl });
        }
      } else if (pendingSection === "images") {
        const finalUrls: string[] = [];
        
        const compressImage = async (file: File): Promise<File> => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1080;
                
                if (width > height) {
                  if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                  }
                } else {
                  if (height > MAX_HEIGHT) {
                    width = Math.round((width * MAX_HEIGHT) / height);
                    height = MAX_HEIGHT;
                  }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                  if (blob) {
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
                  } else {
                    resolve(file);
                  }
                }, 'image/jpeg', 0.85);
              };
              img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
          });
        };

        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (img.preview.startsWith("blob:") && img.file) {
            const ext = 'jpg';
            const safeName = `img_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const path = `${user?.id}/${safeName}`;
            
            toast({ title: `Compressing Image ${i+1}...`, description: "Preparing file for storage" });
            const compressedFile = await compressImage(img.file);
            
            toast({ title: `Uploading Image ${i+1}...` });
            const { data: up, error: resErr } = await supabase.storage.from("salon-images").upload(path, compressedFile);
            
            if (!resErr && up) {
               const { data: url } = supabase.storage.from("salon-images").getPublicUrl(up.path);
               finalUrls.push(url.publicUrl);
            } else {
               throw new Error(`Image ${i+1} failed: ${resErr?.message || 'Unknown error'}`);
            }
          } else {
             finalUrls.push(img.preview);
          }
        }

        const { data: res, error } = await supabase.functions.invoke('admin-api', {
          body: {
            action: 'UPDATE',
            table: 'salons',
            id: salonId,
            data: { salon_images: finalUrls }
          }
        });
        if (error || !res?.success) throw new Error(res?.error?.message || error?.message || "Failed to update salon images");
        setImages(finalUrls.map(url => ({ preview: url })));
      }

      toast({ 
        title: `${fillTitle(pendingSection)} Updated`, 
        description: "Changes have been saved securely." 
      });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
      setShowConfirm(false);
      setPendingSection("");
    }
  };

  const fillTitle = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Image Upload Logic
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (replaceIndex !== null && files.length > 0) {
      const file = files[0];
      setImages((prev) => {
        const updated = [...prev];
        if (updated[replaceIndex].preview.startsWith("blob:")) {
          URL.revokeObjectURL(updated[replaceIndex].preview);
        }
        updated[replaceIndex] = { file, preview: URL.createObjectURL(file) };
        return updated;
      });
      setReplaceIndex(null);
    } else {
      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);
      const newImages = toAdd.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newImages]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      if (prev[index].preview.startsWith("blob:")) {
        URL.revokeObjectURL(prev[index].preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const replaceImage = (index: number) => {
    setReplaceIndex(index);
    replaceInputRef.current?.click();
  };

  // UPI Upload Logic
  const handleUpiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (upiScanner?.preview.startsWith("blob:")) {
        URL.revokeObjectURL(upiScanner.preview);
      }
      setUpiScanner({ file, preview: URL.createObjectURL(file) });
    }
    if (upiInputRef.current) upiInputRef.current.value = "";
  };

  // Service Management
  const addService = () => {
    setSalon({
      ...salon,
      services: [...salon.services, { name: "", price: "" }]
    });
  };

  const updateService = (index: number, key: 'name' | 'price', value: string) => {
    const updated = [...salon.services];
    updated[index] = { ...updated[index], [key]: value };
    setSalon({ ...salon, services: updated });
  };

  const removeService = (index: number) => {
    setSalon({
      ...salon,
      services: salon.services.filter((_, i) => i !== index)
    });
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto space-y-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your salon profile, services, and account details</p>
        </div>

        {/* 1. Owner Profile */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Owner Profile</h2>
          </div>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Username</Label>
                <div className="flex items-center h-12 px-4 rounded-xl border border-border bg-muted/50 text-muted-foreground font-medium">
                  {profileDetails.username}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Owner Name</Label>
                <Input
                  value={salon.ownerName}
                  onChange={(e) => setSalon({ ...salon, ownerName: e.target.value })}
                  className="h-12 text-base rounded-xl"
                  placeholder="Rahul Sharma"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Phone Number</Label>
                <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                    value={salon.phone}
                    onChange={(e) => setSalon({ ...salon, phone: e.target.value })}
                    className="h-12 text-base rounded-xl pl-11"
                    placeholder="+91 98765 43210"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Email Address</Label>
                <div className="relative">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                    value={salon.email}
                    onChange={(e) => setSalon({ ...salon, email: e.target.value })}
                    className="h-12 text-base rounded-xl pl-11"
                    placeholder="owner@example.com"
                   />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => handleSaveSection("owner profile")} className="px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-gold">
                Save Changes
              </Button>
            </div>
          </Card>
        </section>

        {/* 2. Salon Profile */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Salon Profile</h2>
          </div>
          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Salon Name</Label>
              <Input
                value={salon.name}
                onChange={(e) => setSalon({ ...salon, name: e.target.value })}
                className="h-12 text-base rounded-xl"
                placeholder="Urban Cuts Studio"
              />
            </div>
            <AddressAutocomplete
              label="Full Address"
              required
              value={salon.address}
              latitude={salon.latitude?.toString() || ""}
              longitude={salon.longitude?.toString() || ""}
              onChange={(addr, lat, lng) => {
                setSalon(prev => ({
                  ...prev,
                  address: addr,
                  latitude: lat ? parseFloat(lat) : null,
                  longitude: lng ? parseFloat(lng) : null,
                }));
              }}
              placeholder="Building Name, Street, Area, City"
            />
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Salon Description</Label>
              <div className="relative">
                <Info className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                <Textarea
                  value={salon.description}
                  onChange={(e) => setSalon({ ...salon, description: e.target.value })}
                  className="min-h-[120px] text-base rounded-xl pl-11 pt-3.5"
                  placeholder="Tell customers what makes your salon special..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Salon Categories</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {dbCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSalon(prev => {
                        const cats = prev.categories.includes(cat) 
                          ? prev.categories.filter((c: string) => c !== cat) 
                          : [...prev.categories, cat];
                        return { ...prev, categories: cats };
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      salon.categories.includes(cat) 
                        ? "bg-[#D2AC47] text-black border-[#D2AC47]" 
                        : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* Amenities */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Amenities</Label>
              <p className="text-xs text-muted-foreground -mt-1">These appear on the salon detail page for customers (e.g. WiFi, Parking, AC, TV)</p>
              <div className="flex flex-wrap gap-2">
                {salon.amenities.map((a: string) => (
                  <span
                    key={a}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => setSalon(prev => ({ ...prev, amenities: prev.amenities.filter((x: string) => x !== a) }))}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && amenityInput.trim()) {
                      e.preventDefault();
                      const val = amenityInput.trim();
                      if (!salon.amenities.includes(val)) {
                        setSalon(prev => ({ ...prev, amenities: [...prev.amenities, val] }));
                      }
                      setAmenityInput("");
                    }
                  }}
                  placeholder="Type amenity and press Enter (e.g. WiFi)"
                  className="h-10 text-sm rounded-xl flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = amenityInput.trim();
                    if (val && !salon.amenities.includes(val)) {
                      setSalon(prev => ({ ...prev, amenities: [...prev.amenities, val] }));
                    }
                    setAmenityInput("");
                  }}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              {/* Quick add presets */}
              <div className="flex flex-wrap gap-1.5">
                {["WiFi", "Parking", "AC", "TV", "Music", "Sanitised", "Cards Accepted", "Private Rooms"].filter(p => !salon.amenities.includes(p)).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSalon(prev => ({ ...prev, amenities: [...prev.amenities, preset] }))}
                    className="rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSaveSection("salon profile")} className="px-8 h-11 font-semibold">
                Save Changes
              </Button>
            </div>
          </Card>
        </section>

        {/* 3. Services & Pricing */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Services & Pricing</h2>
          </div>
          <Card className="p-6">
            <div className="space-y-4">
              {salon.services.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
                   <Scissors className="h-10 w-10 opacity-20" />
                   <p className="text-sm">No services added yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {salon.services.map((svc, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-3"
                      >
                        <Input 
                          placeholder="Service Name" 
                          value={svc.name} 
                          onChange={(e) => updateService(i, 'name', e.target.value)} 
                          className="h-12 bg-background flex-1 rounded-xl" 
                        />
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                          <Input 
                            placeholder="Price" 
                            value={svc.price} 
                            onChange={(e) => updateService(i, 'price', e.target.value)} 
                            className="h-12 bg-background pl-8 rounded-xl" 
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeService(i)}
                          className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={addService} 
                className="w-full h-12 rounded-xl border-dashed border-2 gap-2 text-primary border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Plus className="h-4 w-4" /> Add Another Service
              </Button>
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => handleSaveSection("services")} className="px-8 h-11 font-semibold">
                Save & Update Prices
              </Button>
            </div>
          </Card>
        </section>

        {/* 4. Bank & UPI Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Banknote className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Bank & UPI Details</h2>
          </div>
          <Card className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Account Holder Name</Label>
                <Input
                  value={salon.bankDetails.accountHolderName}
                  onChange={(e) => setSalon({ 
                    ...salon, 
                    bankDetails: { ...salon.bankDetails, accountHolderName: e.target.value } 
                  })}
                  className="h-12 text-base rounded-xl"
                  placeholder="Rahul Sharma"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Bank Name</Label>
                <Input
                  value={salon.bankDetails.bankName}
                  onChange={(e) => setSalon({ 
                    ...salon, 
                    bankDetails: { ...salon.bankDetails, bankName: e.target.value } 
                  })}
                  className="h-12 text-base rounded-xl"
                  placeholder="State Bank of India"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Account Number</Label>
                <Input
                  value={salon.bankDetails.accountNumber}
                  onChange={(e) => setSalon({ 
                    ...salon, 
                    bankDetails: { ...salon.bankDetails, accountNumber: e.target.value } 
                  })}
                  className="h-12 text-base rounded-xl"
                  placeholder="Enter account number"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">IFSC Code</Label>
                <Input
                  value={salon.bankDetails.ifscCode}
                  onChange={(e) => setSalon({ 
                    ...salon, 
                    bankDetails: { ...salon.bankDetails, ifscCode: e.target.value } 
                  })}
                  className="h-12 text-base rounded-xl uppercase"
                  placeholder="SBIN0001234"
                />
              </div>
            </div>

            <div className="pt-8 border-t border-border flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">UPI Payment details</h3>
                </div>
                <div className="space-y-2">
                   <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">UPI Phone Number</Label>
                   <Input
                    value={salon.bankDetails.upiNumber}
                    onChange={(e) => setSalon({ 
                      ...salon, 
                      bankDetails: { ...salon.bankDetails, upiNumber: e.target.value } 
                    })}
                    className="h-12 text-base rounded-xl"
                    placeholder="+91 98765 43210"
                   />
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">UPI Scanner Image</h3>
                </div>
                <div className="relative border-2 border-dashed border-border rounded-2xl h-44 bg-muted/20 flex flex-col items-center justify-center group overflow-hidden transition-all hover:border-primary/30">
                  {upiScanner ? (
                    <>
                      <img src={upiScanner.preview} alt="UPI Scanner" className="h-full w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={() => upiInputRef.current?.click()} className="h-9 gap-1.5">
                          <Pencil className="w-3.5 h-3.5"/> Replace
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setUpiScanner(null)} className="h-9 gap-1.5">
                          <X className="w-3.5 h-3.5"/> Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => upiInputRef.current?.click()} className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                      <ImagePlus className="h-10 w-10 opacity-20" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Upload QR Code</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSaveSection("bank details")} className="px-8 h-11 font-semibold">
                Save & Update Account
              </Button>
            </div>
            <input ref={upiInputRef} type="file" accept="image/*" onChange={handleUpiUpload} className="hidden" />
          </Card>
        </section>

        {/* 5. Business Timings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Business Timings</h2>
          </div>
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6 pb-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Opening Time</Label>
                <Input
                  value={salon.openTime}
                  onChange={(e) => setSalon({ ...salon, openTime: e.target.value })}
                  className="h-12 text-base rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Closing Time</Label>
                <Input
                  value={salon.closeTime}
                  onChange={(e) => setSalon({ ...salon, closeTime: e.target.value })}
                  className="h-12 text-base rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Slot Duration</Label>
                <div className="flex items-center gap-3 h-12 px-4 rounded-xl border border-border bg-muted/50 text-muted-foreground font-medium">
                  <Lock className="h-4 w-4 shrink-0 text-[#D2AC47]" />
                  <span className="text-base">30 min</span>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#D2AC47] bg-[#D2AC47]/10 px-2.5 py-1 rounded-full border border-[#D2AC47]/20">Fixed</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Slot duration is fixed at 30 min by the platform and cannot be changed.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Total Seats</Label>
                <Input
                  type="number"
                  value={salon.seats}
                  onChange={(e) => setSalon({ ...salon, seats: Number(e.target.value) })}
                  className="h-12 text-base rounded-xl"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => handleSaveSection("timings")} className="px-8 h-11 font-semibold">
                Save Changes
              </Button>
            </div>
          </Card>
        </section>

        {/* 6. Shop Images */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Shop Images</h2>
            </div>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
              {images.length} / {MAX_IMAGES}
            </span>
          </div>
          <Card className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-card group shadow-sm">
                  <img src={img.preview} alt={`Shop ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-500" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button type="button" onClick={() => replaceImage(i)} className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeImage(i)} className="h-8 w-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">Add More</span>
                </button>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSaveSection("images")} className="px-8 h-11 font-semibold">
                Update Gallery
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </Card>
        </section>

        {/* 7. Offers & Discounts */}
        <section className="space-y-4">
           <OfferSettings />
        </section>

        {/* Notifications & System */}
        <section className="space-y-6 pt-6 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="h-5 w-5 text-primary" />
                  <h2 className="font-bold">Notifications</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">Booking Voice Alert</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Play sound & announce slot<br/>time on new bookings
                    </p>
                  </div>
                  <NotificationSoundToggle />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full h-9 rounded-xl text-xs gap-1.5"
                  onClick={() => { primeAudioContext(); playBookingSound("10:30 AM"); }}
                >
                  <Bell className="h-3.5 w-3.5" /> Test Notification Sound
                </Button>
             </Card>

             <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h2 className="font-bold">Subscription Plan</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      salon.subscription === "pro" ? "bg-primary/10 shadow-[0_0_15px_-5px_hex(#D2AC47)]" : "bg-muted-foreground/10"
                    }`}>
                      <Crown className={`h-6 w-6 ${
                        salon.subscription === "pro" ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="font-bold capitalize">{salon.subscription} Member</p>
                      <p className="text-xs text-muted-foreground">
                        {salon.subscription === "pro" ? "Priority visibility active" : "Basic business tools"}
                      </p>
                    </div>
                  </div>
                  {salon.subscription === "free" && (
                    <Button size="sm" className="h-9 gap-1.5 px-4 font-bold shadow-gold">
                      Upgrade
                    </Button>
                  )}
                </div>
             </Card>
             <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="font-bold">Help & Support</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Having trouble? Our support team is here to help you.
                </p>
                <AnimatePresence mode="wait">
                  {!showSupportInput ? (
                    <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Button
                        variant="outline"
                        className="w-full h-12 rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary hover:text-white"
                        onClick={() => setShowSupportInput(true)}
                      >
                        <Mail className="h-4 w-4" /> Contact Support
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                      <Textarea 
                        placeholder="Describe your issue..." 
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        className="min-h-[100px] rounded-xl text-sm"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          onClick={() => { setShowSupportInput(false); setSupportMessage(""); }}
                          className="flex-1 rounded-xl"
                        >
                          Cancel
                        </Button>
                        <Button 
                          disabled={!supportMessage.trim() || isSendingSupport}
                          className="flex-1 rounded-xl gap-2 shadow-gold"
                          onClick={async () => {
                            setIsSendingSupport(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("send-support-email", {
                                body: {
                                  salonName: salon.name,
                                  ownerName: salon.ownerName,
                                  email: salon.email,
                                  phone: salon.phone,
                                  message: supportMessage
                                }
                              });
                              if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed to send");
                              toast({ title: "✅ Support request sent", description: "Our team will contact you shortly." });
                              setShowSupportInput(false);
                              setSupportMessage("");
                            } catch (err: any) {
                              toast({ title: "Failed to send", description: err.message, variant: "destructive" });
                            } finally {
                              setIsSendingSupport(false);
                            }
                          }}
                        >
                          {isSendingSupport ? "Sending..." : "Send Request"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </Card>
          </div>
          
          <Card className="p-6 border-dashed border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group cursor-pointer" onClick={() => navigate("/add-salon")}>
            <div className="flex flex-col items-center justify-center py-4 gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Add Another Salon</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Expand your business by adding another location to your account.
                </p>
              </div>
              <Button variant="outline" className="mt-2 border-primary/50 text-primary hover:bg-primary hover:text-white font-bold px-8 h-12 rounded-xl">
                Start Registration
              </Button>
            </div>
          </Card>

          <Button
            variant="outline"
            className="w-full h-14 rounded-2xl gap-2 border-destructive/20 text-destructive hover:bg-destructive shadow-sm hover:text-white transition-all transform hover:scale-[1.01] duration-300"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" /> 
            <span className="font-bold uppercase tracking-widest text-xs">Logout From Account</span>
          </Button>
        </section>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="rounded-2xl border-primary/20 bg-background/95 backdrop-blur-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Do you want to make the changes?</AlertDialogTitle>
              <AlertDialogDescription>
                This will update your {pendingSection} details across the platform. This action cannot be undone instantly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
              <AlertDialogCancel className="rounded-xl border-border hover:bg-muted font-semibold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => { e.preventDefault(); confirmSave(); }}
                disabled={isSaving}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-gold"
              >
                {isSaving ? "Saving..." : "Yes, Save Changes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
