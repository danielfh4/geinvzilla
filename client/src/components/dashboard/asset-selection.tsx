import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Filter, Save, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculatePortfolioMetrics } from "@/lib/calculations";
import type { Asset } from "@shared/schema";

interface SelectedAsset {
  asset: Asset;
  quantity: number;
  value: number;
}

export function AssetSelection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    type: "all",
    indexer: "all",
    minRate: "",
    minValue: "",
    issuer: "",
  });
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [portfolioName, setPortfolioName] = useState("");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["/api/assets", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      
      const response = await fetch(`/api/assets?${params}`);
      if (!response.ok) throw new Error("Failed to fetch assets");
      return response.json();
    },
  });

  const createPortfolioMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; assets: SelectedAsset[] }) => {
      // First create the portfolio
      const portfolio: any = await apiRequest("POST", "/api/portfolios", {
        name: data.name,
        description: data.description,
      });

      console.log("Created portfolio:", portfolio);

      if (!portfolio || !portfolio.id) {
        throw new Error("Portfolio creation failed - no ID returned");
      }

      // Then add each selected asset to the portfolio
      for (const selectedAsset of data.assets) {
        console.log(`Adding asset ${selectedAsset.asset.id} to portfolio ${portfolio.id}`);
        await apiRequest("POST", `/api/portfolios/${portfolio.id}/assets`, {
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
        description: "Carteira criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setSelectedAssets([]);
      setPortfolioName("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar carteira. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = (asset: Asset, selected: boolean) => {
    if (selected) {
      const unitPrice = parseFloat((asset as any).unitPrice || asset.minValue || 1000);
      setSelectedAssets([...selectedAssets, { asset, quantity: 1, value: unitPrice }]);
    } else {
      setSelectedAssets(selectedAssets.filter(sa => sa.asset.id !== asset.id));
    }
  };

  const updateAssetQuantity = (assetId: number, quantity: number) => {
    setSelectedAssets(selectedAssets.map(sa => 
      sa.asset.id === assetId 
        ? { ...sa, quantity, value: quantity * parseFloat((sa.asset as any).unitPrice || sa.asset.minValue || 1000) }
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

    createPortfolioMutation.mutate({
      name: portfolioName,
      description: `Carteira com ${selectedAssets.length} ativos`,
      assets: selectedAssets,
    });
  };

  const portfolioMetrics = calculatePortfolioMetrics(selectedAssets);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">Seleção de Ativos</h2>
            <p className="mt-1 text-sm text-neutral-600">Selecione ativos para compor suas carteiras</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtros Avançados
            </Button>
            <Button onClick={handleSavePortfolio} disabled={selectedAssets.length === 0}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Carteira
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

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
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
                    <SelectItem value="CDI">CDI</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                    <SelectItem value="SELIC">SELIC</SelectItem>
                    <SelectItem value="PREFIXADO">PREFIXADO</SelectItem>
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
                <Label className="text-sm font-medium text-neutral-700">Valor Mínimo</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={filters.minValue}
                  onChange={(e) => setFilters({...filters, minValue: e.target.value})}
                />
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Emissor</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Indexador</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor Min.</TableHead>
                      <TableHead>Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets?.map((asset: Asset) => {
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
                              <div className="font-medium">{asset.name}</div>
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
                          <TableCell>{asset.indexer}</TableCell>
                          <TableCell>{asset.maturityDate}</TableCell>
                          <TableCell>R$ {parseFloat(asset.minValue).toLocaleString('pt-BR')}</TableCell>
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

        {/* Selected Assets Summary */}
        {selectedAssets.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Carteira em Construção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="text-sm text-neutral-600">Taxa Média Ponderada</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
