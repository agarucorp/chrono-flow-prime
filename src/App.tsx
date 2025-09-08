import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { LoginFormSimple } from "./components/LoginFormSimple";

const App = () => {
  console.log("App renderizando...");
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginFormSimple onLogin={() => {}} />} />
            <Route path="/dashboard" element={
              <div className="min-h-screen bg-background text-foreground p-8">
                <h1 className="text-3xl font-bold mb-4">Panel de Usuario</h1>
                <p className="mb-6">Dashboard funcionando correctamente</p>
                <button 
                  onClick={() => window.location.href = '/login'}
                  className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  Volver al Login
                </button>
              </div>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;