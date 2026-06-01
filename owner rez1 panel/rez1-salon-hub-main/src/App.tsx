import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BookingNotification } from "@/components/BookingNotification";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import SplashPage from "./pages/SplashPage";
import PhoneLoginPage from "./pages/PhoneLoginPage";
import OtpVerifyPage from "./pages/OtpVerifyPage";
import LoginPage from "./pages/LoginPage";
import RegisterSalonPage from "./pages/RegisterSalonPage";

import DashboardPage from "./pages/DashboardPage";
import SlotsPage from "./pages/SlotsPage";
import BookingsPage from "./pages/BookingsPage";
import SettingsPage from "./pages/SettingsPage";
import AddSalonPage from "./pages/AddSalonPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import SuspendedPage from "./pages/SuspendedPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BookingNotification />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/phone-login" element={<PhoneLoginPage />} />
            <Route path="/verify-otp" element={<OtpVerifyPage />} />
            <Route path="/login-credentials" element={<LoginPage />} />
            <Route path="/register" element={<RegisterSalonPage />} />

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/slots" element={<SlotsPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/add-salon" element={<AddSalonPage />} />
            <Route path="/suspended" element={<SuspendedPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
