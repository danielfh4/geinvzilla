import { eq, and, desc, sql } from "drizzle-orm";
import { db, pool } from "./db";
import bcrypt from "bcrypt";
import {
  users,
  assets,
  portfolios,
  portfolioAssets,
  economicParameters,
  uploads,
  type User,
  type InsertUser,
  type Asset,
  type InsertAsset,
  type Portfolio,
  type InsertPortfolio,
  type PortfolioAsset,
  type InsertPortfolioAsset,
  type EconomicParameter,
  type InsertEconomicParameter,
  type Upload,
  type InsertUpload,
} from "@shared/schema";



export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Asset operations
  getAllAssets(): Promise<Asset[]>;
  getAssetById(id: number): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<boolean>;
  searchAssets(filters: {
    type?: string;
    indexer?: string;
    minRate?: number;
    maxRate?: number;
    minValue?: number;
    maxValue?: number;
    issuer?: string;
    couponMonth?: string;
    couponMonths?: number[];
  }): Promise<Asset[]>;
  
  // Portfolio operations
  getUserPortfolios(userId: number): Promise<Portfolio[]>;
  getPortfolioById(id: number): Promise<Portfolio | undefined>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: number, portfolio: Partial<InsertPortfolio>): Promise<Portfolio | undefined>;
  deletePortfolio(id: number): Promise<boolean>;
  
  // Portfolio asset operations
  getPortfolioAssets(portfolioId: number): Promise<(PortfolioAsset & { asset: Asset })[]>;
  addAssetToPortfolio(portfolioAsset: InsertPortfolioAsset): Promise<PortfolioAsset>;
  updatePortfolioAsset(id: number, portfolioAsset: Partial<InsertPortfolioAsset>): Promise<PortfolioAsset | undefined>;
  removeAssetFromPortfolio(portfolioId: number, assetId: number): Promise<boolean>;
  
  // Economic parameters
  getAllEconomicParameters(): Promise<EconomicParameter[]>;
  getEconomicParameter(name: string): Promise<EconomicParameter | undefined>;
  updateEconomicParameter(name: string, value: number): Promise<EconomicParameter>;
  
  // Upload operations
  createUpload(upload: InsertUpload): Promise<Upload>;
  getUploads(userId?: number): Promise<Upload[]>;
  updateUploadStatus(id: number, status: string, recordsImported?: number, errorMessage?: string): Promise<Upload | undefined>;
  
  // Bulk operations
  bulkCreateAssets(assets: InsertAsset[]): Promise<Asset[]>;
  bulkCreateEconomicParameters(parameters: InsertEconomicParameter[]): Promise<EconomicParameter[]>;
  
  // Database cleanup
  clearAllAssets(): Promise<void>;
  clearAllData(): Promise<void>;
  
  // Asset history
  getAssetHistory(code: string): Promise<Asset[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(users).values({ ...user, password: hashedPassword }).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...user, updatedAt: new Date() };
    if (user.password) {
      updateData.password = await bcrypt.hash(user.password, 10);
    }
    
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getAllAssets(): Promise<Asset[]> {
    // Get unique assets with their latest historical data
    const assetsWithHistory = await db.execute(sql`
      SELECT 
        au.id, au.name, au.code, au.type, au.issuer, au.sector, au.indexer,
        au.maturity_date as "maturityDate", au.frequency, au.rating, 
        au.coupon_months as "couponMonths", au.is_active as "isActive", 
        au.created_at as "createdAt", au.updated_at as "updatedAt",
        ah.rate, ah.unit_price as "unitPrice", ah.min_value as "minValue", 
        ah.rem_percentage as "remPercentage", ah.imported_at as "importedAt"
      FROM assets_unique au
      LEFT JOIN LATERAL (
        SELECT rate, unit_price, min_value, rem_percentage, imported_at
        FROM asset_histories 
        WHERE asset_code = au.code 
        ORDER BY imported_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ah ON true
      WHERE au.is_active = true
      ORDER BY au.created_at DESC
    `);
    
    return assetsWithHistory.rows as Asset[];
  }

  async getAssetById(id: number): Promise<Asset | undefined> {
    const result = await db.select().from(assets).where(eq(assets.id, id));
    return result[0];
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await db.insert(assets).values(asset).returning();
    return result[0];
  }

  async updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined> {
    const result = await db.update(assets)
      .set({ ...asset, updatedAt: new Date() })
      .where(eq(assets.id, id))
      .returning();
    return result[0];
  }

  async deleteAsset(id: number): Promise<boolean> {
    const result = await db.update(assets)
      .set({ isActive: false })
      .where(eq(assets.id, id));
    return result.rowCount > 0;
  }

  async searchAssets(filters: {
    type?: string;
    indexer?: string;
    minRate?: number;
    issuer?: string;
    asset?: string;
    couponMonth?: string;
    couponMonths?: number[];
  }): Promise<Asset[]> {
    // Build WHERE conditions for the new structure
    const whereConditions: string[] = ['au.is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.type) {
      whereConditions.push(`au.type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }
    
    if (filters.indexer) {
      whereConditions.push(`au.indexer = $${paramIndex}`);
      params.push(filters.indexer);
      paramIndex++;
    }
    
    if (filters.minRate) {
      whereConditions.push(`CAST(REPLACE(ah.rate, '%', '') AS DECIMAL) >= $${paramIndex}`);
      params.push(filters.minRate);
      paramIndex++;
    }
    
    if (filters.asset) {
      whereConditions.push(`(au.code ILIKE $${paramIndex} OR au.name ILIKE $${paramIndex + 1})`);
      params.push(`%${filters.asset}%`);
      params.push(`%${filters.asset}%`);
      paramIndex += 2;
    }
    
    if (filters.issuer) {
      whereConditions.push(`au.issuer ILIKE $${paramIndex}`);
      params.push(`%${filters.issuer}%`);
      paramIndex++;
    }
    
    if (filters.couponMonth) {
      whereConditions.push(`au.coupon_months ILIKE $${paramIndex}`);
      params.push(`%${filters.couponMonth}%`);
      paramIndex++;
    }
    
    if (filters.couponMonths && filters.couponMonths.length > 0) {
      const monthConditions = filters.couponMonths.map(() => {
        const condition = `au.coupon_months ILIKE $${paramIndex}`;
        paramIndex++;
        return condition;
      });
      whereConditions.push(`(${monthConditions.join(' OR ')})`);
      filters.couponMonths.forEach(month => {
        params.push(`%${month.toString().padStart(2, '0')}%`);
      });
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Query with JOIN between unique assets and latest historical data
    const result = await pool.query(`
      SELECT 
        au.id, au.name, au.code, au.type, au.issuer, au.sector, au.indexer,
        au.maturity_date as "maturityDate", au.frequency, au.rating, 
        au.coupon_months as "couponMonths", au.is_active as "isActive", 
        au.created_at as "createdAt", au.updated_at as "updatedAt",
        ah.rate, ah.unit_price as "unitPrice", ah.min_value as "minValue", 
        ah.rem_percentage as "remPercentage", ah.imported_at as "importedAt"
      FROM assets_unique au
      LEFT JOIN LATERAL (
        SELECT rate, unit_price, min_value, rem_percentage, imported_at
        FROM asset_histories 
        WHERE asset_code = au.code 
        ORDER BY imported_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ah ON true
      WHERE ${whereClause}
      ORDER BY au.created_at DESC
    `, params);
    
    return result.rows as Asset[];
  }

  async getUserPortfolios(userId: number): Promise<Portfolio[]> {
    return await db.select().from(portfolios)
      .where(and(eq(portfolios.userId, userId), eq(portfolios.isActive, true)))
      .orderBy(desc(portfolios.updatedAt));
  }

  async getPortfolioById(id: number): Promise<Portfolio | undefined> {
    const result = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return result[0];
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const result = await db.insert(portfolios).values(portfolio).returning();
    return result[0];
  }

  async updatePortfolio(id: number, portfolio: Partial<InsertPortfolio>): Promise<Portfolio | undefined> {
    const result = await db.update(portfolios)
      .set({ ...portfolio, updatedAt: new Date() })
      .where(eq(portfolios.id, id))
      .returning();
    return result[0];
  }

  async deletePortfolio(id: number): Promise<boolean> {
    const result = await db.update(portfolios)
      .set({ isActive: false })
      .where(eq(portfolios.id, id));
    return result.rowCount > 0;
  }

  async getPortfolioAssets(portfolioId: number): Promise<(PortfolioAsset & { asset: Asset })[]> {
    const result = await db.select({
      id: portfolioAssets.id,
      portfolioId: portfolioAssets.portfolioId,
      assetId: portfolioAssets.assetId,
      quantity: portfolioAssets.quantity,
      value: portfolioAssets.value,
      createdAt: portfolioAssets.createdAt,
      asset: assets,
    }).from(portfolioAssets)
      .innerJoin(assets, eq(portfolioAssets.assetId, assets.id))
      .where(eq(portfolioAssets.portfolioId, portfolioId));
    
    return result;
  }

  async addAssetToPortfolio(portfolioAsset: InsertPortfolioAsset): Promise<PortfolioAsset> {
    const result = await db.insert(portfolioAssets).values(portfolioAsset).returning();
    return result[0];
  }

  async updatePortfolioAsset(id: number, portfolioAsset: Partial<InsertPortfolioAsset>): Promise<PortfolioAsset | undefined> {
    const result = await db.update(portfolioAssets)
      .set(portfolioAsset)
      .where(eq(portfolioAssets.id, id))
      .returning();
    return result[0];
  }

  async removeAssetFromPortfolio(portfolioId: number, assetId: number): Promise<boolean> {
    const result = await db.delete(portfolioAssets)
      .where(and(eq(portfolioAssets.portfolioId, portfolioId), eq(portfolioAssets.assetId, assetId)));
    return result.rowCount > 0;
  }

  async getAllEconomicParameters(): Promise<EconomicParameter[]> {
    return await db.select().from(economicParameters).orderBy(economicParameters.name);
  }

  async getEconomicParameter(name: string): Promise<EconomicParameter | undefined> {
    const result = await db.select().from(economicParameters).where(eq(economicParameters.name, name));
    return result[0];
  }

  async updateEconomicParameter(name: string, value: number): Promise<EconomicParameter> {
    const result = await (db.insert(economicParameters) as any)
      .values({ name, value: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: economicParameters.name,
        set: { value: String(value), updatedAt: new Date() }
      })
      .returning();
    return result[0];
  }

  async createUpload(upload: InsertUpload): Promise<Upload> {
    const result = await db.insert(uploads).values(upload).returning();
    return result[0];
  }

  async getUploads(userId?: number): Promise<Upload[]> {
    if (userId) {
      return await db.select().from(uploads).where(eq(uploads.uploadedBy, userId)).orderBy(desc(uploads.createdAt));
    }
    
    return await db.select().from(uploads).orderBy(desc(uploads.createdAt));
  }

  async updateUploadStatus(id: number, status: string, recordsImported?: number, errorMessage?: string): Promise<Upload | undefined> {
    const result = await db.update(uploads)
      .set({
        status,
        recordsImported,
        errorMessage,
      })
      .where(eq(uploads.id, id))
      .returning();
    return result[0];
  }

  async bulkCreateAssets(assetsList: InsertAsset[]): Promise<Asset[]> {
    if (assetsList.length === 0) return [];
    
    const createdAssets: Asset[] = [];
    
    for (const asset of assetsList) {
      try {
        // Extract historical data from asset
        const { rate, unitPrice, minValue, remPercentage, importedAt, ...baseAsset } = asset as any;
        
        // Check if unique asset exists using raw SQL
        const existingUnique = await pool.query(
          'SELECT id FROM assets_unique WHERE code = $1',
          [baseAsset.code]
        );
        
        let assetId: number;
        
        if (existingUnique.rows.length === 0) {
          // Insert new unique asset
          const uniqueResult = await pool.query(
            `INSERT INTO assets_unique (name, code, type, issuer, sector, indexer, maturity_date, frequency, rating, coupon_months, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              baseAsset.name,
              baseAsset.code,
              baseAsset.type,
              baseAsset.issuer,
              baseAsset.sector || null,
              baseAsset.indexer,
              baseAsset.maturityDate || null,
              baseAsset.frequency || null,
              baseAsset.rating || null,
              baseAsset.couponMonths || null,
              baseAsset.isActive ?? true
            ]
          );
          assetId = uniqueResult.rows[0].id;
        } else {
          assetId = existingUnique.rows[0].id;
        }
        
        // Check if this historical version already exists
        const importDate = importedAt || new Date();
        const existingHistory = await pool.query(
          'SELECT id FROM asset_histories WHERE asset_code = $1 AND imported_at = $2',
          [baseAsset.code, importDate]
        );
        
        if (existingHistory.rows.length === 0) {
          // Insert historical data
          await pool.query(
            `INSERT INTO asset_histories (asset_code, rate, unit_price, min_value, rem_percentage, imported_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              baseAsset.code,
              rate || null,
              unitPrice || null,
              minValue || null,
              remPercentage || null,
              importDate
            ]
          );
        }
        
        // Return combined asset data
        const combinedAsset = {
          id: assetId,
          ...baseAsset,
          rate,
          unitPrice,
          minValue,
          remPercentage,
          importedAt: importedAt || new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        createdAssets.push(combinedAsset as Asset);
        console.log(`Asset ${baseAsset.code} processed successfully`);
        
      } catch (error: any) {
        console.error(`Error processing asset ${asset.code}:`, error);
      }
    }
    
    return createdAssets;
  }

  async bulkCreateEconomicParameters(parameters: InsertEconomicParameter[]): Promise<EconomicParameter[]> {
    if (parameters.length === 0) return [];
    
    const result = await db.insert(economicParameters)
      .values(parameters)
      .onConflictDoUpdate({
        target: economicParameters.name,
        set: {
          value: sql`excluded.value`,
          updatedAt: new Date(),
        }
      })
      .returning();
    return result;
  }

  async clearAllAssets(): Promise<void> {
    // Delete only asset-related data
    await db.delete(portfolioAssets);
    await db.delete(assets);
  }

  async clearAllData(): Promise<void> {
    // Delete in order to respect foreign key constraints
    await db.delete(portfolioAssets);
    await db.delete(portfolios);
    await db.delete(assets);
    await db.delete(uploads);
    await db.delete(economicParameters);
  }

  async getAssetHistory(code: string): Promise<Asset[]> {
    // Get asset history from the new structure
    const result = await pool.query(`
      SELECT 
        au.id, au.name, au.code, au.type, au.issuer, au.sector, au.indexer,
        au.maturity_date as "maturityDate", au.frequency, au.rating, 
        au.coupon_months as "couponMonths", au.is_active as "isActive", 
        au.created_at as "createdAt", au.updated_at as "updatedAt",
        ah.rate, ah.unit_price as "unitPrice", ah.min_value as "minValue", 
        ah.rem_percentage as "remPercentage", ah.imported_at as "importedAt"
      FROM assets_unique au
      INNER JOIN asset_histories ah ON ah.asset_code = au.code
      WHERE au.code = $1 AND au.is_active = true
      ORDER BY ah.imported_at DESC NULLS LAST, ah.created_at DESC
    `, [code]);
    
    return result.rows as Asset[];
  }
}

export const storage = new DatabaseStorage();
export { db };
