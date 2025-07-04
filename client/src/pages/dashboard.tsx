import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Overview } from "@/components/dashboard/overview";
import { AssetSelection } from "@/components/dashboard/asset-selection";
import { Analytics } from "@/components/dashboard/analytics";
import { Management } from "@/components/dashboard/management";
import { Reports } from "@/components/dashboard/reports";
import { Portfolios } from "@/components/dashboard/portfolios";
import { UserManagement } from "@/components/dashboard/user-management";
import { ParameterManagement } from "@/components/dashboard/parameter-management";
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("overview");
  const [editingPortfolioId, setEditingPortfolioId] = useState<number | null>(null);

  // Create a user object for dashboard functionality
  const user = {
    id: 1,
    username: "admin",
    role: "admin",
    password: "",
    name: "Administrator",
    email: "admin@investportfolio.com",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const getSectionTitle = () => {
    const titles = {
      overview: "Dashboard",
      assets: "Seleção de Ativos", 
      portfolios: "Carteiras",
      analytics: "Análises",
      reports: "Relatórios",
      management: "Gestão de Dados",
      users: "Gestão de Usuários",
      parameters: "Parâmetros",
    };
    return titles[activeSection as keyof typeof titles] || "Dashboard";
  };

  const handleEditPortfolio = (portfolioId: number) => {
    setEditingPortfolioId(portfolioId);
    setActiveSection("assets");
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "overview":
        return <Overview />;
      case "assets":
        return <AssetSelection editingPortfolioId={editingPortfolioId} onPortfolioSaved={() => {
          setEditingPortfolioId(null);
          setActiveSection("portfolios");
        }} />;
      case "portfolios":
        return <Portfolios onEditPortfolio={handleEditPortfolio} />;
      case "analytics":
        return <Analytics />;
      case "reports":
        return <Reports />;
      case "management":
        return user.role === "admin" ? <Management /> : <Overview />;
      case "users":
        return user.role === "admin" ? <UserManagement /> : <Overview />;
      case "parameters":
        return user.role === "admin" ? <ParameterManagement /> : <Overview />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar 
        user={user} 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
      />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-neutral-200">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {getSectionTitle()}
            </h1>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <Bell className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-neutral-50">
          {renderActiveSection()}
        </main>
      </div>
    </div>
  );
}
