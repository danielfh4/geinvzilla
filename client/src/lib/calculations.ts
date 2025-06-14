import type { Asset } from "@shared/schema";

interface SelectedAsset {
  asset: Asset;
  quantity: number;
  value: number;
}

export interface PortfolioMetrics {
  totalAssets: number;
  totalValue: number;
  weightedRate: number;
  weightedRateByIndexer: Record<string, number>;
  concentrationByIssuer: Record<string, number>;
  concentrationBySector: Record<string, number>;
  concentrationByIndexer: Record<string, number>;
  monthlyCoupons: number[];
  totalCommission: number;
}

export function calculatePortfolioMetrics(selectedAssets: SelectedAsset[], economicParams?: any): PortfolioMetrics {
  if (!selectedAssets || selectedAssets.length === 0) {
    return {
      totalAssets: 0,
      totalValue: 0,
      weightedRate: 0,
      weightedRateByIndexer: {},
      concentrationByIssuer: {},
      concentrationBySector: {},
      concentrationByIndexer: {},
      monthlyCoupons: new Array(12).fill(0),
      totalCommission: 0,
    };
  }

  const totalValue = selectedAssets.reduce((sum, sa) => sum + sa.value, 0);
  const totalAssets = selectedAssets.length;

  // Calculate weighted average rate
  let weightedRate = 0;
  let totalCommission = 0;

  if (totalValue > 0) {
    selectedAssets.forEach(sa => {
      const weight = sa.value / totalValue;
      const rate = extractNumericRate(sa.asset.rate);
      weightedRate += rate * weight;

      // Calculate commission if REM percentage is available
      if (sa.asset.remPercentage) {
        const remPercent = parseFloat(sa.asset.remPercentage);
        totalCommission += sa.value * (remPercent / 100);
      }
    });
  }

  // Calculate weighted rates by indexer
  const weightedRateByIndexer: Record<string, number> = {};
  const valueByIndexer: Record<string, number> = {};

  selectedAssets.forEach(sa => {
    const indexer = sa.asset.indexer;
    const rate = extractNumericRate(sa.asset.rate);
    
    if (!weightedRateByIndexer[indexer]) {
      weightedRateByIndexer[indexer] = 0;
      valueByIndexer[indexer] = 0;
    }
    
    weightedRateByIndexer[indexer] += rate * sa.value;
    valueByIndexer[indexer] += sa.value;
  });

  // Normalize weighted rates by indexer
  Object.keys(weightedRateByIndexer).forEach(indexer => {
    if (valueByIndexer[indexer] > 0) {
      weightedRateByIndexer[indexer] = weightedRateByIndexer[indexer] / valueByIndexer[indexer];
    }
  });

  // Calculate concentrations
  const concentrationByIssuer: Record<string, number> = {};
  const concentrationBySector: Record<string, number> = {};
  const concentrationByIndexer: Record<string, number> = {};

  selectedAssets.forEach(sa => {
    const weight = totalValue > 0 ? (sa.value / totalValue) * 100 : 0;

    // By issuer
    if (concentrationByIssuer[sa.asset.issuer]) {
      concentrationByIssuer[sa.asset.issuer] += weight;
    } else {
      concentrationByIssuer[sa.asset.issuer] = weight;
    }

    // By sector
    const sector = sa.asset.sector || "Não especificado";
    if (concentrationBySector[sector]) {
      concentrationBySector[sector] += weight;
    } else {
      concentrationBySector[sector] = weight;
    }

    // By indexer
    if (concentrationByIndexer[sa.asset.indexer]) {
      concentrationByIndexer[sa.asset.indexer] += weight;
    } else {
      concentrationByIndexer[sa.asset.indexer] = weight;
    }
  });

  // Get CDI rate from economic parameters or use default
  const cdiRate = economicParams?.find((p: any) => p.name === 'CDI')?.value || 14.65;
  
  // Calculate monthly coupons projection
  const monthlyCoupons = calculateMonthlyCoupons(selectedAssets, cdiRate);

  return {
    totalAssets,
    totalValue,
    weightedRate,
    weightedRateByIndexer,
    concentrationByIssuer,
    concentrationBySector,
    concentrationByIndexer,
    monthlyCoupons,
    totalCommission,
  };
}

function extractNumericRate(rateString: string): number {
  // Extract numeric rate from strings like "CDI + 1.25%", "108% CDI", "IPCA + 6.25%", "12.5%"
  if (!rateString) return 0;

  const cleanRate = rateString.replace(/[^\d.,+\-%]/g, "");
  
  // Handle percentage rates
  const percentMatch = cleanRate.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percentMatch) {
    return parseFloat(percentMatch[1].replace(",", "."));
  }

  // Handle CDI rates like "108% CDI" or "CDI + 1.25%"
  const cdiMatch = cleanRate.match(/(\d+(?:[.,]\d+)?)/);
  if (cdiMatch && rateString.toUpperCase().includes("CDI")) {
    const rate = parseFloat(cdiMatch[1].replace(",", "."));
    if (rate > 10) {
      // Assume it's a percentage of CDI (like 108% CDI = 10.8% assuming CDI is 10%)
      return rate / 10; // Simplified assumption
    }
    return rate + 10; // Simplified assumption: CDI base rate is 10%
  }

  // Handle IPCA rates like "IPCA + 6.25%"
  if (rateString.toUpperCase().includes("IPCA")) {
    const ipcaMatch = cleanRate.match(/\+\s*(\d+(?:[.,]\d+)?)/);
    if (ipcaMatch) {
      return parseFloat(ipcaMatch[1].replace(",", ".")) + 4; // Simplified assumption: IPCA is 4%
    }
  }

  // Default extraction
  const numberMatch = cleanRate.match(/(\d+(?:[.,]\d+)?)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1].replace(",", "."));
  }

  return 0;
}

function calculateMonthlyCoupons(selectedAssets: SelectedAsset[], cdiRate = 14.65): number[] {
  const monthlyCoupons = new Array(12).fill(0);
  
  selectedAssets.forEach(({ asset, quantity, value }) => {
    if (!asset.couponMonths || !asset.frequency || !asset.unitPrice) return;
    
    const couponMonths = asset.couponMonths.split(',').map(m => parseInt(m.trim()) - 1);
    const unitPrice = parseFloat(asset.unitPrice.toString());
    let annualCoupon = 0;
    
    // Calculate annual coupon based on indexer type
    switch (asset.indexer.toUpperCase()) {
      case 'IPCA':
        // IPCA: Only use asset rate * unit price
        annualCoupon = (extractNumericRate(asset.rate) / 100) * unitPrice * quantity;
        break;
      case 'PREFIXADO':
        // PREFIXADO: Asset rate * unit price
        annualCoupon = (extractNumericRate(asset.rate) / 100) * unitPrice * quantity;
        break;
      case '%CDI':
        // %CDI: Asset rate% * CDI rate * unit price
        annualCoupon = (extractNumericRate(asset.rate) / 100) * (cdiRate / 100) * unitPrice * quantity;
        break;
      case 'CDI+':
        // CDI+: (CDI + asset rate) * unit price
        annualCoupon = ((cdiRate / 100) + (extractNumericRate(asset.rate) / 100)) * unitPrice * quantity;
        break;
      default:
        // Default case - use asset rate
        annualCoupon = (extractNumericRate(asset.rate) / 100) * unitPrice * quantity;
    }
    
    let couponValue = 0;
    
    // Calculate coupon value based on frequency
    switch (asset.frequency.toLowerCase()) {
      case 'monthly':
        couponValue = annualCoupon / 12;
        // Monthly coupons occur every month
        for (let i = 0; i < 12; i++) {
          monthlyCoupons[i] += couponValue;
        }
        break;
      case 'quarterly':
        couponValue = annualCoupon / 4;
        // Quarterly coupons occur in specified months
        couponMonths.forEach(month => {
          if (month >= 0 && month < 12) {
            monthlyCoupons[month] += couponValue;
          }
        });
        break;
      case 'semiannual':
        couponValue = annualCoupon / 2;
        // Semiannual coupons occur in specified months
        couponMonths.forEach(month => {
          if (month >= 0 && month < 12) {
            monthlyCoupons[month] += couponValue;
          }
        });
        break;
      case 'annual':
        couponValue = annualCoupon;
        // Annual coupons occur in specified months
        couponMonths.forEach(month => {
          if (month >= 0 && month < 12) {
            monthlyCoupons[month] += couponValue;
          }
        });
        break;
    }
  });
  
  return monthlyCoupons;
}

export function formatConcentrationData(concentration: Record<string, number>) {
  return Object.entries(concentration)
    .map(([name, percentage]) => ({
      name,
      percentage: Math.round(percentage * 100) / 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

export function getTopConcentrations(concentration: Record<string, number>, limit = 5) {
  return formatConcentrationData(concentration).slice(0, limit);
}

export function calculateDiversificationScore(metrics: PortfolioMetrics): number {
  // Simple diversification score based on concentration
  const issuerCount = Object.keys(metrics.concentrationByIssuer).length;
  const sectorCount = Object.keys(metrics.concentrationBySector).length;
  const indexerCount = Object.keys(metrics.concentrationByIndexer).length;

  // Check for over-concentration (any single position > 20%)
  const maxIssuerConcentration = Math.max(...Object.values(metrics.concentrationByIssuer));
  const maxSectorConcentration = Math.max(...Object.values(metrics.concentrationBySector));

  let score = 100;

  // Penalty for low diversification
  if (issuerCount < 5) score -= (5 - issuerCount) * 10;
  if (sectorCount < 3) score -= (3 - sectorCount) * 15;
  if (indexerCount < 2) score -= (2 - indexerCount) * 10;

  // Penalty for over-concentration
  if (maxIssuerConcentration > 20) score -= (maxIssuerConcentration - 20) * 2;
  if (maxSectorConcentration > 40) score -= (maxSectorConcentration - 40) * 1.5;

  return Math.max(0, Math.min(100, score));
}

export function generatePortfolioSummary(metrics: PortfolioMetrics) {
  const diversificationScore = calculateDiversificationScore(metrics);
  const topIssuers = getTopConcentrations(metrics.concentrationByIssuer, 3);
  const topSectors = getTopConcentrations(metrics.concentrationBySector, 3);

  return {
    totalAssets: metrics.totalAssets,
    totalValue: metrics.totalValue,
    weightedRate: metrics.weightedRate,
    totalCommission: metrics.totalCommission,
    diversificationScore,
    topIssuers,
    topSectors,
    annualCoupons: metrics.monthlyCoupons.reduce((sum, monthly) => sum + monthly, 0),
  };
}
