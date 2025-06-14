import { useState } from "react";

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

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Dashboard</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
              <div style={{ padding: "1.5rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Total de Ativos</h3>
                <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#2563eb" }}>0</p>
              </div>
              <div style={{ padding: "1.5rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Carteiras Ativas</h3>
                <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#059669" }}>0</p>
              </div>
              <div style={{ padding: "1.5rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Valor Total</h3>
                <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#7c3aed" }}>R$ 0,00</p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
              {sections.find(s => s.id === activeSection)?.name || "Seção"}
            </h2>
            <div style={{ padding: "2rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", textAlign: "center" }}>
              <p style={{ color: "#6b7280" }}>Esta seção está sendo desenvolvida.</p>
              <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>Funcionalidades completas serão adicionadas em breve.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Sidebar */}
      <div style={{ width: "250px", backgroundColor: "#1f2937", color: "white", padding: "1rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold" }}>InvestPortfolio</h1>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Sistema de Gestão</p>
        </div>
        
        <nav>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                marginBottom: "0.25rem",
                backgroundColor: activeSection === section.id ? "#374151" : "transparent",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.875rem",
                textAlign: "left"
              }}
            >
              <span>{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
        
        <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem"
            }}
          >
            Sair
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ flex: 1, padding: "2rem" }}>
        {renderContent()}
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

  return isLoggedIn ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <LoginForm onLogin={handleLogin} />
  );
}

export default App;