import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { LoginForm } from "./components/LoginForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { Navigation } from "./components/Navigation";
import Index from "./pages/Index";
import Turnos from "./pages/Turnos";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginForm onLogin={() => {}} />} />
              <Route path="/reset-password" element={<ResetPasswordForm />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <>
                    <Navigation />
                    <Index />
                  </>
                </ProtectedRoute>
              } />
              <Route path="/turnos" element={
                <ProtectedRoute>
                  <>
                    <Navigation />
                    <Turnos />
                  </>
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedAdminRoute>
                  <>
                    <Navigation />
                    <Admin />
                  </>
                </ProtectedAdminRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
