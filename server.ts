import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.memoryStorage(); // Use memory storage for sharp processing

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for raw upload
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = Number(process.env.PORT) || 3000;
  const NODE_ENV = process.env.NODE_ENV || 'development';
  console.log(`>>> Starting Heart Server...`);
  console.log(`>>> Port: ${PORT}`);
  console.log(`>>> Environment: ${NODE_ENV}`);
  console.log(`>>> Working Dir: ${process.cwd()}`);

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);
    });

    socket.on("sendMessage", ({ room, message }) => {
      io.to(room).emit("receiveMessage", {
        ...message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Middleware
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  // 1. API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      server: "Styn Africa VPS",
      storage: "NVMe",
      nodeVersion: process.version,
      message: "Heart Backend is running with Stynaff configurations"
    });
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + "-" + req.file.originalname.replace(/\s+/g, '-');
    const outputPath = path.join(uploadsDir, filename);

    try {
      if (req.file.mimetype.startsWith("image/")) {
        // Compress image using sharp
        await sharp(req.file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(outputPath);
      } else {
        // For videos or other files, just save as is
        fs.writeFileSync(outputPath, req.file.buffer);
      }

      const fileUrl = `/uploads/${filename}`;
      res.json({ url: fileUrl });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  // 2. Vite Integration for Development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite server in development mode...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: {
          usePolling: true,
          interval: 100,
        },
      },
      appType: "spa",
    });
    console.log("Vite server initialized.");
    app.use(vite.middlewares);
  } else {
    console.log("Running in production mode.");
    const distPath = path.join(process.cwd(), "dist");
    
    // Check if dist exists to prevent crash
    if (!fs.existsSync(distPath)) {
      console.warn("WARNING: 'dist' directory not found. Did you run 'npm run build'?");
    }

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          res.status(500).send("Server Error: Static files missing. Please run build.");
        }
      });
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Styn Africa Server running at http://0.0.0.0:${PORT}`);
    console.log(`>>> Domain: heart.styni.com`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
