import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, sql } from "drizzle-orm";
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const sql_client = neon(process.env.DATABASE_URL);
const db = drizzle(sql_client);

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
    minValue?: number;
    issuer?: string;
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
  clearAllData(): Promise<void>;
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
    return await db.select().from(assets).where(eq(assets.isActive, true)).orderBy(desc(assets.createdAt));
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
    minValue?: number;
    issuer?: string;
  }): Promise<Asset[]> {
    let query = db.select().from(assets).where(eq(assets.isActive, true));
    
    const conditions = [];
    
    if (filters.type) {
      conditions.push(eq(assets.type, filters.type));
    }
    
    if (filters.indexer) {
      conditions.push(eq(assets.indexer, filters.indexer));
    }
    
    if (filters.minValue) {
      conditions.push(sql`${assets.minValue} >= ${filters.minValue}`);
    }
    
    if (filters.issuer) {
      conditions.push(sql`${assets.issuer} ILIKE ${'%' + filters.issuer + '%'}`);
    }
    
    if (conditions.length > 0) {
      return await (db.select().from(assets) as any).where(and(...conditions)).orderBy(desc(assets.createdAt));
    }
    
    return await db.select().from(assets).orderBy(desc(assets.createdAt));
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
    
    // Insert assets one by one to handle duplicates gracefully
    for (const asset of assetsList) {
      try {
        const result = await db.insert(assets).values(asset).returning();
        if (result.length > 0) {
          createdAssets.push(result[0]);
        }
      } catch (error: any) {
        // Skip duplicates (constraint violation)
        if (error.code === '23505') {
          console.log(`Asset with code ${asset.code} already exists, skipping...`);
          continue;
        }
        console.error(`Error inserting asset ${asset.code}:`, error);
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

  async clearAllData(): Promise<void> {
    // Delete in order to respect foreign key constraints
    await db.delete(portfolioAssets);
    await db.delete(portfolios);
    await db.delete(assets);
    await db.delete(uploads);
    await db.delete(economicParameters);
  }
}

export const storage = new DatabaseStorage();
export { db };
