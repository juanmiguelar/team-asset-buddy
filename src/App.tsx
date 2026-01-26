import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Scanner from "./pages/Scanner";
import AssetDetail from "./pages/AssetDetail";
import LicenseDetail from "./pages/LicenseDetail";
import CreateAsset from "./pages/CreateAsset";
import CreateLicense from "./pages/CreateLicense";
import EditAsset from "./pages/EditAsset";
import EditLicense from "./pages/EditLicense";
import OrganizationSettings from "./pages/OrganizationSettings";
import OrganizationMembers from "./pages/OrganizationMembers";
import CreateOrganization from "./pages/CreateOrganization";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/scan" element={<Scanner />} />
              <Route path="/asset/:id" element={<AssetDetail />} />
              <Route path="/license/:id" element={<LicenseDetail />} />
              <Route path="/admin/create-asset" element={<CreateAsset />} />
              <Route path="/admin/create-license" element={<CreateLicense />} />
              <Route path="/admin/edit-asset/:id" element={<EditAsset />} />
              <Route path="/admin/edit-license/:id" element={<EditLicense />} />
              <Route path="/organization/settings" element={<OrganizationSettings />} />
              <Route path="/organization/members" element={<OrganizationMembers />} />
              <Route path="/organization/create" element={<CreateOrganization />} />
              <Route path="/invite/accept" element={<AcceptInvite />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
