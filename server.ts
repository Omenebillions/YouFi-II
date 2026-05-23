import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Initialize OpenAI client
  let openai: OpenAI | null = null;
  const getOpenAI = () => {
    if (!openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set.");
      }
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
  };

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { userMessage, systemInstruction } = req.body;
      const ai = getOpenAI();
      const response = await ai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
      });
      res.json({ text: response.choices[0].message.content });
    } catch (error: any) {
      console.error("OpenAI Chat Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your OpenAI API Key is invalid. Please update it in the AI Studio settings." });
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
      const ai = getOpenAI();
      
      const parts = contents.parts || [];
      const messages: any[] = [];
      const openaiContent: any[] = [];

      for (const part of parts) {
        if (part.text) {
           openaiContent.push({ type: "text", text: part.text });
        }
        if (part.inlineData) {
           openaiContent.push({
              type: "image_url",
              image_url: {
                 url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              }
           });
        }
      }

      messages.push({ role: "user", content: openaiContent });

      const oaiOptions: any = {
         model: "gpt-4o",
         messages,
         temperature: config?.temperature ?? 0.2,
      };

      if (config?.responseMimeType === 'application/json') {
         oaiOptions.response_format = { type: "json_object" };
         const schemaStr = JSON.stringify(config.responseSchema || {});
         messages.unshift({
            role: "system",
            content: `You are a data extraction assistant. You must respond with valid JSON wrapping your output in a "data" property that matches this schema: ${schemaStr}. Return ONLY JSON.`
         });
      } else {
         messages.unshift({
            role: "system",
            content: "You are a helpful assistant."
         });
      }

      const response = await ai.chat.completions.create(oaiOptions);
      let aiText = response.choices[0].message.content || "";

      if (config?.responseMimeType === 'application/json') {
         try {
            const parsed = JSON.parse(aiText);
            if (parsed.data) {
               aiText = JSON.stringify(parsed.data);
            }
         } catch(e) {}
      }

      res.json({ text: aiText });
    } catch (error: any) {
      console.error("OpenAI Generate Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your OpenAI API Key is invalid. Please update it in the AI Studio settings." });
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
