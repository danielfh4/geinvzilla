import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // CRI, CRA, DEB, LCA, CDB, FUND
  issuer: text("issuer").notNull(),
  sector: text("sector"),
  rate: text("rate").notNull(),
  indexer: text("indexer").notNull(), // CDI, IPCA, SELIC, PREFIXADO
  maturityDate: text("maturity_date"),
  minValue: decimal("min_value", { precision: 15, scale: 2 }).notNull(),
  frequency: text("frequency"), // monthly, quarterly, semiannual, annual
  remPercentage: decimal("rem_percentage", { precision: 5, scale: 4 }), // commission percentage
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  assetId: integer("asset_id").references(() => assets.id).notNull(),
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
  type: text("type").notNull(), // 'excel' or 'pdf'
  status: text("status").notNull().default("processing"), // processing, completed, failed
  recordsImported: integer("records_imported").default(0),
  errorMessage: text("error_message"),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioAssetSchema = createInsertSchema(portfolioAssets).omit({
  id: true,
  createdAt: true,
});

export const insertEconomicParameterSchema = createInsertSchema(economicParameters).omit({
  id: true,
  updatedAt: true,
});

export const insertUploadSchema = createInsertSchema(uploads).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type InsertPortfolioAsset = z.infer<typeof insertPortfolioAssetSchema>;
export type EconomicParameter = typeof economicParameters.$inferSelect;
export type InsertEconomicParameter = z.infer<typeof insertEconomicParameterSchema>;
export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = z.infer<typeof insertUploadSchema>;
