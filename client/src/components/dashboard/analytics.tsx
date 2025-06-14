import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { calculatePortfolioMetrics, formatConcentrationData } from "@/lib/calculations";
import type { Portfolio } from "@shared/schema";

const COLORS = ["hsl(215, 100%, 32%)", "hsl(158, 64%, 52%)", "hsl(0, 74%, 42%)", "hsl(45, 93%, 47%)", "hsl(270, 75%, 60%)"];

export function Analytics() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const { data: portfolios } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: portfolioAssets } = useQuery({
    queryKey: ["/api/portfolios", selectedPortfolioId, "assets"],
    queryFn: async () => {
      const response = await fetch(`/api/portfolios/${selectedPortfolioId}/assets`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio assets");
      return response.json();
    },
    enabled: !!selectedPortfolioId,
  });

  const { data: economicParameters } = useQuery({
    queryKey: ["/api/parameters"],
  });

  const portfolioMetrics = portfolioAssets ? calculatePortfolioMetrics(
    portfolioAssets.map((pa: any) => ({
      asset: pa.asset,
      quantity: parseFloat(pa.quantity),
      value: parseFloat(pa.value),
    })),
    economicParameters
  ) : null;

  const issuerData = portfolioMetrics ? formatConcentrationData(portfolioMetrics.concentrationByIssuer).map((item, index) => ({
    name: item.name,
    value: item.percentage,
    color: COLORS[index % COLORS.length]
  })) : [];

  const assetTypeData = portfolioAssets ? 
    Object.entries(
      portfolioAssets.reduce((acc: Record<string, number>, pa: any) => {
        const type = pa.asset.type;
        const weight = portfolioMetrics ? (parseFloat(pa.value) / portfolioMetrics.totalValue) * 100 : 0;
        acc[type] = (acc[type] || 0) + weight;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value: Math.round(Number(value)) })) : [];

  const indexerData = portfolioMetrics ? formatConcentrationData(portfolioMetrics.concentrationByIndexer).map(item => ({
    name: item.name,
    value: Math.round(item.percentage)
  })) : [];

  const couponData = portfolioMetrics ? portfolioMetrics.monthlyCoupons.map((value, index) => ({
    month: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][index],
    value: Math.round(value)
  })) : [];

  const concentrationData = portfolioMetrics ? {
    issuers: formatConcentrationData(portfolioMetrics.concentrationByIssuer).slice(0, 5),
    sectors: formatConcentrationData(portfolioMetrics.concentrationBySector).slice(0, 5),
    indexers: formatConcentrationData(portfolioMetrics.concentrationByIndexer)
  } : { issuers: [], sectors: [], indexers: [] };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const ConcentrationBar = ({ name, percentage, color = "bg-primary" }: { name: string; percentage: number; color?: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-neutral-600">{name}</span>
        <span className="text-sm font-medium text-neutral-900">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div 
          className={`${color} h-2 rounded-full transition-all duration-300`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Análises e Visualizações</h2>
        <p className="mt-1 text-sm text-neutral-600">Visualize a distribuição e performance das carteiras</p>
        
        {/* Portfolio Selection */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Selecionar Carteira para Análise
          </label>
          <Select value={selectedPortfolioId || ""} onValueChange={setSelectedPortfolioId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Escolha uma carteira..." />
            </SelectTrigger>
            <SelectContent>
              {portfolios?.map((portfolio) => (
                <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                  {portfolio.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedPortfolioId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-neutral-500 text-lg">
              Selecione uma carteira para visualizar as análises detalhadas
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Portfolio Summary */}
          {portfolioMetrics && (
            <div className="mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo da Carteira</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{portfolioMetrics.totalAssets}</div>
                      <div className="text-sm text-neutral-600">Total de Ativos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-secondary">
                        R$ {portfolioMetrics.totalValue.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-sm text-neutral-600">Valor Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {portfolioMetrics.weightedRate.toFixed(2)}%
                      </div>
                      <div className="text-sm text-neutral-600">Taxa Média Ponderada</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        R$ {portfolioMetrics.totalCommission.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-sm text-neutral-600">Comissão Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Distribution by Issuer */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Emissor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={issuerData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {issuerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribution by Asset Type */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Tipo de Ativo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assetTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {assetTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribution by Indexer */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Indexador</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={indexerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, "Distribuição"]} />
                    <Bar dataKey="value" fill="hsl(215, 100%, 32%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Coupons */}
            <Card>
              <CardHeader>
                <CardTitle>Projeção de Cupons Mensais</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={couponData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${value}`, "Cupons"]} />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(215, 100%, 32%)" 
                      strokeWidth={2}
                      fill="rgba(30, 58, 138, 0.1)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Concentration Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Concentração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3">Por Emissor</h4>
                  <div className="space-y-3">
                    {concentrationData.issuers.map((item, index) => (
                      <ConcentrationBar 
                        key={item.name}
                        name={item.name} 
                        percentage={item.percentage}
                        color={index === 0 ? "bg-primary" : index === 1 ? "bg-secondary" : "bg-accent"}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3">Por Setor</h4>
                  <div className="space-y-3">
                    {concentrationData.sectors.map((item, index) => (
                      <ConcentrationBar 
                        key={item.name}
                        name={item.name} 
                        percentage={item.percentage}
                        color={index === 0 ? "bg-primary" : index === 1 ? "bg-secondary" : "bg-accent"}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3">Por Indexador</h4>
                  <div className="space-y-3">
                    {concentrationData.indexers.map((item, index) => (
                      <ConcentrationBar 
                        key={item.name}
                        name={item.name} 
                        percentage={item.percentage}
                        color={index === 0 ? "bg-primary" : "bg-secondary"}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}