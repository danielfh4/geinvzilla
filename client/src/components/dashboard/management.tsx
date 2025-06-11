import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Upload, Plus, Download, Edit, Trash2, Check, X, Database } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Management() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);

  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ["/api/uploads"],
  });

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["/api/assets"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/uploads/${type}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso. O processamento foi iniciado.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao enviar arquivo. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const clearDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/database/clear", {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to clear database");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Base de dados limpa",
        description: "Todos os dados foram removidos com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao limpar base de dados",
        description: error.message || "Erro ao limpar a base de dados. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (files: FileList | null, type: string) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ file, type });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files, type);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><Check className="mr-1 h-3 w-3" />Concluído</Badge>;
      case "processing":
        return <Badge className="bg-yellow-100 text-yellow-800">Processando</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><X className="mr-1 h-3 w-3" />Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAssetTypeBadge = (type: string) => {
    const colors = {
      CRI: "bg-blue-100 text-blue-800",
      CRA: "bg-green-100 text-green-800",
      DEB: "bg-purple-100 text-purple-800",
      LCA: "bg-orange-100 text-orange-800",
      CDB: "bg-emerald-100 text-emerald-800",
      FUND: "bg-gray-100 text-gray-800",
    };
    return <Badge className={colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"}>{type}</Badge>;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Gestão de Dados</h2>
        <p className="mt-1 text-sm text-neutral-600">Gerencie ativos, parâmetros econômicos e dados do sistema</p>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Excel Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileSpreadsheet className="mr-2 h-5 w-5 text-secondary" />
              Upload de Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? "border-primary bg-primary/5" 
                  : "border-neutral-300 hover:border-primary hover:bg-primary/5"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, "excel")}
            >
              <FileSpreadsheet className="mx-auto h-12 w-12 text-secondary mb-3" />
              <p className="text-sm font-medium text-neutral-900 mb-1">Upload de Planilha Excel</p>
              <p className="text-xs text-neutral-500 mb-3">Arraste arquivos .xlsx ou clique para selecionar</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e.target.files, "excel")}
                className="hidden"
                id="excelUpload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("excelUpload")?.click()}
                disabled={uploadMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadMutation.isPending ? "Enviando..." : "Selecionar Arquivo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PDF Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5 text-accent" />
              Upload de PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? "border-primary bg-primary/5" 
                  : "border-neutral-300 hover:border-primary hover:bg-primary/5"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, "pdf")}
            >
              <FileText className="mx-auto h-12 w-12 text-accent mb-3" />
              <p className="text-sm font-medium text-neutral-900 mb-1">Upload de PDF</p>
              <p className="text-xs text-neutral-500 mb-3">Arraste arquivos .pdf ou clique para selecionar</p>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload(e.target.files, "pdf")}
                className="hidden"
                id="pdfUpload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("pdfUpload")?.click()}
                disabled={uploadMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadMutation.isPending ? "Enviando..." : "Selecionar Arquivo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Uploads */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Uploads Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando uploads...</p>
            </div>
          ) : uploads && uploads.length > 0 ? (
            <div className="space-y-3">
              {uploads.slice(0, 5).map((upload: any) => (
                <div key={upload.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center">
                    {upload.type === "excel" ? (
                      <FileSpreadsheet className="text-secondary mr-3 h-5 w-5" />
                    ) : (
                      <FileText className="text-accent mr-3 h-5 w-5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{upload.originalName}</p>
                      <p className="text-xs text-neutral-500">
                        {formatDistanceToNow(new Date(upload.createdAt), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                        {upload.recordsImported > 0 && ` • ${upload.recordsImported} registros`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(upload.status)}
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum upload realizado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Banco de Dados</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Novo Ativo
              </Button>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Exportar Dados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assetsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando ativos...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Emissor</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets?.slice(0, 10).map((asset: any) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono text-sm">#{asset.id.toString().padStart(3, '0')}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-sm text-muted-foreground">{asset.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getAssetTypeBadge(asset.type)}</TableCell>
                      <TableCell>{asset.issuer}</TableCell>
                      <TableCell>{asset.rate}</TableCell>
                      <TableCell>
                        <Badge className={asset.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {asset.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
