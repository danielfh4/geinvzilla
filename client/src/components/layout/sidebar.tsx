import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartLine, Gauge, Coins, Briefcase, BarChart3, FileText, Settings, ShieldX, User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

interface SidebarProps {
  user: User;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Sidebar({ user, activeSection, onSectionChange }: SidebarProps) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navigationItems = [
    {
      id: "overview",
      label: "Dashboard",
      icon: Gauge,
      roles: ["admin", "user"],
    },
    {
      id: "assets",
      label: "Seleção de Ativos",
      icon: Coins,
      roles: ["admin", "user"],
    },
    {
      id: "portfolios",
      label: "Carteiras",
      icon: Briefcase,
      roles: ["admin", "user"],
    },
    {
      id: "analytics",
      label: "Análises",
      icon: BarChart3,
      roles: ["admin", "user"],
    },
    {
      id: "reports",
      label: "Relatórios",
      icon: FileText,
      roles: ["admin", "user"],
    },
  ];

  const adminItems = [
    {
      id: "management",
      label: "Gestão de Dados",
      icon: Settings,
      roles: ["admin"],
    },
  ];

  const NavItem = ({ item, isActive }: { item: any; isActive: boolean }) => {
    const Icon = item.icon;
    
    return (
      <Button
        variant="ghost"
        className={`w-full justify-start ${
          isActive
            ? "text-primary bg-primary/10 hover:bg-primary/20"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        }`}
        onClick={() => onSectionChange(item.id)}
      >
        <Icon className={`mr-3 h-4 w-4 ${isActive ? "text-primary" : "text-neutral-400"}`} />
        {item.label}
      </Button>
    );
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-white border-r border-neutral-200">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
            <ChartLine className="text-white text-lg" />
          </div>
          <span className="ml-3 text-xl font-semibold text-neutral-900">
            InvestPortfolio
          </span>
        </div>

        {/* User Role Badge */}
        <div className="mb-4 px-6">
          <Badge 
            variant="secondary" 
            className={`${
              user.role === "admin" 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {user.role === "admin" ? (
              <ShieldX className="mr-1 h-3 w-3" />
            ) : (
              <User className="mr-1 h-3 w-3" />
            )}
            {user.role.toUpperCase()}
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          {navigationItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={activeSection === item.id}
              />
            ))}

          {/* Admin Section */}
          {user.role === "admin" && (
            <div className="pt-4 border-t border-neutral-200 mt-4">
              <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Administração
              </p>
              {adminItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activeSection === item.id}
                />
              ))}
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="flex-shrink-0 flex border-t border-neutral-200 p-4">
          <div className="flex items-center w-full">
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {getInitials(user.name)}
              </span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-neutral-700 truncate">
                {user.name}
              </p>
              <Button
                variant="link"
                className="text-xs text-neutral-500 hover:text-neutral-700 p-0 h-auto"
                onClick={handleLogout}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
