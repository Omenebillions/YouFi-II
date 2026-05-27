import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini client
  let gemini: GoogleGenAI | null = null;
  const getGemini = () => {
    if (!gemini) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
      }
      gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return gemini;
  };

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { userMessage, systemInstruction } = req.body;
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your Gemini API Key is invalid. Please update it in the AI Studio settings." });
      } else if (error.status === 429) {
        res.status(429).json({ error: "Our AI service is currently experiencing high demand. Please try again in a moment." });
      } else {
        res.status(500).json({ error: error.message || "Failed to communicate with AI" });
      }
    }
  });

  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { contents, config } = req.body;
      const ai = getGemini();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash", // Updated model logic below
        contents,
        config,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Generate Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your Gemini API Key is invalid. Please update it in the AI Studio settings." });
      } else if (error.status === 429) {
        res.status(429).json({ error: "Our AI service is currently experiencing high demand. Please try again in a moment." });
      } else {
        res.status(500).json({ error: error.message || "Failed to parse with AI" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
