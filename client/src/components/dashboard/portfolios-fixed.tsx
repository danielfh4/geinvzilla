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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Briefcase, Plus, Edit, Trash2, Eye, TrendingUp, DollarSign } from "lucide-react";
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

  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Queries
  const { data: portfolios, isLoading } = useQuery({
    queryKey: ["/api/portfolios"],
  });

  const { data: portfolioAssetsData } = useQuery({
    queryKey: [`/api/portfolios/${selectedPortfolio?.id}/assets`],
    enabled: !!selectedPortfolio?.id,
  });

  // Mutations
  const createPortfolioMutation = useMutation({
    mutationFn: async (data: PortfolioFormData) => {
      return await apiRequest(`/api/portfolios`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Carteira criada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar carteira",
        variant: "destructive",
      });
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: async (data: PortfolioFormData) => {
      if (!selectedPortfolio) throw new Error("Nenhuma carteira selecionada");
      return await apiRequest(`/api/portfolios/${selectedPortfolio.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowEditDialog(false);
      setSelectedPortfolio(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Carteira atualizada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar carteira",
        variant: "destructive",
      });
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/portfolios/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      toast({
        title: "Sucesso",
        description: "Carteira excluída com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir carteira",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleCreatePortfolio = (data: PortfolioFormData) => {
    createPortfolioMutation.mutate(data);
  };

  const handleUpdatePortfolio = (data: PortfolioFormData) => {
    updatePortfolioMutation.mutate(data);
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

  const portfoliosArray = Array.isArray(portfolios) ? portfolios : [];

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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-secondary" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-neutral-600">Valor Total</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {formatCurrency(0)}
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
                    0.00%
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
              {/* Portfolio Assets */}
              {portfolioAssetsData && portfolioAssetsData.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Ativos da Carteira</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor Unitário</TableHead>
                        <TableHead>Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolioAssetsData.map((pa: any) => (
                        <TableRow key={pa.id}>
                          <TableCell>{pa.asset.name}</TableCell>
                          <TableCell>{pa.asset.code}</TableCell>
                          <TableCell>{parseFloat(pa.quantity).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(pa.asset.unitPrice))}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(pa.value))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">Esta carteira não possui ativos.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}