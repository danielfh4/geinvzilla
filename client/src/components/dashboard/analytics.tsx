import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const COLORS = ["hsl(215, 100%, 32%)", "hsl(158, 64%, 52%)", "hsl(0, 74%, 42%)", "hsl(45, 93%, 47%)", "hsl(270, 75%, 60%)"];

export function Analytics() {
  const [issuerData] = useState([
    { name: "BTG Pactual", value: 25, color: COLORS[0] },
    { name: "XP Securitizadora", value: 20, color: COLORS[1] },
    { name: "Vale S.A.", value: 18, color: COLORS[2] },
    { name: "Banco do Brasil", value: 15, color: COLORS[3] },
    { name: "Outros", value: 22, color: COLORS[4] },
  ]);

  const [assetTypeData] = useState([
    { name: "CRI", value: 35 },
    { name: "CDB", value: 25 },
    { name: "Debêntures", value: 15 },
    { name: "LCA", value: 10 },
    { name: "CRA", value: 8 },
    { name: "Fundos", value: 7 },
  ]);

  const [indexerData] = useState([
    { name: "CDI", value: 60 },
    { name: "IPCA", value: 25 },
    { name: "SELIC", value: 10 },
    { name: "PREFIXADO", value: 5 },
  ]);

  const [couponData] = useState([
    { month: "Jan", value: 2500 },
    { month: "Fev", value: 2800 },
    { month: "Mar", value: 2600 },
    { month: "Abr", value: 2900 },
    { month: "Mai", value: 3100 },
    { month: "Jun", value: 2700 },
    { month: "Jul", value: 2850 },
    { month: "Ago", value: 3200 },
    { month: "Set", value: 2950 },
    { month: "Out", value: 3300 },
    { month: "Nov", value: 3100 },
    { month: "Dez", value: 3400 },
  ]);

  const concentrationData = {
    issuers: [
      { name: "BTG Pactual", percentage: 25 },
      { name: "XP Securitizadora", percentage: 20 },
      { name: "Vale S.A.", percentage: 18 },
    ],
    sectors: [
      { name: "Financeiro", percentage: 45 },
      { name: "Imobiliário", percentage: 30 },
      { name: "Industrial", percentage: 25 },
    ],
    indexers: [
      { name: "CDI", percentage: 60 },
      { name: "IPCA", percentage: 40 },
    ],
  };

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
        <span className="text-sm font-medium text-neutral-900">{percentage}%</span>
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
      </div>

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
    </div>
  );
}
