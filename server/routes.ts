import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertUserSchema, insertAssetSchema, insertPortfolioSchema, insertPortfolioAssetSchema, assets, portfolios, portfolioAssets, uploads } from "@shared/schema";
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

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    // Check session first
    if (req.session?.userId) {
      return next();
    }
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [userId] = decoded.split(':');
        if (userId && !isNaN(parseInt(userId))) {
          req.session.userId = parseInt(userId);
          return next();
        }
      } catch (e) {
        // Invalid token, continue to check cookie
      }
    }
    
    // Check auth token cookie as fallback
    const authToken = req.cookies?.auth_token;
    if (authToken) {
      try {
        const decoded = Buffer.from(authToken, 'base64').toString();
        const [userId] = decoded.split(':');
        if (userId && !isNaN(parseInt(userId))) {
          req.session.userId = parseInt(userId);
          return next();
        }
      } catch (e) {
        // Invalid token, continue to reject
      }
    }
    
    return res.status(401).json({ message: "Authentication required" });
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    // Use the same auth logic as requireAuth
    let userId = req.session?.userId;
    
    if (!userId) {
      // Check Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = Buffer.from(token, 'base64').toString();
          const [userIdStr] = decoded.split(':');
          if (userIdStr && !isNaN(parseInt(userIdStr))) {
            userId = parseInt(userIdStr);
            req.session.userId = userId;
          }
        } catch (e) {
          // Invalid token
        }
      }
      
      // Check auth token cookie as fallback
      if (!userId) {
        const authToken = req.cookies?.auth_token;
        if (authToken) {
          try {
            const decoded = Buffer.from(authToken, 'base64').toString();
            const [userIdStr] = decoded.split(':');
            if (userIdStr && !isNaN(parseInt(userIdStr))) {
              userId = parseInt(userIdStr);
              req.session.userId = userId;
            }
          } catch (e) {
            // Invalid token
          }
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = await storage.getUser(userId);
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
      
      // Also set a simple token for frontend compatibility
      const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');
      res.cookie('auth_token', token, {
        httpOnly: false,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: 'lax'
      });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
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
      console.log("Session check:", req.session);
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
      
      if (isNaN(portfolioId) || portfolioId <= 0) {
        return res.status(400).json({ message: "Invalid portfolio ID" });
      }
      
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

  // Database cleanup route
  app.delete("/api/database/clear", requireAdmin, async (req, res) => {
    try {
      await storage.clearAllData();
      console.log("Database cleared successfully");
      res.json({ message: "Database cleared successfully" });
    } catch (error) {
      console.error("Database clear error:", error);
      res.status(500).json({ message: "Failed to clear database" });
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
      console.log(`Processing Excel file: ${filePath}`);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      console.log(`Sheet name: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`Data rows found: ${data.length}`);
      
      if (data.length > 0) {
        console.log("First row sample:", JSON.stringify(data[0], null, 2));
        console.log("Available columns:", Object.keys(data[0] as any));
      }

      const assets = [];
      let importedCount = 0;

      for (const row of data as any[]) {
        try {
          // Map Excel columns to asset fields
          const convertExcelDate = (excelDate: any) => {
            if (typeof excelDate === 'number') {
              const date = new Date((excelDate - 25569) * 86400 * 1000);
              return date.toISOString().split('T')[0];
            }
            return String(excelDate || '');
          };

          // Auto-detect asset type based on code pattern
          const assetCode = String(row['ATIVO'] || row['Codigo'] || row['CODIGO'] || row['Code'] || row['code'] || '');
          let assetType = String(row['Tipo'] || row['TIPO'] || row['Type'] || row['type'] || '');
          
          if (!assetType) {
            if (/^CRA\d+/.test(assetCode)) {
              assetType = 'CRA';
            } else if (/^CRI\d+/.test(assetCode) || /^\d{2}[A-Z]\d+/.test(assetCode)) {
              assetType = 'CRI';
            } else if (/^[A-Z]{4}\d{2}$/.test(assetCode)) {
              assetType = 'DEB';
            } else if (assetCode.includes('CDB')) {
              assetType = 'CDB';
            } else if (assetCode.includes('LCA')) {
              assetType = 'LCA';
            } else if (assetCode.includes('LCI')) {
              assetType = 'LCI';
            } else if (assetCode.includes('TESOURO')) {
              assetType = 'Tesouro';
            } else {
              assetType = 'DEB'; // Default fallback
            }
          }

          const asset = {
            name: String(row['Nome'] || row['NOME'] || row['name'] || row['DEVEDOR'] || row['devedor'] || ''),
            code: assetCode,
            type: assetType,
            issuer: String(row['Emissor'] || row['EMISSOR'] || row['Issuer'] || row['issuer'] || row['DEVEDOR'] || row['devedor'] || ''),
            sector: String(row['Setor'] || row['SETOR'] || row['Sector'] || row['sector'] || ''),
            rate: String(row['Taxa'] || row['TAXA'] || row['Rate'] || row['rate'] || ''),
            indexer: String(row['Indexador'] || row['INDEXADOR'] || row['Indexer'] || row['indexer'] || 'CDI'),
            maturityDate: convertExcelDate(row['Vencimento'] || row['VENCIMENTO'] || row['Maturity'] || row['maturity']),
            minValue: "1", // Minimum is always 1 unit
            frequency: String(row['Frequencia'] || row['FREQUENCIA'] || row['Frequency'] || row['frequency'] || row['FREQ CUPOM'] || row['freq_cupom'] || 'Semestral'),
            remPercentage: String(row['REM%'] || row['REM %'] || row['REM_PERCENT'] || row['RemPercentage'] || row['remPercentage'] || '0'),
            rating: String(row['Rating'] || row['RATING'] || row['rating'] || ''),
            couponMonths: String(row['Cupom'] || row['CUPOM'] || row['coupon'] || row['CUPOM MESES'] || ''),
            unitPrice: String(row['PU'] || row['pu'] || row['Preço Unitário'] || row['precoUnitario'] || '1000'),
          };

          console.log("Processed asset:", asset);
          if (asset.name && asset.code) {
            assets.push(asset);
            importedCount++;
            console.log(`Asset added: ${asset.name} (${asset.code})`);
          } else {
            console.log("Asset skipped - missing name or code:", { name: asset.name, code: asset.code });
          }
        } catch (error) {
          console.error("Error processing row:", error);
        }
      }

      console.log(`Processing complete. Assets to import: ${assets.length}`);
      let actualImported = 0;
      if (assets.length > 0) {
        console.log("Saving assets to database...");
        const createdAssets = await storage.bulkCreateAssets(assets as any);
        actualImported = createdAssets.length;
        console.log(`Successfully imported ${actualImported} new assets (${assets.length - actualImported} duplicates skipped)`);
      } else {
        console.log("No valid assets found to import");
      }

      await storage.updateUploadStatus(uploadId, "completed", actualImported);
      console.log(`Upload ${uploadId} completed with ${actualImported} assets imported`);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Excel processing error:", error);
      await storage.updateUploadStatus(uploadId, "failed", 0, (error as any).message);
      
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
      await storage.updateUploadStatus(uploadId, "failed", 0, (error as any).message);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    }
  }

  // Initialize admin user on startup
  await initializeAdmin();

  const httpServer = createServer(app);
  return httpServer;
}
