import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertAssetSchema, insertPortfolioSchema, insertPortfolioAssetSchema } from "./schema";
import bcrypt from "bcrypt";
import multer from "multer";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";

interface AuthenticatedRequest extends Request {
  session: any;
  user?: any;
}

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.session?.userId) return next();
    return res.status(401).json({ error: "Not authenticated" });
  };

  const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
    req.user = user;
    next();
  };

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.userId = user.id;
    const token = Buffer.from(`${user.id}:${user.username}`).toString('base64');
    res.cookie("auth_token", token, { httpOnly: false });
    res.json({ user: { ...user, password: undefined }, token });
  });

  app.get("/api/auth/me", async (req: AuthenticatedRequest, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { ...user, password: undefined } });
  });

  app.post("/api/auth/logout", (req: AuthenticatedRequest, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get("/api/assets", requireAuth, async (req, res) => {
    const assets = await storage.getAllAssets();
    res.json(assets);
  });

  app.post("/api/assets", requireAdmin, async (req, res) => {
    const assetData = insertAssetSchema.parse(req.body);
    const asset = await storage.createAsset(assetData);
    res.status(201).json(asset);
  });

  app.put("/api/assets/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateAsset(id, req.body);
    if (!updated) return res.status(404).json({ error: "Asset not found" });
    res.json(updated);
  });

  app.delete("/api/assets/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteAsset(id);
    if (!deleted) return res.status(404).json({ error: "Asset not found" });
    res.json({ message: "Asset deleted" });
  });

  app.get("/api/portfolios", requireAuth, async (req: AuthenticatedRequest, res) => {
    const portfolios = await storage.getUserPortfolios(req.session.userId);
    res.json(portfolios);
  });

  app.post("/api/portfolios", requireAuth, async (req: AuthenticatedRequest, res) => {
    const portfolioData = insertPortfolioSchema.parse({ ...req.body, userId: req.session.userId });
    const portfolio = await storage.createPortfolio(portfolioData);
    res.status(201).json(portfolio);
  });

  app.get("/api/portfolios/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const portfolio = await storage.getPortfolioById(id);
    if (!portfolio || portfolio.userId !== req.session.userId) return res.status(403).json({ error: "Access denied" });
    res.json(portfolio);
  });

  app.post("/api/portfolios/:id/assets", requireAuth, async (req: AuthenticatedRequest, res) => {
    const portfolioId = Number(req.params.id);
    const portfolio = await storage.getPortfolioById(portfolioId);
    if (!portfolio || portfolio.userId !== req.session.userId) return res.status(403).json({ error: "Access denied" });
    const portfolioAssetData = insertPortfolioAssetSchema.parse({ ...req.body, portfolioId });
    const result = await storage.addAssetToPortfolio(portfolioAssetData);
    res.status(201).json(result);
  });

  app.delete("/api/portfolios/:portfolioId/assets/:assetId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const portfolioId = Number(req.params.portfolioId);
    const assetId = Number(req.params.assetId);
    const portfolio = await storage.getPortfolioById(portfolioId);
    if (!portfolio || portfolio.userId !== req.session.userId) return res.status(403).json({ error: "Access denied" });
    const removed = await storage.removeAssetFromPortfolio(portfolioId, assetId);
    if (!removed) return res.status(404).json({ error: "Asset not found" });
    res.json({ message: "Asset removed" });
  });

  app.post("/api/uploads/excel", requireAdmin, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const filename = req.file.originalname;
    const workbook = XLSX.readFile(req.file.path);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const inserted = await storage.bulkCreateAssets(data);
    fs.unlinkSync(req.file.path);
    res.status(201).json({ inserted });
  });

  const server = createServer(app);
  return server;
}