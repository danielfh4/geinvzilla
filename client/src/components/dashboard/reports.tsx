import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Trash2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Reports() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("pdf");

  const { data: portfolios } = useQuery({
    queryKey: ["/api/portfolios"],
  });

  // Mock data for generated reports
  const generatedReports = [
    {
      id: 1,
      name: "Relatório Mensal - Dezembro",
      description: "Análise completa com gráficos",
      portfolio: "Carteira Conservadora",
      format: "PDF",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: "completed",
      size: "2.4 MB",
    },
    {
      id: 2,
      name: "Análise Trimestral Q4",
      description: "Relatório executivo",
      portfolio: "Carteira Moderada",
      format: "Excel",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: "completed",
      size: "1.8 MB",
    },
    {
      id: 3,
      name: "Performance Anual 2023",
      description: "Análise completa do ano",
      portfolio: "Carteira Agressiva",
      format: "PDF",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      status: "processing",
      size: "-",
    },
  ];

  const handleGenerateReport = () => {
    if (!selectedPortfolio) {
      toast({
        title: "Erro",
        description: "Selecione uma carteira para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Relatório em processamento",
      description: "Seu relatório está sendo gerado. Você será notificado quando estiver pronto.",
    });

    // Here you would implement the actual report generation logic
    // For now, we'll just show a success message after a delay
    setTimeout(() => {
      toast({
        title: "Relatório gerado com sucesso",
        description: "Seu relatório está disponível para download.",
      });
    }, 3000);
  };

  const handleDownloadReport = (reportId: number) => {
    toast({
      title: "Iniciando download",
      description: "O download do relatório foi iniciado.",
    });
    // Here you would implement the actual download logic
  };

  const handleViewReport = (reportId: number) => {
    toast({
      title: "Abrindo visualização",
      description: "O relatório será aberto em uma nova aba.",
    });
    // Here you would implement the report preview logic
  };

  const handleDeleteReport = (reportId: number) => {
    toast({
      title: "Relatório excluído",
      description: "O relatório foi excluído com sucesso.",
    });
    // Here you would implement the delete logic
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
      case "processing":
        return <Badge className="bg-yellow-100 text-yellow-800">Processando</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFormatBadge = (format: string) => {
    if (format.toLowerCase() === "pdf") {
      return <Badge className="bg-red-100 text-red-800">PDF</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Excel</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Relatórios</h2>
        <p className="mt-1 text-sm text-neutral-600">Gere e exporte relatórios completos de carteiras</p>
      </div>

      {/* Report Generation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gerar Novo Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="portfolio">Selecionar Carteira</Label>
              <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma carteira" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios?.map((portfolio: any) => (
                    <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="format">Formato de Exportação</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Completo</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf-summary">PDF Resumido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex space-x-3">
            <Button onClick={handleGenerateReport}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              Visualizar Prévia
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Reports History */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Gerados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relatório</TableHead>
                  <TableHead>Carteira</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Data de Geração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">{report.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>{report.portfolio}</TableCell>
                    <TableCell>{getFormatBadge(report.format)}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(report.createdAt, { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.size}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {report.status === "completed" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReport(report.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReport(report.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
