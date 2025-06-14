import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Coins, TrendingUp, DollarSign, Plus, Search, Download } from "lucide-react";
import { calculatePortfolioMetrics } from "@/lib/calculations";
import type { Portfolio } from "@shared/schema";

export function Overview() {
  const { data: assets } = useQuery({
    queryKey: ["/api/assets"],
  });

  const { data: portfolios } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: economicParameters } = useQuery({
    queryKey: ["/api/parameters"],
  });

  // Calculate aggregated metrics from all portfolios
  const calculateAggregatedMetrics = async () => {
    if (!portfolios || portfolios.length === 0) {
      return {
        activePortfolios: 0,
        totalAssets: assets?.length || 0,
        averageRate: 0,
        totalVolume: 0,
      };
    }

    let totalValue = 0;
    let totalWeightedRate = 0;
    let totalAssetsInPortfolios = 0;

    for (const portfolio of portfolios) {
      try {
        const response = await fetch(`/api/portfolios/${portfolio.id}/assets`, {
          credentials: "include",
        });
        if (response.ok) {
          const portfolioAssets = await response.json();
          const selectedAssets = portfolioAssets.map((pa: any) => ({
            asset: pa.asset,
            quantity: parseFloat(pa.quantity),
            value: parseFloat(pa.value),
          }));

          const metrics = calculatePortfolioMetrics(selectedAssets, economicParameters);
          if (metrics) {
            totalValue += metrics.totalValue;
            totalWeightedRate += metrics.weightedRate * metrics.totalValue;
            totalAssetsInPortfolios += metrics.totalAssets;
          }
        }
      } catch (error) {
        console.error(`Error fetching portfolio ${portfolio.id}:`, error);
      }
    }

    return {
      activePortfolios: portfolios.length,
      totalAssets: assets?.length || 0,
      averageRate: totalValue > 0 ? totalWeightedRate / totalValue : 0,
      totalVolume: totalValue,
    };
  };

  const { data: metrics } = useQuery({
    queryKey: ["/api/portfolios/aggregated-metrics", portfolios, economicParameters],
    queryFn: calculateAggregatedMetrics,
    enabled: !!portfolios && !!economicParameters,
  });

  const displayMetrics = metrics || {
    activePortfolios: portfolios?.length || 0,
    totalAssets: assets?.length || 0,
    averageRate: 0,
    totalVolume: 0,
  };

  const recentActivity = [
    {
      id: 1,
      type: "portfolio",
      action: "Nova carteira criada",
      description: "Carteira Conservadora",
      time: "2h atrás",
      icon: Plus,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: 2,
      type: "asset",
      action: "Ativos atualizados",
      description: "15 CDBs",
      time: "4h atrás",
      icon: Coins,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      id: 3,
      type: "report",
      action: "Relatório exportado",
      description: "Análise Trimestral",
      time: "1 dia atrás",
      icon: Download,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  const quickActions = [
    {
      title: "Nova Carteira",
      description: "Criar uma nova carteira de investimentos",
      icon: Plus,
      color: "text-primary",
      bgColor: "bg-primary/10",
      action: "assets",
    },
    {
      title: "Buscar Ativos",
      description: "Encontrar ativos para sua carteira",
      icon: Search,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      action: "assets",
    },
    {
      title: "Exportar Relatório",
      description: "Gerar relatório em PDF ou Excel",
      icon: Download,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      action: "reports",
    },
  ];

  return (
    <div className="p-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600">Carteiras Ativas</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {displayMetrics.activePortfolios}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                  <Coins className="h-4 w-4 text-secondary" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600">Ativos Cadastrados</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {displayMetrics.totalAssets}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600">Taxa Média</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {displayMetrics.averageRate.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-600">Volume Total</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  R$ {displayMetrics.totalVolume.toLocaleString('pt-BR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-neutral-900">
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivity.map((activity, index) => {
                  const Icon = activity.icon;
                  const isLast = index === recentActivity.length - 1;
                  
                  return (
                    <li key={activity.id}>
                      <div className={`relative ${!isLast ? "pb-8" : ""}`}>
                        {!isLast && (
                          <span 
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-neutral-200" 
                            aria-hidden="true" 
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full ${activity.bgColor} flex items-center justify-center`}>
                              <Icon className={`h-4 w-4 ${activity.color}`} />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-neutral-900">
                                {activity.action}: <span className="font-medium">{activity.description}</span>
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-neutral-500">
                              <time>{activity.time}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-neutral-900">
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                
                return (
                  <Button
                    key={action.title}
                    variant="ghost"
                    className="w-full justify-start p-3 h-auto border border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex items-center w-full">
                      <div className={`w-8 h-8 ${action.bgColor} rounded-lg flex items-center justify-center mr-3`}>
                        <Icon className={`h-4 w-4 ${action.color}`} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-neutral-900">{action.title}</p>
                        <p className="text-xs text-neutral-500">{action.description}</p>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
