import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z, ZodType } from "zod";
import "../types";


export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  name: text("name").notNull(),
  email: text("email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetsUnique = pgTable("assets_unique", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), 
  type: text("type").notNull(),
  issuer: text("issuer").notNull(),
  sector: text("sector"),
  indexer: text("indexer").notNull(),
  maturityDate: text("maturity_date"),
  frequency: text("frequency"),
  rating: text("rating"),
  couponMonths: text("coupon_months"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(), 
  type: text("type").notNull(),
  issuer: text("issuer").notNull(),
  sector: text("sector"),
  indexer: text("indexer").notNull(),
  maturityDate: text("maturity_date"),
  frequency: text("frequency"),
  rating: text("rating"),
  couponMonths: text("coupon_months"),
  rate: text("rate"),
  unitPrice: text("unit_price"),
  minValue: text("min_value"),
  remPercentage: text("rem_percentage"),
  importedAt: timestamp("imported_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetHistories = pgTable("asset_histories", {
  id: serial("id").primaryKey(),
  assetCode: text("asset_code").notNull(),
  rate: text("rate").notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
  minValue: decimal("min_value", { precision: 15, scale: 2 }).notNull(),
  remPercentage: decimal("rem_percentage", { precision: 5, scale: 4 }),
  importedAt: timestamp("imported_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  description: text("description"),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).default("0").notNull(),
  weightedRate: decimal("weighted_rate", { precision: 5, scale: 4 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portfolioAssets = pgTable("portfolio_assets", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").references(() => portfolios.id).notNull(),
  assetId: integer("asset_id").references(() => assetsUnique.id).notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const economicParameters = pgTable("economic_parameters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: decimal("value", { precision: 10, scale: 6 }).notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("processing"),
  recordsImported: integer("records_imported").default(0),
  errorMessage: text("error_message"),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  fileModifiedAt: timestamp("file_modified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas
const userSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
const assetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
const portfolioSchema = createInsertSchema(portfolios).omit({ id: true, createdAt: true, updatedAt: true });
const portfolioAssetSchema = createInsertSchema(portfolioAssets).omit({ id: true, createdAt: true });
economicParameters;
const economicParameterSchema = createInsertSchema(economicParameters).omit({ id: true, updatedAt: true });
const uploadSchema = createInsertSchema(uploads).omit({ id: true, createdAt: true });

export const insertUserSchema = userSchema;
export const insertAssetSchema = assetSchema;
export const insertPortfolioSchema = portfolioSchema;
export const insertPortfolioAssetSchema = portfolioAssetSchema;
export const insertEconomicParameterSchema = economicParameterSchema;
export const insertUploadSchema = uploadSchema;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof userSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof assetSchema>;
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof portfolioSchema>;
export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type InsertPortfolioAsset = z.infer<typeof portfolioAssetSchema>;
export type EconomicParameter = typeof economicParameters.$inferSelect;
export type InsertEconomicParameter = z.infer<typeof economicParameterSchema>;
export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = z.infer<typeof uploadSchema>;

