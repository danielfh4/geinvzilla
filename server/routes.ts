import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertAssetSchema, insertPortfolioSchema, insertPortfolioAssetSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import multer from "multer";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";

interface AuthenticatedRequest extends Request {
  session: any;
  user?: any;
}

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and PDF files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware for authentication
  app.use((req: any, res: any, next: any) => {
    if (!req.session) {
      req.session = {} as any;
    }
    next();
  });

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    req.user = user;
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Asset routes
  app.get("/api/assets", requireAuth, async (req, res) => {
    try {
      const { type, indexer, minValue, issuer } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type as string;
      if (indexer) filters.indexer = indexer as string;
      if (minValue) filters.minValue = parseFloat(minValue as string);
      if (issuer) filters.issuer = issuer as string;
      
      const assets = Object.keys(filters).length > 0 
        ? await storage.searchAssets(filters)
        : await storage.getAllAssets();
        
      res.json(assets);
    } catch (error) {
      console.error("Get assets error:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.post("/api/assets", requireAdmin, async (req, res) => {
    try {
      const assetData = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(assetData);
      res.status(201).json(asset);
    } catch (error) {
      console.error("Create asset error:", error);
      res.status(400).json({ message: "Invalid asset data" });
    }
  });

  app.put("/api/assets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assetData = insertAssetSchema.partial().parse(req.body);
      const asset = await storage.updateAsset(id, assetData);
      
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      res.json(asset);
    } catch (error) {
      console.error("Update asset error:", error);
      res.status(400).json({ message: "Invalid asset data" });
    }
  });

  app.delete("/api/assets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAsset(id);
      
      if (!success) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      res.json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Delete asset error:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Portfolio routes
  app.get("/api/portfolios", requireAuth, async (req, res) => {
    try {
      const portfolios = await storage.getUserPortfolios(req.session.userId);
      res.json(portfolios);
    } catch (error) {
      console.error("Get portfolios error:", error);
      res.status(500).json({ message: "Failed to fetch portfolios" });
    }
  });

  app.post("/api/portfolios", requireAuth, async (req, res) => {
    try {
      const portfolioData = insertPortfolioSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const portfolio = await storage.createPortfolio(portfolioData);
      res.status(201).json(portfolio);
    } catch (error) {
      console.error("Create portfolio error:", error);
      res.status(400).json({ message: "Invalid portfolio data" });
    }
  });

  app.get("/api/portfolios/:id/assets", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const portfolio = await storage.getPortfolioById(id);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      // Check if user owns the portfolio
      if (portfolio.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const assets = await storage.getPortfolioAssets(id);
      res.json(assets);
    } catch (error) {
      console.error("Get portfolio assets error:", error);
      res.status(500).json({ message: "Failed to fetch portfolio assets" });
    }
  });

  app.post("/api/portfolios/:id/assets", requireAuth, async (req, res) => {
    try {
      const portfolioId = parseInt(req.params.id);
      const portfolio = await storage.getPortfolioById(portfolioId);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      if (portfolio.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const portfolioAssetData = insertPortfolioAssetSchema.parse({
        ...req.body,
        portfolioId,
      });
      
      const portfolioAsset = await storage.addAssetToPortfolio(portfolioAssetData);
      res.status(201).json(portfolioAsset);
    } catch (error) {
      console.error("Add asset to portfolio error:", error);
      res.status(400).json({ message: "Invalid portfolio asset data" });
    }
  });

  // File upload routes
  app.post("/api/uploads/excel", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const uploadRecord = await storage.createUpload({
        filename: req.file.filename,
        originalName: req.file.originalname,
        type: "excel",
        uploadedBy: req.user.id,
      });

      // Process Excel file in background
      processExcelFile(req.file.path, uploadRecord.id);

      res.status(201).json(uploadRecord);
    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post("/api/uploads/pdf", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const uploadRecord = await storage.createUpload({
        filename: req.file.filename,
        originalName: req.file.originalname,
        type: "pdf",
        uploadedBy: req.user.id,
      });

      // Process PDF file in background
      processPdfFile(req.file.path, uploadRecord.id);

      res.status(201).json(uploadRecord);
    } catch (error) {
      console.error("PDF upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/uploads", requireAdmin, async (req, res) => {
    try {
      const uploads = await storage.getUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Get uploads error:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  // Economic parameters
  app.get("/api/parameters", requireAuth, async (req, res) => {
    try {
      const parameters = await storage.getAllEconomicParameters();
      res.json(parameters);
    } catch (error) {
      console.error("Get parameters error:", error);
      res.status(500).json({ message: "Failed to fetch parameters" });
    }
  });

  // Initialize admin user if it doesn't exist
  async function initializeAdmin() {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      if (!adminUser) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.createUser({
          username: "admin",
          password: hashedPassword,
          role: "admin",
          name: "Administrator",
        });
        console.log("Admin user created with username: admin, password: admin123");
      }
    } catch (error) {
      console.error("Failed to initialize admin user:", error);
    }
  }

  // Background processing functions
  async function processExcelFile(filePath: string, uploadId: number) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const assets = [];
      let importedCount = 0;

      for (const row of data as any[]) {
        try {
          // Map Excel columns to asset fields
          const asset = {
            name: row['Nome'] || row['NOME'] || '',
            code: row['Codigo'] || row['CODIGO'] || row['Code'] || '',
            type: row['Tipo'] || row['TIPO'] || row['Type'] || 'CDB',
            issuer: row['Emissor'] || row['EMISSOR'] || row['Issuer'] || '',
            sector: row['Setor'] || row['SETOR'] || row['Sector'] || '',
            rate: row['Taxa'] || row['TAXA'] || row['Rate'] || '',
            indexer: row['Indexador'] || row['INDEXADOR'] || row['Indexer'] || 'CDI',
            maturityDate: row['Vencimento'] || row['VENCIMENTO'] || row['Maturity'] || '',
            minValue: parseFloat(row['Valor Minimo'] || row['VALOR_MINIMO'] || row['MinValue'] || '1000'),
            frequency: row['Frequencia'] || row['FREQUENCIA'] || row['Frequency'] || 'monthly',
            remPercentage: parseFloat(row['REM%'] || row['REM_PERCENT'] || row['RemPercentage'] || '0'),
          };

          if (asset.name && asset.code) {
            assets.push(asset);
            importedCount++;
          }
        } catch (error) {
          console.error("Error processing row:", error);
        }
      }

      if (assets.length > 0) {
        await storage.bulkCreateAssets(assets);
      }

      await storage.updateUploadStatus(uploadId, "completed", importedCount);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Excel processing error:", error);
      await storage.updateUploadStatus(uploadId, "failed", 0, error.message);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    }
  }

  async function processPdfFile(filePath: string, uploadId: number) {
    try {
      // For now, just mark as completed
      // In a real implementation, you would use a PDF parsing library
      await storage.updateUploadStatus(uploadId, "completed", 0);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("PDF processing error:", error);
      await storage.updateUploadStatus(uploadId, "failed", 0, error.message);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    }
  }

  // Initialize admin user on startup
  await initializeAdmin();

  const httpServer = createServer(app);
  return httpServer;
}
