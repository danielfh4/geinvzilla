import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Filter, Save, Plus, Settings, X, ChevronUp, ChevronDown, TrendingUp, BarChart } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculatePortfolioMetrics } from "@/lib/calculations";
import type { Asset } from "@shared/schema";

// Asset History Chart Component
function AssetHistoryChart({ assetCode }: { assetCode: string }) {
  const { data: assetHistory, isLoading } = useQuery({
    queryKey: ["/api/assets", assetCode, "history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/assets/${assetCode}/history`);
      return response;
    },
  });

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 animate-pulse opacity-50" />
          <p className="text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  if (!assetHistory || !Array.isArray(assetHistory) || assetHistory.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground">Nenhum histórico disponível</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = assetHistory
    .map((asset: any) => ({
      date: asset.importedAt ? new Date(asset.importedAt).toLocaleDateString('pt-BR') : new Date(asset.createdAt).toLocaleDateString('pt-BR'),
      pu: asset.unitPrice ? parseFloat(asset.unitPrice) : null,
      taxa: asset.rate ? parseFloat(asset.rate.replace(/[^\d,.-]/g, '').replace(',', '.')) : null,
      timestamp: asset.importedAt ? new Date(asset.importedAt).getTime() : new Date(asset.createdAt).getTime()
    }))
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .slice(-12); // Last 12 entries

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis yAxisId="pu" orientation="left" fontSize={12} />
          <YAxis yAxisId="taxa" orientation="right" fontSize={12} />
          <Tooltip 
            formatter={(value, name) => [
              name === 'PU' ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${Number(value).toFixed(2)}%`,
              name
            ]}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
          <Line 
            yAxisId="pu"
            type="monotone" 
            dataKey="pu" 
            stroke="#8884d8" 
            strokeWidth={2}
            name="PU"
            connectNulls={false}
          />
          <Line 
            yAxisId="taxa"
            type="monotone" 
            dataKey="taxa" 
            stroke="#82ca9d" 
            strokeWidth={2}
            name="Taxa (%)"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SelectedAsset {
  asset: Asset;
  quantity: number;
  value: number;
}

interface AssetSelectionProps {
  editingPortfolioId?: number | null;
  onPortfolioSaved?: () => void;
}

export function AssetSelection({ editingPortfolioId, onPortfolioSaved }: AssetSelectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    type: "all",
    indexer: "all",
    minRate: "",
    maxRate: "",
    minValue: "",
    maxValue: "",
    couponMonth: "",
    issuer: "",
    couponMonths: [] as number[],
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [portfolioName, setPortfolioName] = useState("");
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["/api/assets", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") {
          if (Array.isArray(value) && value.length > 0) {
            params.append(key, value.join(','));
          } else if (typeof value === 'string' && value) {
            params.append(key, value);
          }
        }
      });
      
      const response = await fetch(`/api/assets?${params}`);
      if (!response.ok) throw new Error("Failed to fetch assets");
      return response.json();
    },
  });

  // Load existing portfolio data when editing
  const { data: existingPortfolio } = useQuery({
    queryKey: ["/api/portfolios", editingPortfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolios/${editingPortfolioId}`);
      if (!response.ok) throw new Error("Failed to fetch portfolio");
      return response.json();
    },
    enabled: !!editingPortfolioId,
  });

  const { data: existingPortfolioAssets } = useQuery({
    queryKey: ["/api/portfolios", editingPortfolioId, "assets"],
    queryFn: async () => {
      const response = await fetch(`/api/portfolios/${editingPortfolioId}/assets`);
      if (!response.ok) throw new Error("Failed to fetch portfolio assets");
      return response.json();
    },
    enabled: !!editingPortfolioId,
  });

  // Load existing portfolio data when editing
  useEffect(() => {
    if (editingPortfolioId && existingPortfolio && existingPortfolioAssets) {
      setPortfolioName(existingPortfolio.name);
      setSelectedAssets(
        existingPortfolioAssets.map((pa: any) => ({
          asset: pa.asset,
          quantity: parseFloat(pa.quantity),
          value: parseFloat(pa.value),
        }))
      );
    } else if (!editingPortfolioId) {
      // Reset when not editing
      setPortfolioName("");
      setSelectedAssets([]);
    }
  }, [editingPortfolioId, existingPortfolio, existingPortfolioAssets]);

  const savePortfolioMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; assets: SelectedAsset[] }) => {
      let portfolio: any;
      
      if (editingPortfolioId) {
        // Update existing portfolio
        portfolio = await apiRequest("PUT", `/api/portfolios/${editingPortfolioId}`, {
          name: data.name,
          description: data.description,
        });

        // Clear existing assets
        const existingAssets = await fetch(`/api/portfolios/${editingPortfolioId}/assets`, {
          credentials: "include"
        }).then(res => res.json());
        
        for (const asset of existingAssets) {
          await apiRequest("DELETE", `/api/portfolios/${editingPortfolioId}/assets/${asset.assetId}`);
        }
      } else {
        // Create new portfolio
        portfolio = await apiRequest("POST", "/api/portfolios", {
          name: data.name,
          description: data.description,
        });
      }

      const portfolioId = editingPortfolioId || portfolio.id;
      if (!portfolioId) {
        throw new Error("Portfolio operation failed - no ID available");
      }

      // Add selected assets to the portfolio
      for (const selectedAsset of data.assets) {
        await apiRequest("POST", `/api/portfolios/${portfolioId}/assets`, {
          assetId: selectedAsset.asset.id,
          quantity: selectedAsset.quantity.toString(),
          value: selectedAsset.value.toString(),
        });
      }

      return portfolio;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: editingPortfolioId ? "Carteira atualizada com sucesso!" : "Carteira criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setSelectedAssets([]);
      setPortfolioName("");
      onPortfolioSaved?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || `Erro ao ${editingPortfolioId ? 'atualizar' : 'criar'} carteira. Tente novamente.`,
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = (asset: Asset, selected: boolean) => {
    if (selected) {
      const unitPrice = parseFloat(asset.unitPrice || asset.minValue || "1000");
      setSelectedAssets([...selectedAssets, { asset, quantity: 1, value: unitPrice }]);
    } else {
      setSelectedAssets(selectedAssets.filter(sa => sa.asset.id !== asset.id));
    }
  };

  const updateAssetQuantity = (assetId: number, quantity: number) => {
    setSelectedAssets(selectedAssets.map(sa => 
      sa.asset.id === assetId 
        ? { ...sa, quantity, value: quantity * parseFloat(sa.asset.unitPrice || sa.asset.minValue || "1000") }
        : sa
    ));
  };

  const getAssetTypeColor = (type: string) => {
    const colors = {
      CRI: "bg-blue-100 text-blue-800",
      CRA: "bg-green-100 text-green-800", 
      DEB: "bg-purple-100 text-purple-800",
      LCA: "bg-orange-100 text-orange-800",
      CDB: "bg-emerald-100 text-emerald-800",
      FUND: "bg-gray-100 text-gray-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getIndexerColor = (indexer: string) => {
    const colors = {
      "%CDI": "bg-yellow-100 text-yellow-800",
      "CDI+": "bg-amber-100 text-amber-800",
      "IPCA": "bg-red-100 text-red-800",
      "PREFIXADA": "bg-pink-100 text-pink-800",
    };
    return colors[indexer as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const handleSavePortfolio = () => {
    if (!portfolioName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da carteira é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAssets.length === 0) {
      toast({
        title: "Erro", 
        description: "Selecione pelo menos um ativo.",
        variant: "destructive",
      });
      return;
    }

    savePortfolioMutation.mutate({
      name: portfolioName,
      description: `Carteira com ${selectedAssets.length} ativos`,
      assets: selectedAssets,
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAssets = () => {
    if (!assets || !sortConfig) return assets || [];
    
    return [...assets].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Asset];
      let bValue: any = b[sortConfig.key as keyof Asset];
      
      // Handle numeric fields
      if (sortConfig.key === 'unitPrice' || sortConfig.key === 'rate') {
        aValue = parseFloat(aValue?.toString() || '0');
        bValue = parseFloat(bValue?.toString() || '0');
      }
      
      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedAssets = getSortedAssets();
  const portfolioMetrics = calculatePortfolioMetrics(selectedAssets);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">
              {editingPortfolioId ? "Editar Carteira" : "Seleção de Ativos"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingPortfolioId 
                ? "Modifique a composição de ativos da carteira" 
                : "Selecione ativos para compor suas carteiras"
              }
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Settings className="mr-2 h-4 w-4" />
              Filtros Avançados
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedAssets([])}
              disabled={selectedAssets.length === 0}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar Seleção
            </Button>
            <Button onClick={handleSavePortfolio} disabled={selectedAssets.length === 0 || savePortfolioMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {savePortfolioMutation.isPending 
                ? (editingPortfolioId ? "Atualizando..." : "Salvando...") 
                : (editingPortfolioId ? "Atualizar Carteira" : "Salvar Carteira")
              }
            </Button>
          </div>
        </div>

        {/* Portfolio Name Input */}
        {selectedAssets.length > 0 && (
          <div className="mb-4">
            <Label htmlFor="portfolioName">Nome da Carteira</Label>
            <Input
              id="portfolioName"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              placeholder="Digite o nome da carteira"
              className="max-w-md"
            />
          </div>
        )}

        {/* Portfolio Metrics Summary - Top of page */}
        {selectedAssets.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Main Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingPortfolioId ? "Resumo da Carteira" : "Carteira em Construção"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{portfolioMetrics.totalAssets}</div>
                    <div className="text-sm text-neutral-600">Ativos Selecionados</div>
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
                    <div className="text-sm text-neutral-600">Taxa Média Geral</div>
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

            {/* Weighted Rates by Indexer */}
            {Object.keys(portfolioMetrics.weightedRateByIndexer).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Taxas Médias Ponderadas por Indexador</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(portfolioMetrics.weightedRateByIndexer).map(([indexer, rate]) => (
                      <div key={indexer} className="text-center p-4 border rounded-lg">
                        <div className={`text-xl font-bold ${
                          indexer === 'IPCA' ? 'text-red-600' :
                          indexer.includes('CDI') ? 'text-yellow-600' :
                          indexer === 'PREFIXADA' ? 'text-pink-600' :
                          'text-blue-600'
                        }`}>
                          {rate.toFixed(2)}%
                        </div>
                        <div className="text-sm text-neutral-600">Taxa Média {indexer}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Filters */}
        {showAdvancedFilters && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <Label className="text-sm font-medium text-neutral-700">Taxa Máxima (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  value={filters.maxRate}
                  onChange={(e) => setFilters({...filters, maxRate: e.target.value})}
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Valor Mínimo (R$)</Label>
                <Input
                  type="number"
                  step="1000"
                  placeholder="1000"
                  value={filters.minValue}
                  onChange={(e) => setFilters({...filters, minValue: e.target.value})}
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Valor Máximo (R$)</Label>
                <Input
                  type="number"
                  step="1000"
                  placeholder="1000000"
                  value={filters.maxValue}
                  onChange={(e) => setFilters({...filters, maxValue: e.target.value})}
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-neutral-700">Múltiplos Meses de Cupom</Label>
                <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                    <Button
                      key={month}
                      type="button"
                      variant={filters.couponMonths.includes(month) ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const newMonths = filters.couponMonths.includes(month)
                          ? filters.couponMonths.filter(m => m !== month)
                          : [...filters.couponMonths, month];
                        setFilters({...filters, couponMonths: newMonths});
                      }}
                    >
                      {month}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-sm font-medium text-neutral-700">Tipo de Ativo</Label>
                <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CRI">CRI</SelectItem>
                    <SelectItem value="CRA">CRA</SelectItem>
                    <SelectItem value="DEB">Debêntures</SelectItem>
                    <SelectItem value="LCA">LCA</SelectItem>
                    <SelectItem value="CDB">CDB</SelectItem>
                    <SelectItem value="FUND">Fundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Indexador</Label>
                <Select value={filters.indexer} onValueChange={(value) => setFilters({...filters, indexer: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="%CDI">%CDI</SelectItem>
                    <SelectItem value="CDI+">CDI+</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                    <SelectItem value="PREFIXADA">PREFIXADA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Taxa Mínima (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filters.minRate}
                  onChange={(e) => setFilters({...filters, minRate: e.target.value})}
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Mês do Cupom</Label>
                <Select value={filters.couponMonth} onValueChange={(value) => setFilters({...filters, couponMonth: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    <SelectItem value="01">Janeiro</SelectItem>
                    <SelectItem value="02">Fevereiro</SelectItem>
                    <SelectItem value="03">Março</SelectItem>
                    <SelectItem value="04">Abril</SelectItem>
                    <SelectItem value="05">Maio</SelectItem>
                    <SelectItem value="06">Junho</SelectItem>
                    <SelectItem value="07">Julho</SelectItem>
                    <SelectItem value="08">Agosto</SelectItem>
                    <SelectItem value="09">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-neutral-700">Emissor</Label>
                <Input
                  placeholder="Nome do emissor"
                  value={filters.issuer}
                  onChange={(e) => setFilters({...filters, issuer: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ativos Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando ativos...</p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('name')}>
                        <div className="flex items-center">
                          Ativo
                          {sortConfig?.key === 'name' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('type')}>
                        <div className="flex items-center">
                          Tipo
                          {sortConfig?.key === 'type' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('issuer')}>
                        <div className="flex items-center">
                          Emissor
                          {sortConfig?.key === 'issuer' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('rate')}>
                        <div className="flex items-center">
                          Taxa
                          {sortConfig?.key === 'rate' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('indexer')}>
                        <div className="flex items-center">
                          Indexador
                          {sortConfig?.key === 'indexer' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('dueDate')}>
                        <div className="flex items-center">
                          Vencimento
                          {sortConfig?.key === 'dueDate' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('unitPrice')}>
                        <div className="flex items-center">
                          PU
                          {sortConfig?.key === 'unitPrice' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Cupom</TableHead>
                      <TableHead>Rem%</TableHead>
                      <TableHead>Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssets?.map((asset: Asset) => {
                      const isSelected = selectedAssets.some(sa => sa.asset.id === asset.id);
                      const selectedAsset = selectedAssets.find(sa => sa.asset.id === asset.id);
                      
                      return (
                        <TableRow key={asset.id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleAssetSelect(asset, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div 
                                className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                                onClick={() => setSelectedAssetForDetail(asset)}
                              >
                                {asset.name}
                              </div>
                              <div className="text-sm text-muted-foreground">{asset.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getAssetTypeColor(asset.type)}>
                              {asset.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{asset.issuer}</TableCell>
                          <TableCell>{asset.rate}</TableCell>
                          <TableCell>
                            <Badge className={getIndexerColor(asset.indexer)}>
                              {asset.indexer}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              if (!asset.maturityDate) return '-';
                              const date = new Date(asset.maturityDate);
                              return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              if (!asset.unitPrice && !asset.minValue) return '-';
                              
                              const price = asset.unitPrice || asset.minValue;
                              if (!price || price === 'null') return '-';
                              
                              const numericPrice = typeof price === 'string' ? 
                                parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.')) : 
                                parseFloat(price);
                              
                              if (isNaN(numericPrice) || numericPrice <= 0) return '-';
                              
                              return `R$ ${numericPrice.toLocaleString('pt-BR', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })}`;
                            })()}
                          </TableCell>
                          <TableCell>{asset.frequency || '-'}</TableCell>
                          <TableCell>{asset.couponMonths || '-'}</TableCell>
                          <TableCell>
                            {(() => {
                              if (!asset.remPercentage) return '-';
                              const numericValue = typeof asset.remPercentage === 'string' ? 
                                parseFloat(asset.remPercentage.replace(/[^\d.,]/g, '').replace(',', '.')) : 
                                parseFloat(asset.remPercentage);
                              return isNaN(numericValue) ? '-' : `${numericValue.toFixed(2)}%`;
                            })()}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <Input
                                type="number"
                                min="0"
                                value={selectedAsset?.quantity || 0}
                                onChange={(e) => updateAssetQuantity(asset.id, parseInt(e.target.value) || 0)}
                                className="w-20"
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Detail Modal */}
        {selectedAssetForDetail && (
          <Dialog open={!!selectedAssetForDetail} onOpenChange={() => setSelectedAssetForDetail(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold">{selectedAssetForDetail.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedAssetForDetail.code}</div>
                  </div>
                  <div className="flex space-x-2">
                    <Badge className={getAssetTypeColor(selectedAssetForDetail.type)}>
                      {selectedAssetForDetail.type}
                    </Badge>
                    <Badge className={getIndexerColor(selectedAssetForDetail.indexer)}>
                      {selectedAssetForDetail.indexer}
                    </Badge>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Asset Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informações do Ativo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Emissor</Label>
                        <div className="font-medium">{selectedAssetForDetail.issuer}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Taxa</Label>
                        <div className="font-medium text-green-600">{selectedAssetForDetail.rate}%</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Vencimento</Label>
                        <div className="font-medium">{selectedAssetForDetail.maturityDate}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Preço Unitário</Label>
                        <div className="font-medium">
                          R$ {selectedAssetForDetail.unitPrice ? 
                            parseFloat(selectedAssetForDetail.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 
                            parseFloat(selectedAssetForDetail.minValue).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Frequência Cupom</Label>
                        <div className="font-medium">{selectedAssetForDetail.frequency || 'N/A'}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Meses Cupom</Label>
                        <div className="font-medium">{selectedAssetForDetail.couponMonths || 'N/A'}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Valor Mínimo</Label>
                        <div className="font-medium">R$ {parseFloat(selectedAssetForDetail.minValue).toLocaleString('pt-BR')}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Comissão</Label>
                        <div className="font-medium">{selectedAssetForDetail.remPercentage ? `${parseFloat(selectedAssetForDetail.remPercentage).toFixed(2)}%` : '0%'}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Data dos Dados</Label>
                        <div className="font-medium">
                          {(() => {
                            const dateToFormat = selectedAssetForDetail.importedAt || selectedAssetForDetail.createdAt;
                            if (!dateToFormat) return 'Data não disponível';
                            
                            const date = new Date(dateToFormat);
                            if (isNaN(date.getTime())) return 'Data inválida';
                            
                            return date.toLocaleDateString('pt-BR');
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Historical Price and Rate Chart */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Histórico de PU e Taxa - {selectedAssetForDetail.code}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AssetHistoryChart assetCode={selectedAssetForDetail.code} />
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedAssetForDetail(null)}>
                  Fechar
                </Button>
                <Button 
                  onClick={() => {
                    handleAssetSelect(selectedAssetForDetail, true);
                    setSelectedAssetForDetail(null);
                  }}
                  disabled={selectedAssets.some(sa => sa.asset.id === selectedAssetForDetail.id)}
                >
                  {selectedAssets.some(sa => sa.asset.id === selectedAssetForDetail.id) ? 'Já Selecionado' : 'Adicionar à Carteira'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
}
