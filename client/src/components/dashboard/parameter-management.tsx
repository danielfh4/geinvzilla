import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, Settings, Calculator, TrendingUp } from "lucide-react";
import type { EconomicParameter } from "@shared/schema";

export function ParameterManagement() {
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: parameters, isLoading } = useQuery<EconomicParameter[]>({
    queryKey: ["/api/parameters"],
  });

  const updateParameterMutation = useMutation({
    mutationFn: async ({ name, value }: { name: string; value: number }) => {
      const response = await fetch(`/api/parameters/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update parameter");
      }
      return response.json();
    },
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parameters"] });
      toast({
        title: "Parâmetro atualizado",
        description: `${name} foi atualizado com sucesso`,
      });
      // Remove from edited values after successful update
      setEditedValues(prev => {
        const newValues = { ...prev };
        delete newValues[name];
        return newValues;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar parâmetro",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (name: string, value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      setEditedValues(prev => ({
        ...prev,
        [name]: numericValue
      }));
    }
  };

  const handleSave = (name: string) => {
    const value = editedValues[name];
    if (value !== undefined) {
      updateParameterMutation.mutate({ name, value });
    }
  };

  const getCurrentValue = (param: EconomicParameter) => {
    return editedValues[param.name] !== undefined 
      ? editedValues[param.name] 
      : parseFloat(param.value.toString());
  };

  const hasChanges = (paramName: string) => {
    return editedValues[paramName] !== undefined;
  };

  // Default parameters to display if not in database
  const defaultParameters = [
    { name: "CDI", description: "Taxa CDI anual (%)", defaultValue: 14.65 },
    { name: "IPCA", description: "IPCA dos últimos 12 meses (%)", defaultValue: 4.5 },
    { name: "SELIC", description: "Taxa SELIC anual (%)", defaultValue: 13.75 },
  ];

  const getParameterValue = (name: string) => {
    const param = parameters?.find(p => p.name === name);
    return param ? parseFloat(param.value.toString()) : 
           defaultParameters.find(d => d.name === name)?.defaultValue || 0;
  };

  const getParameterDescription = (name: string) => {
    const param = parameters?.find(p => p.name === name);
    return param?.description || 
           defaultParameters.find(d => d.name === name)?.description || name;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando parâmetros...</div>
      </div>
    );
  }

  // Combine existing parameters with defaults
  const allParameterNames = new Set([
    ...(parameters?.map(p => p.name) || []),
    ...defaultParameters.map(d => d.name)
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Gestão de Parâmetros</h2>
        <p className="mt-1 text-sm text-neutral-600">Configure os parâmetros econômicos para cálculos precisos</p>
      </div>

      {/* Economic Parameters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Parâmetros Econômicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from(allParameterNames).map((paramName) => {
              const currentValue = getParameterValue(paramName);
              const description = getParameterDescription(paramName);
              const displayValue = editedValues[paramName] !== undefined 
                ? editedValues[paramName] 
                : currentValue;

              return (
                <div key={paramName} className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">{paramName}</Label>
                    <p className="text-xs text-neutral-600 mt-1">{description}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={displayValue}
                      onChange={(e) => handleValueChange(paramName, e.target.value)}
                      className="flex-1"
                      placeholder="0.00"
                    />
                    <span className="text-sm text-neutral-500">%</span>
                  </div>
                  
                  {hasChanges(paramName) && (
                    <Button
                      size="sm"
                      onClick={() => handleSave(paramName)}
                      disabled={updateParameterMutation.isPending}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Calculation Formulas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fórmulas de Cálculo de Cupons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-neutral-50 p-4 rounded-lg">
              <h4 className="font-medium text-neutral-900 mb-2">IPCA</h4>
              <p className="text-sm text-neutral-600">
                <span className="font-mono bg-white px-2 py-1 rounded">
                  Cupom Anual = Taxa do Título (%) × PU × Quantidade
                </span>
              </p>
            </div>

            <div className="bg-neutral-50 p-4 rounded-lg">
              <h4 className="font-medium text-neutral-900 mb-2">PREFIXADO</h4>
              <p className="text-sm text-neutral-600">
                <span className="font-mono bg-white px-2 py-1 rounded">
                  Cupom Anual = Taxa do Título (%) × PU × Quantidade
                </span>
              </p>
            </div>

            <div className="bg-neutral-50 p-4 rounded-lg">
              <h4 className="font-medium text-neutral-900 mb-2">%CDI</h4>
              <p className="text-sm text-neutral-600">
                <span className="font-mono bg-white px-2 py-1 rounded">
                  Cupom Anual = Taxa do Título (%) × CDI (%) × PU × Quantidade
                </span>
              </p>
            </div>

            <div className="bg-neutral-50 p-4 rounded-lg">
              <h4 className="font-medium text-neutral-900 mb-2">CDI+</h4>
              <p className="text-sm text-neutral-600">
                <span className="font-mono bg-white px-2 py-1 rounded">
                  Cupom Anual = (CDI (%) + Taxa do Título (%)) × PU × Quantidade
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Frequência de Pagamento</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li><strong>Mensal:</strong> Cupom Anual ÷ 12</li>
              <li><strong>Trimestral:</strong> Cupom Anual ÷ 4</li>
              <li><strong>Semestral:</strong> Cupom Anual ÷ 2</li>
              <li><strong>Anual:</strong> Cupom Anual (valor total)</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2">
              * Os meses de pagamento são definidos no campo "Cupom" de cada ativo (01=Jan, 02=Fev, etc.)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}