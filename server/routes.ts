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
      const { type, indexer, minRate, couponMonth, couponMonths, issuer, asset } = req.query;
      
      const filters: any = {};
      if (type && type !== "all") filters.type = type as string;
      if (indexer && indexer !== "all") filters.indexer = indexer as string;
      if (minRate) filters.minRate = parseFloat(minRate as string);
      if (issuer) filters.issuer = issuer as string;
      if (asset) filters.asset = asset as string;
      if (couponMonth && couponMonth !== "all") filters.couponMonth = couponMonth as string;
      if (couponMonths) {
        const monthsArray = (couponMonths as string).split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m));
        if (monthsArray.length > 0) filters.couponMonths = monthsArray;
      }
      
      const assets = Object.keys(filters).length > 0 
        ? await storage.searchAssets(filters)
        : await storage.getAllAssets();
        
      res.json(assets);
    } catch (error) {
      console.error("Get assets error:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:code/history", requireAuth, async (req, res) => {
    try {
      const { code } = req.params;
      const history = await storage.getAssetHistory(code);
      res.json(history);
    } catch (error) {
      console.error("Get asset history error:", error);
      res.status(500).json({ message: "Failed to fetch asset history" });
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

  // Assets cleanup route - MUST be before the :id route
  app.delete("/api/assets/clear", requireAdmin, async (req, res) => {
    try {
      await storage.clearAllAssets();
      console.log("Assets cleared successfully");
      res.json({ message: "Assets cleared successfully" });
    } catch (error) {
      console.error("Assets clear error:", error);
      res.status(500).json({ message: "Failed to clear assets" });
    }
  });

  app.delete("/api/assets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }
      
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

  app.get("/api/portfolios/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const portfolio = await storage.getPortfolioById(id);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      if (portfolio.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(portfolio);
    } catch (error) {
      console.error("Get portfolio error:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.put("/api/portfolios/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const portfolio = await storage.getPortfolioById(id);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      if (portfolio.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const portfolioData = insertPortfolioSchema.partial().parse(req.body);
      const updatedPortfolio = await storage.updatePortfolio(id, portfolioData);
      
      if (!updatedPortfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      res.json(updatedPortfolio);
    } catch (error) {
      console.error("Update portfolio error:", error);
      res.status(400).json({ message: "Invalid portfolio data" });
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

  app.delete("/api/portfolios/:portfolioId/assets/:assetId", requireAuth, async (req, res) => {
    try {
      const portfolioId = parseInt(req.params.portfolioId);
      const assetId = parseInt(req.params.assetId);
      
      const portfolio = await storage.getPortfolioById(portfolioId);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      
      if (portfolio.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.removeAssetFromPortfolio(portfolioId, assetId);
      
      if (!success) {
        return res.status(404).json({ message: "Asset not found in portfolio" });
      }
      
      res.json({ message: "Asset removed from portfolio successfully" });
    } catch (error) {
      console.error("Remove asset from portfolio error:", error);
      res.status(500).json({ message: "Failed to remove asset from portfolio" });
    }
  });

  // File upload routes
  app.post("/api/uploads/excel", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Extract file modification date from the client-side
      // The browser doesn't provide lastModified in the standard upload, 
      // so we'll use a custom approach
      let fileModifiedAt = new Date();
      
      // Check if the client sent the last modified timestamp
      if (req.body.lastModified && !isNaN(parseInt(req.body.lastModified))) {
        fileModifiedAt = new Date(parseInt(req.body.lastModified));
        console.log(`Using client-provided file modification date: ${fileModifiedAt}`);
      } else {
        // Fallback: check if we can extract from file stats
        const stats = fs.statSync(req.file.path);
        fileModifiedAt = stats.mtime;
        console.log(`Using server file stats date: ${fileModifiedAt}`);
      }
      
      console.log(`File uploaded: ${req.file.originalname}`);
      console.log(`Final file modification date: ${fileModifiedAt}`);
      console.log(`Current time: ${new Date()}`);

      const uploadRecord = await storage.createUpload({
        filename: req.file.filename,
        originalName: req.file.originalname,
        type: "excel",
        uploadedBy: req.user.id,
        fileModifiedAt: fileModifiedAt,
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

  // User management routes (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })));
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userValidation = insertUserSchema.safeParse(req.body);
      if (!userValidation.success) {
        return res.status(400).json({ message: "Invalid user data", errors: userValidation.error.errors });
      }
      
      const newUser = await storage.createUser(userValidation.data);
      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      });
    } catch (error: any) {
      console.error("Create user error:", error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (id === req.user?.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Internal server error" });
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

  app.put("/api/parameters/:name", requireAdmin, async (req, res) => {
    try {
      const { name } = req.params;
      const { value } = req.body;
      
      if (typeof value !== 'number') {
        return res.status(400).json({ message: "Value must be a number" });
      }
      
      const parameter = await storage.updateEconomicParameter(name, value);
      res.json(parameter);
    } catch (error) {
      console.error("Update parameter error:", error);
      res.status(500).json({ message: "Failed to update parameter" });
    }
  });

  // Initialize admin user and default parameters
  async function initializeAdmin() {
    try {
      const adminUser = await storage.getUserByUsername("admin");
      if (!adminUser) {
        await storage.createUser({
          username: "admin",
          password: "admin123",
          role: "admin",
          name: "Administrador",
        });
        console.log("Admin user created with username: admin, password: admin123");
      }
      
      // Initialize default economic parameters
      const defaultParams = [
        { name: "CDI", value: 14.65, description: "Taxa CDI anual (%)" },
        { name: "IPCA", value: 4.5, description: "IPCA dos últimos 12 meses (%)" },
        { name: "SELIC", value: 13.75, description: "Taxa SELIC anual (%)" },
      ];
      
      for (const param of defaultParams) {
        try {
          const existingParam = await storage.getEconomicParameter(param.name);
          if (!existingParam) {
            await storage.updateEconomicParameter(param.name, param.value);
            console.log(`Created default parameter: ${param.name} = ${param.value}%`);
          }
        } catch (error: any) {
          console.log(`Parameter ${param.name} initialization skipped:`, error.message);
        }
      }
    } catch (error) {
      console.error("Failed to initialize admin user:", error);
    }
  }

  // Background processing functions
  async function processExcelFile(filePath: string, uploadId: number) {
    try {
      console.log(`Processing Excel file: ${filePath}`);
      
      // Get upload record to access file modification date
      const uploadRecord = await storage.getUploads().then(uploads => 
        uploads.find(u => u.id === uploadId)
      );
      
      // Use the file modification date from the upload record as the data timestamp
      const fileModificationDate = uploadRecord?.fileModifiedAt || new Date();
      
      console.log(`Processing file for upload ID: ${uploadId}`);
      console.log(`File modification date from upload: ${fileModificationDate}`);
      console.log(`This will be used as the historical data timestamp`);
      
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
            if (typeof excelDate === 'string' && excelDate.trim()) {
              // Try to parse different date formats
              const dateFormats = [
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
                /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
                /(\d{1,2})-(\d{1,2})-(\d{4})/    // DD-MM-YYYY
              ];
              
              for (const format of dateFormats) {
                const match = excelDate.match(format);
                if (match) {
                  // Assume DD/MM/YYYY format for slash-separated dates
                  if (format === dateFormats[0]) {
                    const [, day, month, year] = match;
                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    if (!isNaN(date.getTime())) {
                      return date.toISOString().split('T')[0];
                    }
                  } else {
                    const date = new Date(excelDate);
                    if (!isNaN(date.getTime())) {
                      return date.toISOString().split('T')[0];
                    }
                  }
                }
              }
            }
            return null;
          };

          // Helper function to find column value with flexible matching
          const findColumnValue = (possibleNames: string[]) => {
            for (const name of possibleNames) {
              if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                return row[name];
              }
            }
            return '';
          };

          // Auto-detect asset type based on code pattern
          const assetCode = String(findColumnValue([
            'ATIVO', 'Ativo', 'ativo', 'CODIGO', 'Codigo', 'codigo', 'Code', 'code', 
            'PAPEL', 'Papel', 'papel', 'TICKER', 'Ticker', 'ticker'
          ]));
          let assetType = String(findColumnValue([
            'TIPO', 'Tipo', 'tipo', 'Type', 'type', 'CATEGORIA', 'Categoria', 'categoria'
          ]));
          
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
            name: String(findColumnValue([
              'NOME', 'Nome', 'nome', 'NAME', 'Name', 'name', 'DEVEDOR', 'Devedor', 'devedor',
              'RAZAO SOCIAL', 'Razao Social', 'razao_social', 'EMPRESA', 'Empresa', 'empresa'
            ])),
            code: assetCode,
            type: assetType,
            issuer: String(findColumnValue([
              'EMISSOR', 'Emissor', 'emissor', 'ISSUER', 'Issuer', 'issuer', 'DEVEDOR', 'Devedor', 'devedor',
              'EMITENTE', 'Emitente', 'emitente'
            ])),
            sector: String(findColumnValue([
              'SETOR', 'Setor', 'setor', 'SECTOR', 'Sector', 'sector', 'SEGMENTO', 'Segmento', 'segmento'
            ])),
            rate: String(findColumnValue([
              'TAXA', 'Taxa', 'taxa', 'RATE', 'Rate', 'rate', 'RENTABILIDADE', 'Rentabilidade', 'rentabilidade',
              'YIELD', 'Yield', 'yield'
            ])),
            indexer: String(findColumnValue([
              'INDEXADOR', 'Indexador', 'indexador', 'INDEXER', 'Indexer', 'indexer', 'INDICE', 'Indice', 'indice',
              'INDEX', 'Index', 'index'
            ]) || 'CDI'),
            maturityDate: convertExcelDate(findColumnValue([
              'VENCIMENTO', 'Vencimento', 'vencimento', 'MATURITY', 'Maturity', 'maturity',
              'DATA VENCIMENTO', 'Data Vencimento', 'data_vencimento'
            ])),
            minValue: "1", // Minimum is always 1 unit
            importedAt: fileModificationDate, // Use file modification date
            frequency: String(findColumnValue([
              'FREQUENCIA', 'Frequencia', 'frequencia', 'FREQUENCY', 'Frequency', 'frequency',
              'FREQ CUPOM', 'Freq Cupom', 'freq_cupom', 'PERIODICIDADE', 'Periodicidade', 'periodicidade'
            ]) || 'Semestral'),
            remPercentage: String((() => {
              const remValue = findColumnValue([
                'REM%', 'REM %', 'rem%', 'rem %', 'REM_PERCENT', 'RemPercentage', 'remPercentage',
                'REMUNERACAO', 'Remuneracao', 'remuneracao', 'COMISSAO', 'Comissao', 'comissao'
              ]) || '0';
              if (typeof remValue === 'string' && remValue.includes('%')) {
                return parseFloat(remValue.replace('%', '').replace(',', '.'));
              }
              return parseFloat(remValue) || 0;
            })()),
            rating: String(findColumnValue([
              'RATING', 'Rating', 'rating', 'CLASSIFICACAO', 'Classificacao', 'classificacao'
            ])),
            couponMonths: String(findColumnValue([
              'CUPOM', 'Cupom', 'cupom', 'COUPON', 'Coupon', 'coupon', 'CUPOM MESES', 'Cupom Meses', 'cupom_meses',
              'MESES CUPOM', 'Meses Cupom', 'meses_cupom'
            ])),
            unitPrice: String((() => {
              const puValue = findColumnValue([
                'PU', 'pu', 'Pu', 'PRECO UNITARIO', 'Preco Unitario', 'preco_unitario',
                'UNIT PRICE', 'Unit Price', 'unit_price', 'VALOR UNITARIO', 'Valor Unitario', 'valor_unitario'
              ]);
              
              if (!puValue || puValue === '' || puValue === null || puValue === undefined) {
                console.log(`No PU value found for asset ${assetCode}, using default 1000.00`);
                return null; // Return null instead of default value when no PU is found
              }
              
              let numericValue;
              if (typeof puValue === 'string') {
                // Handle Brazilian decimal format (1.234,56) and international format (1,234.56)
                let cleanValue = puValue.toString().trim();
                
                // Remove currency symbols
                cleanValue = cleanValue.replace(/[R$\s]/g, '');
                
                // Handle different decimal formats
                if (cleanValue.includes(',') && cleanValue.includes('.')) {
                  // Brazilian format with thousands separator: 1.234,56 -> 1234.56
                  const parts = cleanValue.split(',');
                  if (parts.length === 2 && parts[1].length <= 2) {
                    cleanValue = parts[0].replace(/\./g, '') + '.' + parts[1];
                  }
                } else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
                  // Only comma as decimal separator: 1234,56 -> 1234.56
                  if (/\d+,\d{1,2}$/.test(cleanValue)) {
                    cleanValue = cleanValue.replace(',', '.');
                  }
                }
                // If only dots, assume it's already in correct format
                
                numericValue = parseFloat(cleanValue);
              } else {
                numericValue = parseFloat(puValue);
              }
              
              // Validate the number
              if (isNaN(numericValue) || numericValue <= 0) {
                console.log(`Invalid PU value "${puValue}" for asset ${assetCode}, skipping PU`);
                return null;
              }
              
              console.log(`Asset ${assetCode} PU: "${puValue}" -> ${numericValue.toFixed(2)}`);
              return numericValue.toFixed(2);
            })()),
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
