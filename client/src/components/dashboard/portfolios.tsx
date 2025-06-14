import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Briefcase, Plus, Edit, Trash2, Eye, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculatePortfolioMetrics } from "@/lib/calculations";
import type { Portfolio, Asset, PortfolioAsset } from "@shared/schema";

const portfolioSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type PortfolioFormData = z.infer<typeof portfolioSchema>;

interface PortfolioWithAssets extends Portfolio {
  assets?: (PortfolioAsset & { asset: Asset })[];
}

interface PortfoliosProps {
  onEditPortfolio?: (portfolioId: number) => void;
}

export function Portfolios({ onEditPortfolio }: PortfoliosProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioWithAssets | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [portfolioAssetsCache] = useState(new Map());

  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { data: portfolios, isLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const portfoliosArray = portfolios || [];



  const createPortfolioMutation = useMutation({
    mutationFn: async (data: PortfolioFormData) => {
      return apiRequest("POST", "/api/portfolios", data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Carteira criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowCreateDialog(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar carteira. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PortfolioFormData> }) => {
      return apiRequest("PUT", `/api/portfolios/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Carteira atualizada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowEditDialog(false);
      setSelectedPortfolio(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar carteira. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/portfolios/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Carteira excluída com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir carteira. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const { data: portfolioAssetsData } = useQuery({
    queryKey: ["/api/portfolios", selectedPortfolio?.id, "assets"],
    enabled: !!selectedPortfolio?.id,
    queryFn: async () => {
      const response = await fetch(`/api/portfolios/${selectedPortfolio?.id}/assets`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio assets");
      return response.json();
    },
  });

  const handleCreatePortfolio = (data: PortfolioFormData) => {
    createPortfolioMutation.mutate(data);
  };

  const handleUpdatePortfolio = (data: PortfolioFormData) => {
    if (!selectedPortfolio) return;
    updatePortfolioMutation.mutate({
      id: selectedPortfolio.id,
      data,
    });
  };

  const handleEditPortfolio = (portfolio: Portfolio) => {
    if (onEditPortfolio) {
      onEditPortfolio(portfolio.id);
    } else {
      setSelectedPortfolio(portfolio);
      form.setValue("name", portfolio.name);
      form.setValue("description", portfolio.description || "");
      setShowEditDialog(true);
    }
  };

  const handleViewPortfolio = (portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
    setShowViewDialog(true);
  };

  const handleDeletePortfolio = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta carteira?")) {
      deletePortfolioMutation.mutate(id);
    }
  };

  // Component for portfolio row with its own metrics calculation
  const PortfolioRow = ({ portfolio }: { portfolio: Portfolio }) => {
    const { data: portfolioAssets } = useQuery({
      queryKey: [`/api/portfolios/${portfolio.id}/assets`],
      enabled: !!portfolio.id,
    });

    const metrics = portfolioAssets && Array.isArray(portfolioAssets) && portfolioAssets.length > 0 
      ? calculatePortfolioMetrics(
          portfolioAssets.map((pa: any) => ({
            asset: pa.asset,
            quantity: parseFloat(pa.quantity),
            value: parseFloat(pa.value),
          }))
        )
      : { totalValue: 0, weightedRate: 0 };

    return (
      <TableRow key={portfolio.id}>
        <TableCell>
          <div>
            <div className="font-medium">{portfolio.name}</div>
          </div>
        </TableCell>
        <TableCell className="max-w-xs">
          <div className="text-sm text-muted-foreground truncate">
            {portfolio.description || "-"}
          </div>
        </TableCell>
        <TableCell>
          <div className="font-medium">
            {formatCurrency(metrics.totalValue)}
          </div>
        </TableCell>
        <TableCell>
          <div className="font-medium">
            {metrics.weightedRate.toFixed(2)}%
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(portfolio.createdAt), { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </div>
        </TableCell>
        <TableCell>
          <Badge className={portfolio.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {portfolio.isActive ? "Ativa" : "Inativa"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewPortfolio(portfolio)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditPortfolio(portfolio)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeletePortfolio(portfolio.id)}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">Carteiras</h2>
            <p className="mt-1 text-sm text-neutral-600">Gerencie suas carteiras de investimentos</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Carteira
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Carteira</DialogTitle>
                <DialogDescription>
                  Preencha as informações para criar uma nova carteira de investimentos.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreatePortfolio)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Carteira</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Carteira Conservadora" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descrição da estratégia da carteira..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createPortfolioMutation.isPending}
                    >
                      {createPortfolioMutation.isPending ? "Criando..." : "Criar Carteira"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-neutral-600">Total de Carteiras</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {portfoliosArray.length || 0}
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
                    <DollarSign className="h-4 w-4 text-secondary" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-neutral-600">Valor Total</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {formatCurrency(
                      portfoliosArray.reduce((acc: number, p: Portfolio) => 
                        acc + parseFloat(p.totalValue || "0"), 0
                      ) || 0
                    )}
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
                    {(portfoliosArray.reduce((acc: number, p: Portfolio) => 
                      acc + parseFloat(p.weightedRate || "0"), 0
                    ) / Math.max(portfoliosArray.length || 1, 1) || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolios Table */}
        <Card>
          <CardHeader>
            <CardTitle>Suas Carteiras</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando carteiras...</p>
              </div>
            ) : portfoliosArray && portfoliosArray.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Taxa Ponderada</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfoliosArray.map((portfolio: Portfolio) => (
                      <PortfolioRow key={portfolio.id} portfolio={portfolio} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">Nenhuma carteira criada ainda</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Carteira
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Portfolio Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Carteira</DialogTitle>
            <DialogDescription>
              Atualize as informações da carteira.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdatePortfolio)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Carteira</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updatePortfolioMutation.isPending}
                >
                  {updatePortfolioMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Portfolio Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedPortfolio?.name}</DialogTitle>
            <DialogDescription>
              {selectedPortfolio?.description || "Visualização detalhada da carteira"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPortfolio && (
            <div className="space-y-4">
              {/* Portfolio Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {portfolioAssetsData?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Ativos</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-secondary">
                      {formatCurrency(parseFloat(selectedPortfolio.totalValue || "0"))}
                    </div>
                    <div className="text-sm text-muted-foreground">Valor Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {parseFloat(selectedPortfolio.weightedRate || "0").toFixed(2)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Taxa Ponderada</div>
                  </CardContent>
                </Card>
              </div>

              {/* Portfolio Assets */}
              {portfolioAssetsData && portfolioAssetsData.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium mb-2">Ativos da Carteira</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolioAssetsData.map((pa: any) => (
                        <TableRow key={pa.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{pa.asset.name}</div>
                              <div className="text-sm text-muted-foreground">{pa.asset.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge>{pa.asset.type}</Badge>
                          </TableCell>
                          <TableCell>{parseFloat(pa.quantity).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(pa.value))}</TableCell>
                          <TableCell>{pa.asset.rate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
