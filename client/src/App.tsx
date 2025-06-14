import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        onLogin();
      } else {
        setError("Credenciais inválidas");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f3f4f6",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        padding: "2rem",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}>
        <h1 style={{
          fontSize: "1.875rem",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "1.5rem",
          color: "#1f2937"
        }}>
          InvestPortfolio
        </h1>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "1rem",
                boxSizing: "border-box"
              }}
              required
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "1rem",
                boxSizing: "border-box"
              }}
              required
            />
          </div>
          
          {error && (
            <div style={{ color: "#dc2626", fontSize: "0.875rem", textAlign: "center" }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
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
      users: "Usuários",
      parameters: "Parâmetros"
    };
    return titles[activeSection as keyof typeof titles] || "Dashboard";
  };

  const handleEditPortfolio = (portfolioId: number) => {
    setEditingPortfolioId(portfolioId);
    setActiveSection("assets");
  };

  const handlePortfolioSaved = () => {
    setEditingPortfolioId(null);
    setActiveSection("portfolios");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <Overview />;
      case "assets":
        return (
          <AssetSelection 
            editingPortfolioId={editingPortfolioId}
            onPortfolioSaved={handlePortfolioSaved}
          />
        );
      case "portfolios":
        return <Portfolios onEditPortfolio={handleEditPortfolio} />;
      case "analytics":
        return <Analytics />;
      case "reports":
        return <Reports />;
      case "management":
        return <Management />;
      case "users":
        return <UserManagement />;
      case "parameters":
        return <ParameterManagement />;
      default:
        return <Overview />;
    }
  };

  const sections = [
    { id: "overview", name: "Dashboard", icon: "📊" },
    { id: "assets", name: "Seleção de Ativos", icon: "💼" },
    { id: "portfolios", name: "Carteiras", icon: "📈" },
    { id: "analytics", name: "Análises", icon: "📉" },
    { id: "reports", name: "Relatórios", icon: "📄" },
    { id: "management", name: "Gestão de Dados", icon: "⚙️" },
    { id: "users", name: "Usuários", icon: "👥" },
    { id: "parameters", name: "Parâmetros", icon: "🔧" }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">InvestPortfolio</h1>
          <p className="text-sm text-gray-500">Sistema de Gestão</p>
        </div>
        
        <nav className="mt-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center px-6 py-3 text-sm font-medium ${
                activeSection === section.id
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="mr-3">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
        
        <div className="absolute bottom-0 w-64 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-gray-500">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {getSectionTitle()}
            </h1>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsLoggedIn(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {isLoggedIn ? (
          <Dashboard onLogout={handleLogout} />
        ) : (
          <LoginForm onLogin={handleLogin} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;