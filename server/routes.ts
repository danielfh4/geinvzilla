import type { Express, Request, Response, NextFunction } from "express";
import "../types/global";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import {
  insertUserSchema,
  insertAssetSchema,
  insertPortfolioSchema,
  insertPortfolioAssetSchema,
  assets,
  portfolios,
  portfolioAssets,
  uploads
} from "./schema";
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and PDF files are allowed.'));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.session?.userId) { next(); return; }
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = Buffer.from(authHeader.substring(7), 'base64').toString();
        const [id] = decoded.split(':');
        if (!isNaN(Number(id))) { req.session.userId = id; next(); return; }
      } catch {}
    }
    const token = req.cookies?.auth_token;
    if (token) {
      try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [id] = decoded.split(':');
        if (!isNaN(Number(id))) { req.session.userId = Number(id); next(); return; }
      } catch {}
    }
    res.status(401).json({ message: "Authentication required" });
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    const raw = req.session?.userId;
    const userId = Number(raw);
    if (isNaN(userId)) { res.status(401).json({ message: "Authentication required" }); return; }
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') { res.status(403).json({ message: "Admin access required" }); return; }
    req.user = user;
    next();
  };

  // Auth
  app.post("/api/auth/login", async (req, res): Promise<void> => {
    try {
      const { username, password } = req.body;
      if (!username || !password) { res.status(400).json({ message: "Username and password are required" }); return; }
      const user = await storage.getUserByUsername(username);
      if (!user) { res.status(401).json({ message: "Invalid credentials" }); return; }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) { res.status(401).json({ message: "Invalid credentials" }); return; }
      req.session.userId = user.id.toString();
      const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');
      res.cookie('auth_token', token, { httpOnly: false, secure: false, maxAge: 86400000, sameSite: 'lax' });
      const { password: _, ...u } = user;
      res.json({ user: u, token });
    } catch (e) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/auth/logout", (req, res): void => {
    req.session.destroy((err: any) => {
      if (err) { res.status(500).json({ message: "Failed to logout" }); return; }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res): Promise<void> => {
    try {
      const userId = Number(req.session.userId);
      if (isNaN(userId)) { res.status(401).json({ message: "Not authenticated" }); return; }
      const user = await storage.getUser(userId);
      if (!user) { res.status(401).json({ message: "User not found" }); return; }
      const { password: _, ...u } = user;
      res.json({ user: u });
    } catch (e) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // Assets
  app.get("/api/assets", requireAuth, async (req, res): Promise<void> => {
    try {
      const filters: any = {};
      const { type, indexer, minRate, couponMonth, couponMonths, issuer, asset } = req.query;
      if (type && type !== 'all') filters.type = type;
      if (indexer && indexer !== 'all') filters.indexer = indexer;
      if (minRate) filters.minRate = parseFloat(minRate as string);
      if (issuer) filters.issuer = issuer;
      if (asset) filters.asset = asset;
      if (couponMonth && couponMonth !== 'all') filters.couponMonth = couponMonth;
      if (couponMonths) {
        const arr = (couponMonths as string).split(',').map(n=>parseInt(n)).filter(n=>!isNaN(n));
        if (arr.length) filters.couponMonths = arr;
      }
      const list = Object.keys(filters).length ? await storage.searchAssets(filters) : await storage.getAllAssets();
      res.json(list);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch assets" }); }
  });

  app.get("/api/assets/:code/history", requireAuth, async (req, res): Promise<void> => {
    try {
      const history = await storage.getAssetHistory(req.params.code);
      res.json(history);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch asset history" }); }
  });

  app.post("/api/assets", requireAdmin, async (req, res): Promise<void> => {
    try {
      const data = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(data);
      res.status(201).json(asset);
    } catch (e) { console.error(e); res.status(400).json({ message: "Invalid asset data" }); }
  });

  app.put("/api/assets/:id", requireAdmin, async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = insertAssetSchema.partial().parse(req.body);
      const asset = await storage.updateAsset(id, data);
      if (!asset) { res.status(404).json({ message: "Asset not found" }); return; }
      res.json(asset);
    } catch (e) { console.error(e); res.status(400).json({ message: "Invalid asset data" }); }
  });

  app.delete("/api/assets/clear", requireAdmin, async (req, res): Promise<void> => {
    try { await storage.clearAllAssets(); res.json({ message: "Assets cleared successfully" }); }
    catch (e) { console.error(e); res.status(500).json({ message: "Failed to clear assets" }); }
  });

  app.delete("/api/assets/:id", requireAdmin, async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) { res.status(400).json({ message: "Invalid asset ID" }); return; }
      const ok = await storage.deleteAsset(id);
      if (!ok) { res.status(404).json({ message: "Asset not found" }); return; }
      res.json({ message: "Asset deleted successfully" });
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to delete asset" }); }
  });

  // Portfolios
  app.get("/api/portfolios", requireAuth, async (req, res): Promise<void> => {
    try {
      const id = Number(req.session.userId);
      const list = await storage.getUserPortfolios(id);
      res.json(list);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch portfolios" }); }
  });

  app.post("/api/portfolios", requireAuth, async (req, res): Promise<void> => {
    try {
      const id = Number(req.session.userId);
      const data = insertPortfolioSchema.parse({ ...req.body, userId: id });
      const p = await storage.createPortfolio(data);
      res.status(201).json(p);
    } catch (e) { console.error(e); res.status(400).json({ message: "Invalid portfolio data" }); }
  });

  app.get("/api/portfolios/:id/assets", requireAuth, async (req, res): Promise<void> => {
    try {
      const pid = parseInt(req.params.id, 10);
      const port = await storage.getPortfolioById(pid);
      if (!port) { res.status(404).json({ message: "Portfolio not found" }); return; }
      if (port.userId !== Number(req.session.userId)) { res.status(403).json({ message: "Access denied" }); return; }
      const list = await storage.getPortfolioAssets(pid);
      res.json(list);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch portfolio assets" }); }
  });

  app.get("/api/portfolios/:id", requireAuth, async (req, res): Promise<void> => {
    try {
      const pid = parseInt(req.params.id, 10);
      const port = await storage.getPortfolioById(pid);
      if (!port) { res.status(404).json({ message: "Portfolio not found" }); return; }
      if (port.userId !== Number(req.session.userId)) { res.status(403).json({ message: "Access denied" }); return; }
      res.json(port);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch portfolio" }); }
  });

  app.put("/api/portfolios/:id", requireAuth, async (req, res): Promise<void> => {
    try {
      const pid = parseInt(req.params.id, 10);
      const port = await storage.getPortfolioById(pid);
      if (!port) { res.status(404).json({ message: "Portfolio not found" }); return; }
      if (port.userId !== Number(req.session.userId)) { res.status(403).json({ message: "Access denied" }); return; }
      const data = insertPortfolioSchema.partial().parse(req.body);
      const updated = await storage.updatePortfolio(pid, data);
      if (!updated) { res.status(404).json({ message: "Portfolio not found" }); return; }
      res.json(updated);
    } catch (e) { console.error(e); res.status(400).json({ message: "Invalid portfolio data" }); }
  });

  app.post("/api/portfolios/:id/assets", requireAuth, async (req, res): Promise<void> => {
    try {
      const pid = parseInt(req.params.id, 10);
      const port = await storage.getPortfolioById(pid);
      if (!port) { res.status(404).json({ message: "Portfolio not found" }); return; }
      if (port.userId !== Number(req.session.userId)) { res.status(403).json({ message: "Access denied" }); return; }
      const body = insertPortfolioAssetSchema.parse({ ...req.body, portfolioId: pid });
      const pa = await storage.addAssetToPortfolio(body);
      res.status(201).json(pa);
    } catch (e) { console.error(e); res.status(400).json({ message: "Invalid portfolio asset data" }); }
  });

  app.delete("/api/portfolios/:portfolioId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
    try {
      const pid = parseInt(req.params.portfolioId, 10);
      const aid = parseInt(req.params.assetId, 10);
      const port = await storage.getPortfolioById(pid);
      if (!port) { res.status(404).json({ message: "Portfolio not found" }); return; }
      if (port.userId !== Number(req.session.userId)) { res.status(403).json({ message: "Access denied" }); return; }
      const ok = await storage.removeAssetFromPortfolio(pid, aid);
      if (!ok) { res.status(404).json({ message: "Asset not found in portfolio" }); return; }
      res.json({ message: "Asset removed successfully" });
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to remove asset" }); }
  });

  // File uploads
  app.post("/api/uploads/excel", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
      let fileMod = new Date();
      if (req.body.lastModified && !isNaN(Number(req.body.lastModified))) fileMod = new Date(Number(req.body.lastModified));
      else fileMod = fs.statSync(req.file.path).mtime;
      const record = await storage.createUpload({ filename: req.file.filename, originalName: req.file.originalname, type: 'excel', uploadedBy: req.user.id, fileModifiedAt: fileMod });
      processExcelFile(req.file.path, record.id);
      res.status(201).json(record);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to upload file" }); }
  });

  app.post("/api/uploads/pdf", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
      const record = await storage.createUpload({ filename: req.file.filename, originalName: req.file.originalname, type: 'pdf', uploadedBy: req.user.id });
      processPdfFile(req.file.path, record.id);
      res.status(201).json(record);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to upload file" }); }
  });

  app.get("/api/uploads", requireAdmin, async (req, res): Promise<void> => {
    try { const list = await storage.getUploads(); res.json(list); } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch uploads" }); }
  });

  app.delete("/api/database/clear", requireAdmin, async (req, res): Promise<void> => {
    try { await storage.clearAllData(); res.json({ message: "Database cleared successfully" }); } catch (e) { console.error(e); res.status(500).json({ message: "Failed to clear database" }); }
  });

  // Users
  app.get("/api/users", requireAdmin, async (req, res): Promise<void> => {
    try { const list = (await storage.getAllUsers()).map(u => ({ id: u.id, username: u.username, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt, updatedAt: u.updatedAt })); res.json(list); } catch (e) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/users", requireAdmin, async (req, res): Promise<void> => {
    try {
      const parse = insertUserSchema.safeParse(req.body);
      if (!parse.success) { res.status(400).json({ message: "Invalid user data", errors: parse.error.issues }); return; }
      const u = await storage.createUser(parse.data);
      res.status(201).json({ id: u.id, username: u.username, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt });
    } catch (e: any) { console.error(e); if (e.code==='23505') { res.status(409).json({ message: "Username already exists" }); return; } res.status(500).json({ message: "Internal server error" }); }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res): Promise<void> => {
    try {
      const uid = parseInt(req.params.id, 10);
      const updated = await storage.updateUser(uid, req.body);
      if (!updated) { res.status(404).json({ message: "User not found" }); return; }
      res.json({ id: updated.id, username: updated.username, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, updatedAt: updated.updatedAt });
    } catch (e) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res): Promise<void> => {
    try {
      const uid = parseInt(req.params.id, 10);
      if (uid === req.user.id) { res.status(400).json({ message: "Cannot delete own account" }); return; }
      const ok = await storage.deleteUser(uid);
      if (!ok) { res.status(404).json({ message: "User not found" }); return; }
      res.json({ message: "User deleted successfully" });
    } catch (e) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // Parameters
  app.get("/api/parameters", requireAuth, async (req, res): Promise<void> => {
    try { const params = await storage.getAllEconomicParameters(); res.json(params); } catch (e) { console.error(e); res.status(500).json({ message: "Failed to fetch parameters" }); }
  });

  app.put("/api/parameters/:name", requireAdmin, async (req, res): Promise<void> => {
    try {
      const { name } = req.params;
      const { value } = req.body;
      if (typeof value !== 'number') { res.status(400).json({ message: "Value must be a number" }); return; }
      const p = await storage.updateEconomicParameter(name, value);
      res.json(p);
    } catch (e) { console.error(e); res.status(500).json({ message: "Failed to update parameter" }); }
  });

  // Init and background
  async function initializeAdmin() {
    try {
      const admin = await storage.getUserByUsername("admin");
      if (!admin) await storage.createUser({ username: "admin", password: "admin123", role: "admin", name: "Administrador" });
      const defaults = [
        { name: 'CDI', value: 14.65 },
        { name: 'IPCA', value: 4.5 },
        { name: 'SELIC', value: 13.75 },
      ];
      for (const dp of defaults) {
        const existing = await storage.getEconomicParameter(dp.name);
        if (!existing) await storage.updateEconomicParameter(dp.name, dp.value);
      }
    } catch (e) { console.error(e); }
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