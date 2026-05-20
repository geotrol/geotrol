import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Technical Co-Pilot Chat Endpoint
app.post("/api/copilot", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      res.status(400).json({ error: "Missing message query" });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Graceful absolute fallback if API key is not present
      res.json({
        text: "Bonjour! I am your Geotech Precision Technical Co-Pilot. (NOTE: The Gemini API Key is currently not set up in Settings > Secrets, so I am running in local simulation mode. Feel free to ask any manufacturing questions!).\n\nFor precision machining in Montreal, we recommend Aluminum 6061-T6 for general enclosures and Stainless Steel 316 for chemical-facing parts. For standard CNC milled parts, a tolerance of ±0.127 mm (±0.005 in) is highly economical!"
      });
      return;
    }

    const systemInstruction = `You are the Geotech Precision Technical Co-Pilot, an elite Senior CNC Machining Estimator & Manufacturing Engineer based at Geotech Precision Inc. in Ville Saint-Laurent, Montreal, Quebec. 
We have over 30 years of manufacturing excellence (established in 1990, starting with Swiss screw-style machines and transitioning fully to multi-axis CNC milling & turning).
Your job is to assist design engineers, sourcing directors, and prototype developers to optimize their parts for CNC manufacturing (Design for Manufacturability - DFM).

Guidelines for your responses:
1. Speak professionally, helpful list-style and conversational, yet highly technical and precise (using terms like 'g-code', 'tool radii', 'surface finish Ra', 'bead blast', 'lathe with live tooling', '4-axis machining').
2. Keep in mind Geotech's location (Montreal, Canada, we ship across North America).
3. Compare materials when asked (metals: Al 6061, SS 304, SS 316, Brass, Copper, Titanium; plastics: Delrin/POM, HDPE, PTFE, PEEK, Polycarbonate).
4. Provide recommendations on wall-thicknesses, internal pocket radii (prefer tooling matching standard end mills like 1/8", 1/4"), thread tapping depths, and tolerance selection (Standard +/- 0.127mm, High +/- 0.025mm, or Ultra +/- 0.0001" / 0.003mm).
5. Address the user by name if provided, keep responses structured with clear markdown bullets.
6. Speak in a friendly, helpful dual English/French bilingual-influenced Canadian tone if they prompt in French, default to elegant professional English. Keep answers relatively concise and highly practical. Avoid fluff.`;

    const chatHistory = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: h.content }]
    }));

    // Use chats API or direct generateContent
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      history: chatHistory,
    });

    const response = await chat.sendMessage({
      message,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Copilot Error:", error);
    res.status(500).json({ error: "Failed to process chat with Geotech Technical Co-Pilot. " + error.message });
  }
});

// Instant RFQ Request Endpoint
app.post("/api/rfq", (req, res) => {
  try {
    const { contactInfo, parts, projectNotes } = req.body;
    
    // Process RFQ, save info or simulate CRM ingestion
    const ticketId = `GEOTECH-RFQ-${Math.floor(100000 + Math.random() * 900000)}`;
    const receivedAt = new Date();
    
    // We can simulate an automated assessment
    let totalEstimatedPrice = 0;
    const processedParts = (parts || []).map((part: any, idx: number) => {
      const qty = parseInt(part.quantity) || 10;
      const x = parseFloat(part.dimensions?.x) || 100;
      const y = parseFloat(part.dimensions?.y) || 100;
      const z = parseFloat(part.dimensions?.z) || 15;
      const complexity = part.complexity || "medium";
      const material = part.material || "Aluminum 6061-T6";
      const tolerance = part.tolerance || "Standard (±0.127mm)";
      const finish = part.finish || "As-Machined";
      
      // Compute simple bounding box volume
      const volumeCm3 = (x * y * z) / 1000;
      
      // Base material multiplier
      let matMultiplier = 1.0;
      if (material.includes("Stainless Steel 316")) matMultiplier = 2.4;
      else if (material.includes("Stainless Steel 304")) matMultiplier = 1.9;
      else if (material.includes("Brass") || material.includes("Copper")) matMultiplier = 2.0;
      else if (material.includes("Titanium")) matMultiplier = 4.5;
      else if (material.includes("PEEK")) matMultiplier = 3.5;
      else if (material.includes("Delrin") || material.includes("POM")) matMultiplier = 0.9;
      else if (material.includes("Polycarbonate")) matMultiplier = 0.8;
      
      // Finishing base cost
      let finishCostPerPart = 2.5;
      if (finish.includes("Anodized")) finishCostPerPart = 8.0;
      if (finish.includes("Bead Blasted")) finishCostPerPart = 5.0;
      if (finish.includes("Powder Coated")) finishCostPerPart = 12.0;
      
      // Tolerance scaling factor
      let tolMultiplier = 1.0;
      if (tolerance.includes("±0.025mm")) tolMultiplier = 1.35;
      if (tolerance.includes("±0.005mm") || tolerance.includes("±0.003mm")) tolMultiplier = 1.85;
      
      // Complexity setup cost and run rate per cm3
      let setupCost = 150; // CAD standard flat setup
      let costPerCm3 = 0.15;
      if (complexity === "high") {
        setupCost = 280;
        costPerCm3 = 0.35;
      } else if (complexity === "low") {
        setupCost = 80;
        costPerCm3 = 0.08;
      }
      
      // Formula: Cost per part = (setupCost / qty) + (volumeCm3 * costPerCm3 * matMultiplier * tolMultiplier) + finishCostPerPart
      const materialAndMachiningCost = (volumeCm3 * costPerCm3 * matMultiplier * tolMultiplier);
      const unitCost = (setupCost / qty) + materialAndMachiningCost + finishCostPerPart;
      const roundedUnitCost = Math.round(unitCost * 100) / 100;
      const totalPartCost = Math.round((roundedUnitCost * qty) * 100) / 100;
      
      totalEstimatedPrice += totalPartCost;
      
      return {
        ...part,
        id: part.id || `part-${idx}`,
        calculatedVolumeCm3: Math.round(volumeCm3 * 10) / 10,
        estimatedUnitCostCad: roundedUnitCost,
        estimatedTotalCostCad: totalPartCost,
        estimatedCycleTimeMinutes: Math.round((2.5 * matMultiplier * (complexity === "high" ? 3 : complexity === "low" ? 0.7 : 1.5)) * 10) / 10,
      };
    });

    res.json({
      success: true,
      ticketId,
      receivedAt,
      parts: processedParts,
      totalEstimatedPrice: Math.round(totalEstimatedPrice * 100) / 100,
      status: "Analyzing Files",
      nextSteps: [
        "A Geotech customer support engineer will review the uploaded designs.",
        "We will verify your CAD tolerances and tap holes for geometric compliance.",
        "A formal customized aerospace-compliant quote will be emailed to you within 2-4 business hours."
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to submit RFQ: " + error.message });
  }
});

// Configure Vite or Static Fallback
async function startServer() {
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
    console.log(`[Geotech Server] Live on http://0.0.0.0:${PORT}`);
  });
}

startServer();
