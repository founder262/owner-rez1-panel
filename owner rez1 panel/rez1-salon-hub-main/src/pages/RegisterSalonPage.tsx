import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImagePlus, X, Pencil, CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2, Store, MapPin, Search, Navigation, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const MAX_IMAGES = 8;
const STEPS = [
  { id: 1, title: "Owner Details" },
  { id: 2, title: "Salon Details" },
  { id: 3, title: "Salon Timings & Slots" },
  { id: 4, title: "Services & Pricing" },
  { id: 5, title: "Shop Images" },
  { id: 6, title: "Bank Details" },
  { id: 7, title: "Agreements & Verification" },
];

const TermsContent = () => (
  <div className="space-y-4 text-sm text-foreground/90 leading-relaxed pr-4">
    <p><strong>Effective Date: [Add Date]</strong></p>
    <p>Welcome to REZ1. By registering your salon and using the REZ1 Owner Panel, you agree to the following terms and conditions.</p>
    
    <h3 className="text-foreground font-semibold mt-4">1. PLATFORM OVERVIEW</h3>
    <p>REZ1 is a digital booking platform that connects salon owners with customers by enabling real-time appointment scheduling and management.</p>
    
    <h3 className="text-foreground font-semibold mt-4">2. ELIGIBILITY</h3>
    <p>To use REZ1 as a salon owner:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>You must own or operate a legitimate salon business</li>
      <li>You must provide accurate business details</li>
      <li>You must comply with local laws and regulations</li>
    </ul>
    <p>REZ1 reserves the right to approve or reject any salon registration.</p>
    
    <h3 className="text-foreground font-semibold mt-4">3. ACCOUNT RESPONSIBILITY</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>You are responsible for maintaining your login credentials</li>
      <li>You must not share your account access with unauthorized users</li>
      <li>Any activity under your account is your responsibility</li>
    </ul>
    <p>REZ1 is not liable for unauthorized access due to negligence.</p>
    
    <h3 className="text-foreground font-semibold mt-4">4. SALON INFORMATION</h3>
    <p>You agree to provide accurate and updated information including:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Salon name, location, and contact details</li>
      <li>Services offered and pricing</li>
      <li>Working hours and availability</li>
    </ul>
    <p>Misleading information may result in account suspension.</p>
    
    <h3 className="text-foreground font-semibold mt-4">5. BOOKING MANAGEMENT</h3>
    <p>As a salon owner, you agree to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Honor confirmed bookings made through REZ1</li>
      <li>Maintain updated slot availability</li>
      <li>Avoid double booking or overbooking</li>
    </ul>
    <p>Repeated failure to honor bookings may result in penalties or removal.</p>
    
    <h3 className="text-foreground font-semibold mt-4">6. WALK-IN & BUFFER MANAGEMENT</h3>
    <p>REZ1 provides tools to manage both walk-in and online bookings. You are responsible for:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Managing time effectively</li>
      <li>Ensuring booked customers are served on time</li>
      <li>Avoiding unnecessary delays</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">7. CANCELLATIONS & NO-SHOWS</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Salon owners must not cancel confirmed bookings without valid reason</li>
      <li>In case of unavoidable situations, proper notification must be given</li>
    </ul>
    <p>Frequent cancellations may affect your visibility or account status.</p>
    
    <h3 className="text-foreground font-semibold mt-4">8. EMERGENCY CLOSURE</h3>
    <p>In case of emergency closure:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>You must use the platform’s emergency feature</li>
      <li>Customers will be notified automatically</li>
    </ul>
    <p>REZ1 may assist in rescheduling or refunds based on platform policy.</p>
    
    <h3 className="text-foreground font-semibold mt-4">9. PAYMENTS & SUBSCRIPTION</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>REZ1 may offer free and paid subscription plans</li>
      <li>Paid plans provide additional visibility and features</li>
      <li>All payments are non-refundable unless stated otherwise</li>
    </ul>
    <p>Failure to pay subscription fees may limit access to features.</p>
    
    <h3 className="text-foreground font-semibold mt-4">10. COMMISSION & FEES (if applicable)</h3>
    <p>REZ1 may charge:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Platform fees</li>
      <li>Service commissions</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">11. CUSTOMER EXPERIENCE</h3>
    <p>You agree to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Provide professional service</li>
      <li>Maintain hygiene and quality standards</li>
      <li>Treat customers respectfully</li>
    </ul>
    <p>Poor customer experience may lead to penalties or removal.</p>
    
    <h3 className="text-foreground font-semibold mt-4">12. PROHIBITED ACTIVITIES</h3>
    <p>Salon owners must not:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Manipulate bookings or pricing unfairly</li>
      <li>Collect payments outside the platform (if restricted)</li>
      <li>Use REZ1 for illegal or fraudulent purposes</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">13. DATA & PRIVACY</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Customer data must be handled responsibly</li>
      <li>You must not misuse or store customer data externally</li>
      <li>REZ1 ensures secure handling of platform data</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">14. PLATFORM RIGHTS</h3>
    <p>REZ1 reserves the right to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Suspend or terminate accounts</li>
      <li>Modify platform features</li>
      <li>Update policies and pricing</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">15. LIMITATION OF LIABILITY</h3>
    <p>REZ1 is a booking platform and is not responsible for:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Service quality disputes</li>
      <li>On-ground salon operations</li>
      <li>Customer-salon conflicts</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">16. TERMINATION</h3>
    <p>REZ1 may suspend or terminate your account if:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Terms are violated</li>
      <li>Fraudulent activity is detected</li>
      <li>Repeated customer complaints occur</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">17. MODIFICATIONS</h3>
    <p>REZ1 may update these terms at any time. Continued use of the platform implies acceptance of updated terms.</p>
    
    <h3 className="text-foreground font-semibold mt-4">18. CONTACT</h3>
    <p>For support or queries:<br/>
    Email: contact@rez1.in<br/>
    Website: www.rez1.in</p>
  </div>
);

const PrivacyContent = () => (
  <div className="space-y-4 text-sm text-foreground/90 leading-relaxed pr-4">
    <p>REZ1 (“we”, “our”, or “us”) values your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our platform.</p>
    <p>By using REZ1, you agree to the terms of this Privacy Policy.</p>
    
    <h3 className="text-foreground font-semibold mt-4">1. INFORMATION WE COLLECT</h3>
    <p>We collect the following types of information:</p>
    <p className="mt-2 text-foreground"><strong>a) Personal Information</strong></p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Name</li>
      <li>Phone number</li>
      <li>Email address (if provided)</li>
    </ul>
    <p className="mt-2 text-foreground"><strong>b) Salon Owner Information</strong></p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Salon name</li>
      <li>Address and location</li>
      <li>Services and pricing details</li>
    </ul>
    <p className="mt-2 text-foreground"><strong>c) Usage Data</strong></p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Booking activity</li>
      <li>App interactions</li>
      <li>Device and log information</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">2. HOW WE USE YOUR INFORMATION</h3>
    <p>We use your information to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Enable salon bookings</li>
      <li>Manage appointments and schedules</li>
      <li>Provide customer support</li>
      <li>Improve platform performance</li>
      <li>Send notifications (booking confirmations, updates)</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">3. SHARING OF INFORMATION</h3>
    <p>We may share information in the following cases:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>With salon owners (to fulfill bookings)</li>
      <li>With customers (booking details only)</li>
      <li>With trusted third-party services (payments, hosting, analytics)</li>
    </ul>
    <p>We do NOT sell your personal data.</p>
    
    <h3 className="text-foreground font-semibold mt-4">4. PAYMENT INFORMATION</h3>
    <p>Payments are processed through secure third-party providers (e.g., Razorpay).</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>REZ1 does not store card or banking details</li>
      <li>All payment data is handled securely by payment partners</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">5. DATA SECURITY</h3>
    <p>We implement security measures to protect your data:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Secure authentication systems</li>
      <li>Encrypted data transmission</li>
      <li>Restricted access to sensitive data</li>
    </ul>
    <p>However, no system is completely secure, and we cannot guarantee absolute security.</p>
    
    <h3 className="text-foreground font-semibold mt-4">6. DATA RETENTION</h3>
    <p>We retain your data only as long as necessary to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Provide services</li>
      <li>Maintain records</li>
      <li>Comply with legal requirements</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">7. USER RIGHTS</h3>
    <p>You have the right to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Access your data</li>
      <li>Request corrections</li>
      <li>Request deletion of your account</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">8. COOKIES & TRACKING</h3>
    <p>We may use cookies or similar technologies to:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Improve user experience</li>
      <li>Analyze platform usage</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">9. THIRD-PARTY SERVICES</h3>
    <p>REZ1 may use third-party tools for:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Payments</li>
      <li>Hosting</li>
      <li>Analytics</li>
    </ul>
    
    <h3 className="text-foreground font-semibold mt-4">10. CHILDREN’S PRIVACY</h3>
    <p>REZ1 is not intended for users under 18 years of age. We do not knowingly collect data from children.</p>
    
    <h3 className="text-foreground font-semibold mt-4">11. CHANGES TO POLICY</h3>
    <p>We may update this Privacy Policy from time to time. Users will be notified of significant changes.</p>
    
    <h3 className="text-foreground font-semibold mt-4">12. CONTACT US</h3>
    <p>For any privacy-related questions:<br/>
    Email: contact@rez1.in<br/>
    Website: www.rez1.in</p>
  </div>
);

export default function RegisterSalonPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upiInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    salonName: "",
    address: "",
    latitude: "",
    longitude: "",
    description: "",
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiNumber: "",
    openTime: "10:00 AM",
    closeTime: "08:00 PM",
    slotDuration: "30", // Fixed — not changeable
    totalSeats: "4",
    categories: [] as string[],
  });


  
  const [services, setServices] = useState<{ name: string; price: string }[]>([]);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [upiScanner, setUpiScanner] = useState<{ file: File; preview: string } | null>(null);

  // Legal checks
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
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

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        if (!form.ownerName.trim() || !form.phone.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
          toast({ title: "Please fill required owner details", variant: "destructive" });
          return false;
        }
        if (form.password !== form.confirmPassword) {
          toast({ title: "Passwords do not match", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!form.salonName.trim() || !form.address.trim()) {
          toast({ title: "Please fill required salon details", variant: "destructive" });
          return false;
        }
        if (form.categories.length === 0) {
          toast({ title: "Please select at least one salon category", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (!form.openTime || !form.closeTime || !form.slotDuration || !form.totalSeats) {
          toast({ title: "Please fill timing & slot details", variant: "destructive" });
          return false;
        }
        return true;
      case 4:
        if (services.length === 0 || services.some(s => !s.name.trim() || !s.price.trim())) {
          toast({ title: "Please add at least one valid service", variant: "destructive" });
          return false;
        }
        return true;
      case 5:
        if (images.length === 0) {
          toast({ title: "Please upload at least one shop image", variant: "destructive" });
          return false;
        }
        return true;
      case 6:
        if (!form.accountHolderName.trim() || !form.bankName.trim() || !form.accountNumber.trim() || !form.ifscCode.trim() || !form.upiNumber.trim() || !upiScanner) {
          toast({ title: "Please fill all bank and UPI details including scanner image", variant: "destructive" });
          return false;
        }
        return true;
      case 7:
        if (!agreedToTerms) {
          toast({ title: "You must agree to the Terms & Conditions", variant: "destructive" });
          return false;
        }
        if (!agreedToPrivacy) {
          toast({ title: "You must agree to the Privacy Policy", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return false;
    }
  };

  const handleNext = (step: number) => {
    if (validateStep(step)) {
      if (!completedSteps.includes(step)) {
        setCompletedSteps(prev => [...prev, step]);
      }
      if (step < STEPS.length) {
        setCurrentStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const addService = () => setServices([...services, { name: "", price: "" }]);
  const updateService = (index: number, key: 'name' | 'price', value: string) => {
    const updated = [...services];
    updated[index][key] = value;
    setServices(updated);
  };
  const removeService = (index: number) => setServices(services.filter((_, i) => i !== index));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (replaceIndex !== null && files.length > 0) {
      const file = files[0];
      setImages((prev) => {
        const updated = [...prev];
        URL.revokeObjectURL(updated[replaceIndex].preview);
        updated[replaceIndex] = { file, preview: URL.createObjectURL(file) };
        return updated;
      });
      setReplaceIndex(null);
    } else {
      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);
      const newImages = toAdd.map((file) => ({ file, preview: URL.createObjectURL(file) }));
      setImages((prev) => [...prev, ...newImages]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (upiInputRef.current) upiInputRef.current.value = "";
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleUpiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (upiScanner) URL.revokeObjectURL(upiScanner.preview);
      setUpiScanner({ file, preview: URL.createObjectURL(file) });
    }
    if (upiInputRef.current) upiInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };
  const handleSubmit = async () => {
    // Already validated step 7 above
    setLoading(true);
    try {
      // 1. DEDUPLICATION CHECK: Check if email or phone already exists in owners or active requests
      toast({ title: "Checking availability…", description: "Verifying email and phone" });

      // Fetch all owners via admin-api SELECT
      const { data: ownersRes } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'SELECT',
          table: 'owners',
          query: 'id, email, phone'
        }
      });
      const owners = ownersRes?.data || [];
      const emailDupOwner = owners.find((o: any) => o.email?.toLowerCase().trim() === form.email.toLowerCase().trim());
      const phoneDupOwner = owners.find((o: any) => o.phone?.trim() === form.phone.trim());

      if (emailDupOwner) {
        throw new Error("This email is already registered as an owner account.");
      }
      if (phoneDupOwner) {
        throw new Error("This phone number is already registered as an owner account.");
      }

      // Fetch all pending/approved salon requests via admin-api SELECT
      const { data: requestsRes } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'SELECT',
          table: 'salon_requests',
          query: 'id, email, phone, salon_name, status'
        }
      });
      const requests = requestsRes?.data || [];
      const emailDupReq = requests.find((r: any) => r.email?.toLowerCase().trim() === form.email.toLowerCase().trim() && r.status !== 'rejected');
      const phoneDupReq = requests.find((r: any) => r.phone?.trim() === form.phone.trim() && r.status !== 'rejected');
      const nameDupReq = requests.find((r: any) => r.salon_name?.toLowerCase().trim() === form.salonName.toLowerCase().trim() && r.status !== 'rejected');

      if (emailDupReq) {
        throw new Error("A registration request with this email is already pending or approved.");
      }
      if (phoneDupReq) {
        throw new Error("A registration request with this phone number is already pending or approved.");
      }
      if (nameDupReq) {
        throw new Error("A salon registration request with this name is already pending or approved.");
      }

      toast({ title: "Creating your account…", description: "Please wait a moment." });

      // Generate a temporary ID for image upload paths since we are not creating the auth user yet
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      toast({ title: "Uploading images…", description: "This might take a moment if files are large." });

      const compressImage = async (file: File): Promise<File> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
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
                } else resolve(file);
              }, 'image/jpeg', 0.85);
            };
            img.onerror = () => resolve(file);
          };
          reader.onerror = () => resolve(file);
        });
      };

      // 2. Upload Salon Images + UPI Scanner (Via Edge Function to bypass RLS)
      // NOTE: Must use raw fetch() — supabase.functions.invoke() cannot send FormData correctly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lidptdtnsvulvjdwkwvz.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseAnonKey;

      const uploadImagePromise = async (img: { file: File; preview: string }): Promise<string> => {
        if (img.file) {
          const compressed = await compressImage(img.file);
          const path = `${tempId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${compressed.name}`;
          
          const formData = new FormData();
          formData.append('file', compressed);
          formData.append('bucket', 'salon-images');
          formData.append('path', path);

          // Use raw fetch so browser correctly sets multipart/form-data boundary
          const res = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'apikey': supabaseAnonKey,
            },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok || data?.error) throw new Error(`Salon Image Upload Error: ${data?.error || res.statusText}`);
          if (data?.url) return data.url;
        }
        return img.preview ?? "";
      };

      const uploadUpiPromise = async (): Promise<string> => {
        if (upiScanner?.file) {
          const path = `${tempId}/upi-${Date.now()}-${upiScanner.file.name}`;
          
          const formData = new FormData();
          formData.append('file', upiScanner.file);
          formData.append('bucket', 'upi-scanners');
          formData.append('path', path);

          // Use raw fetch so browser correctly sets multipart/form-data boundary
          const res = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'apikey': supabaseAnonKey,
            },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok || data?.error) throw new Error(`UPI Scanner Upload Error: ${data?.error || res.statusText}`);
          if (data?.url) return data.url;
        }
        return "";
      };

      // Run image uploads sequentially to prevent edge function overload/dropped requests
      const uploadedImageUrls = [];
      for (const img of images) {
        if (img.file) {
          const url = await uploadImagePromise(img);
          if (url) uploadedImageUrls.push(url);
        }
      }

      let finalUpiUrl = "";
      if (upiScanner?.file) {
         finalUpiUrl = await uploadUpiPromise();
      }

      toast({ title: "Saving your registration…" });

      // Format services pricing and fields cleanly to prevent database casting or constraint errors
      const formattedServices = services.map(svc => ({
        name: svc.name.trim(),
        price: Number(svc.price) || 0,
        duration: 30,
        category: ""
      }));

      // 3. Submit Registration Request securely via admin-api proxy to bypass RLS error
      const requestPayload = {
        owner_id: null, // Will be set by admin-api when approved
        owner_name: form.ownerName,
        phone: form.phone,
        email: form.email,
        password_hash: form.password,
        salon_name: form.salonName,
        address: `${form.address}|||${form.latitude || ""},${form.longitude || ""}`,
        description: form.description,
        open_time: form.openTime,
        close_time: form.closeTime,
        slot_duration: Number(form.slotDuration),
        total_seats: Number(form.totalSeats),
        categories: form.categories,
        services: formattedServices,
        salon_images: uploadedImageUrls,
        bank_name: form.bankName,
        account_holder_name: form.accountHolderName,
        account_number: form.accountNumber,
        ifsc_code: form.ifscCode,
        upi_number: form.upiNumber,
        upi_scanner_url: finalUpiUrl,
        agreed_to_terms: agreedToTerms,
        agreed_to_privacy: agreedToPrivacy,
        status: "pending"
      };

      const { data: dbData, error: dbError } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'INSERT',
          table: 'salon_requests',
          data: requestPayload
        }
      });

      if (dbError || !dbData?.success) {
        // Surface the actual database error message
        const detail = dbData?.error?.message || dbData?.error?.details || dbData?.error?.hint
          || (typeof dbData?.error === 'string' ? dbData.error : null)
          || dbError?.message
          || "Failed to save registration. Please try again.";
        throw new Error(detail);
      }


      toast({ title: "✅ Registration submitted! Awaiting admin review." });
      navigate("/pending-approval");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm text-center space-y-4"
        >
          <div className="flex justify-center">
            <CheckCircle2 className="h-20 w-20 text-[#D2AC47]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Registration Submitted!</h1>
          <p className="text-sm text-muted-foreground">
            Your salon is under review. You will receive an email after approval.
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="mt-8 w-full h-12 text-base font-semibold bg-[#D2AC47] text-black hover:bg-[#b59238] transition-colors"
          >
            Back to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Register Your Salon</h1>
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#D2AC47]/10 text-[#D2AC47]">
            <Store className="h-4 w-4" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto w-full max-w-lg space-y-4">
          
          <div className="mb-8 text-center">
             <h2 className="text-2xl font-bold text-foreground">Setup Your Salon</h2>
             <p className="text-muted-foreground text-sm mt-1">Provide details to create your salon profile</p>
          </div>

          {STEPS.map((step) => {
            const isExpanded = currentStep === step.id;
            const isCompleted = completedSteps.includes(step.id);

            return (
              <div 
                key={step.id} 
                className={`overflow-hidden rounded-2xl border transition-colors ${isExpanded ? 'border-border/50 bg-card shadow-sm' : 'border-transparent bg-transparent'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                     if (isCompleted || step.id <= Math.max(...completedSteps, 0) + 1) {
                         setCurrentStep(step.id);
                     }
                  }}
                  className={`flex w-full items-center justify-between p-4 transition-all ${!isExpanded ? 'bg-card/50 hover:bg-card rounded-2xl border border-border/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${isExpanded ? 'border-[#D2AC47] text-[#D2AC47]' : 'border-muted-foreground/30 text-muted-foreground/50'} text-xs font-semibold`}>
                        {step.id}
                      </div>
                    )}
                    <span className={`font-medium ${isExpanded || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.title}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground/50" />}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-4 pt-2 space-y-5">
                        
                        {/* STEP 1: OWNER DETAILS */}
                        {step.id === 1 && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="ownerName">Owner Name *</Label>
                              <Input id="ownerName" placeholder="John Doe" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} className="bg-background" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="phone">Phone Number *</Label>
                                  <Input id="phone" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="email">Email *</Label>
                                  <Input id="email" type="email" placeholder="john@example.com" value={form.email} onChange={(e) => update("email", e.target.value)} className="bg-background" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="password">Password *</Label>
                                  <Input id="password" type="password" placeholder="Create password" value={form.password} onChange={(e) => update("password", e.target.value)} className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                                  <Input id="confirmPassword" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className="bg-background" />
                                </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 2: SALON DETAILS */}
                        {step.id === 2 && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="salonName">Salon Name *</Label>
                              <Input id="salonName" placeholder="My Salon" value={form.salonName} onChange={(e) => update("salonName", e.target.value)} className="bg-background" />
                            </div>
                            <AddressAutocomplete
                              label="Salon Address"
                              required
                              value={form.address}
                              latitude={form.latitude}
                              longitude={form.longitude}
                              onChange={(addr, lat, lng) => {
                                setForm(prev => ({
                                  ...prev,
                                  address: addr,
                                  latitude: lat ?? "",
                                  longitude: lng ?? "",
                                }));
                              }}
                              placeholder="Type address or pin on map…"
                            />
                            <div className="space-y-2">
                              <Label>Salon Categories *</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {dbCategories.map(cat => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                      setForm(prev => {
                                        const cats = prev.categories.includes(cat) 
                                          ? prev.categories.filter(c => c !== cat) 
                                          : [...prev.categories, cat];
                                        return { ...prev, categories: cats };
                                      });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                      form.categories.includes(cat) 
                                        ? "bg-[#D2AC47] text-black border-[#D2AC47]" 
                                        : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="description">Description (optional)</Label>
                              <Textarea id="description" placeholder="Tell us about your salon..." value={form.description} onChange={(e) => update("description", e.target.value)} className="min-h-[80px] bg-background" />
                            </div>
                          </div>
                        )}

                        {/* STEP 3: TIMINGS */}
                        {step.id === 3 && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Opening Time</Label>
                                    <Input value={form.openTime} onChange={(e) => update("openTime", e.target.value)} className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Closing Time</Label>
                                    <Input value={form.closeTime} onChange={(e) => update("closeTime", e.target.value)} className="bg-background" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Slot Duration</Label>
                                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50 text-muted-foreground text-sm font-medium">
                                      <Lock className="h-3.5 w-3.5 shrink-0 text-[#D2AC47]" />
                                      <span>30 min</span>
                                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#D2AC47] bg-[#D2AC47]/10 px-2 py-0.5 rounded-full border border-[#D2AC47]/20">Fixed</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Slot duration is fixed at 30 min by the platform.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Seats</Label>
                                    <Input type="number" value={form.totalSeats} onChange={(e) => update("totalSeats", e.target.value)} className="bg-background" />
                                </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 4: SERVICES AND PRICING */}
                        {step.id === 4 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Services & Pricing</Label>
                            </div>
                            {services.length === 0 ? (
                               <button type="button" onClick={addService} className="w-full flex items-center justify-center p-4 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                                   <Plus className="h-4 w-4 mr-2" />
                                   Click to add your first service
                               </button>
                            ) : (
                                <div className="space-y-2">
                                    {services.map((svc, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Input placeholder="Service Name" value={svc.name} onChange={(e) => updateService(i, 'name', e.target.value)} className="bg-background flex-1" />
                                            <Input placeholder="Price (₹)" value={svc.price} onChange={(e) => updateService(i, 'price', e.target.value)} className="bg-background w-24" />
                                            <Button type="button" onClick={() => removeService(i)} variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" onClick={addService} variant="outline" className="w-full mt-2 border-dashed gap-2">
                                        <Plus className="h-4 w-4" /> Add Another Service
                                    </Button>
                                </div>
                            )}
                          </div>
                        )}

                        {/* STEP 5: SHOP IMAGES */}
                        {step.id === 5 && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Shop Images ({images.length}/{MAX_IMAGES})</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {images.map((img, i) => (
                                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-background group">
                                  <img src={img.preview} alt={`Shop ${i + 1}`} className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                    <button type="button" onClick={() => { setReplaceIndex(i); replaceInputRef.current?.click(); }} className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button type="button" onClick={() => removeImage(i)} className="h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {images.length < MAX_IMAGES && (
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-[#D2AC47] hover:text-[#D2AC47] transition-colors">
                                  <ImagePlus className="h-5 w-5" />
                                  <span className="text-[10px]">Add</span>
                                </button>
                              )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                            <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </div>
                        )}

                        {/* STEP 6: BANK DETAILS */}
                        {step.id === 6 && (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground pb-2 border-b border-border">
                              Please provide your bank and UPI details. This will be used to receive funds from bookings.
                            </p>
                            <div className="space-y-2">
                              <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                              <Input id="accountHolderName" placeholder="John Doe" value={form.accountHolderName} onChange={(e) => update("accountHolderName", e.target.value)} className="bg-background" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bankName">Bank Name *</Label>
                              <Input id="bankName" placeholder="e.g. State Bank of India" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} className="bg-background" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="accountNumber">Account Number *</Label>
                                  <Input id="accountNumber" type="text" placeholder="Your account number" value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="ifscCode">IFSC Code *</Label>
                                  <Input id="ifscCode" type="text" placeholder="e.g. SBIN0001234" value={form.ifscCode} onChange={(e) => update("ifscCode", e.target.value)} className="bg-background uppercase" />
                                </div>
                            </div>
                            
                            <div className="pt-4 mt-2 border-t border-border space-y-4">
                              <h3 className="text-sm font-semibold flex items-center justify-between">
                                UPI Details
                              </h3>
                              <div className="space-y-2">
                                <Label htmlFor="upiNumber">UPI Phone Number *</Label>
                                <Input id="upiNumber" type="tel" placeholder="+91 98765 43210" value={form.upiNumber} onChange={(e) => update("upiNumber", e.target.value)} className="bg-background" />
                              </div>
                              <div className="space-y-2">
                                <Label>UPI Scanner Image *</Label>
                                <div className="flex items-center gap-4">
                                  <div 
                                    onClick={() => upiInputRef.current?.click()}
                                    className="flex-1 h-32 rounded-xl border-2 border-dashed border-border bg-card/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#D2AC47] hover:bg-[#D2AC47]/5 transition-all overflow-hidden"
                                  >
                                    {upiScanner ? (
                                      <img src={upiScanner.preview} alt="UPI Scanner" className="h-full w-full object-contain" />
                                    ) : (
                                      <>
                                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Upload QR Code</span>
                                      </>
                                    )}
                                  </div>
                                  {upiScanner && (
                                    <Button type="button" onClick={() => setUpiScanner(null)} variant="outline" size="icon" className="shrink-0 text-destructive border-destructive/20 hover:bg-destructive/5 hover:border-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <input ref={upiInputRef} type="file" accept="image/*" onChange={handleUpiUpload} className="hidden" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 7: AGREEMENTS & VERIFICATION */}
                        {step.id === 7 && (
                          <div className="space-y-6 pt-2">
                            <p className="text-sm text-muted-foreground">
                              Please review and agree to our terms before completing your salon registration.
                            </p>
                            
                            <div className="flex items-start space-x-3">
                              <Checkbox 
                                id="terms" 
                                checked={agreedToTerms}
                                onCheckedChange={(c) => setAgreedToTerms(c as boolean)}
                                className="mt-1"
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor="terms"
                                  className="text-sm font-medium leading-loose peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  I agree to REZ1's {" "}
                                  <Dialog>
                                    <DialogTrigger className="text-[#D2AC47] hover:underline underline-offset-4 focus:outline-none">
                                      Terms &amp; Conditions
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto pt-8">
                                      <DialogHeader className="mb-4">
                                        <DialogTitle className="text-2xl">Terms &amp; Conditions</DialogTitle>
                                      </DialogHeader>
                                      <TermsContent />
                                    </DialogContent>
                                  </Dialog>
                                  {" "} and confirm that I am authorized to register this salon.
                                </label>
                              </div>
                            </div>
                            
                            <div className="flex items-start space-x-3">
                              <Checkbox 
                                id="privacy" 
                                checked={agreedToPrivacy}
                                onCheckedChange={(c) => setAgreedToPrivacy(c as boolean)}
                                className="mt-1"
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor="privacy"
                                  className="text-sm font-medium leading-loose peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  I consent to the collection and use of my business information in accordance with the {" "}
                                  <Dialog>
                                    <DialogTrigger className="text-[#D2AC47] hover:underline underline-offset-4 focus:outline-none">
                                      Privacy Policy
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto pt-8">
                                      <DialogHeader className="mb-4">
                                        <DialogTitle className="text-2xl">Privacy Policy</DialogTitle>
                                      </DialogHeader>
                                      <PrivacyContent />
                                    </DialogContent>
                                  </Dialog>.
                                </label>
                              </div>
                            </div>
                            
                          </div>
                        )}

                        <div className="pt-4 flex justify-end">
                          <Button 
                             onClick={() => handleNext(step.id)} 
                             className={`px-8 transition-all ${(step.id === STEPS.length && (!agreedToTerms || !agreedToPrivacy)) ? "opacity-50 cursor-not-allowed" : "bg-[#D2AC47] text-black hover:bg-[#b59238]"}`}
                             disabled={loading || (step.id === STEPS.length && (!agreedToTerms || !agreedToPrivacy))}
                          >
                            {step.id === STEPS.length ? (loading ? "Submitting..." : "Submit Registration") : "Continue"}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          
        </div>
      </div>
    </div>
  );
}
