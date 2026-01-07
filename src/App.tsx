import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SessionProvider } from "./contexts/SessionContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { TestProgressWidget } from "./components/TestProgressWidget";
import { SupportChat } from "./components/SupportChat";
import { SessionLimitModal } from "./components/SessionLimitModal";
import { useTVNavigation, tvFocusStyles } from "./hooks/useTVNavigation";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProfileSelect from "./pages/ProfileSelect";
import ProfileManage from "./pages/ProfileManage";
import TV from "./pages/TV";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import MyList from "./pages/MyList";
import Admin from "./pages/Admin";
import Install from "./pages/Install";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// TV Navigation wrapper component
const TVNavigationProvider = ({ children }: { children: React.ReactNode }) => {
  useTVNavigation();
  
  useEffect(() => {
    // Inject TV focus styles
    const styleId = 'tv-focus-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = tvFocusStyles;
      document.head.appendChild(style);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, []);
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SessionProvider>
        <TVNavigationProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TestProgressWidget />
            <SupportChat />
            <SessionLimitModal />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/profiles"
                element={
                  <ProtectedRoute>
                    <ProfileSelect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profiles/manage"
                element={
                  <ProtectedRoute>
                    <ProfileManage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tv"
                element={
                  <ProtectedRoute>
                    <TV />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/movies"
                element={
                  <ProtectedRoute>
                    <Movies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/series"
                element={
                  <ProtectedRoute>
                    <Series />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-list"
                element={
                  <ProtectedRoute>
                    <MyList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/install" element={<Install />} />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <Search />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </TVNavigationProvider>
      </SessionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
