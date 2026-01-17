import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/refine-text", async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that refines construction and remodeling notes for clarity. 
Your job is to take quick, informal dictated notes and make them cleaner and more professional while keeping them concise.
Keep the meaning exactly the same, just improve grammar, spelling, and clarity.
Output only the refined text, nothing else.
Keep it brief - these are annotations for photos, not paragraphs.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const refinedText = completion.choices[0]?.message?.content?.trim() || text;

      res.json({ refinedText, original: text });
    } catch (error) {
      console.error("Error refining text:", error);
      res.json({ refinedText: req.body.text, original: req.body.text, error: "Refinement failed" });
    }
  });

  app.post("/api/analyze-markup", async (req, res) => {
    try {
      const { imageBase64, description, imageWidth, imageHeight } = req.body;

      if (!imageBase64 || !description) {
        return res.status(400).json({ error: "Image and description are required" });
      }

      const width = imageWidth || 400;
      const height = imageHeight || 300;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert construction photo annotator. Analyze the photo and the user's markup description to determine exactly where annotations should be placed.

The image is displayed in a viewport of approximately ${width}px wide by ${height}px tall.
Coordinates MUST be provided in absolute pixels relative to this viewport (0,0 is top-left).

IMPORTANT:
1. Identify the specific object mentioned in the description.
2. Provide the pixel coordinates (x, y) for that object.
3. For arrows, the (x, y) should be the point of the arrow.
4. For highlights, the (x, y) should be the center of the highlight.
5. Provide a concise, professional label for the annotation.

Respond ONLY with a JSON object:
{
  "annotations": [
    { "type": "arrow" | "highlight" | "text", "x": number, "y": number, "text": "string" }
  ]
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: `Please analyze this photo and add markup based on this description: "${description}"`,
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseText);
        result = {
          annotations: [{
            type: "text",
            x: 20,
            y: 30,
            text: description,
          }],
          summary: "Could not analyze image, placed annotation at default position",
        };
      }

      if (!result.annotations || !Array.isArray(result.annotations)) {
        result.annotations = [{
          type: "text",
          x: 20,
          y: 30,
          text: description,
        }];
      }

      result.annotations = result.annotations.map((ann: any) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ann.type || "text",
        x: Math.max(10, Math.min(width - 100, ann.x || 20)),
        y: Math.max(10, Math.min(height - 40, ann.y || 30)),
        text: ann.text || description,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error analyzing markup:", error);
      res.status(500).json({ 
        error: "Failed to analyze image",
        annotations: [{
          id: Date.now().toString(),
          type: "text",
          x: 20,
          y: 30,
          text: req.body.description || "Note",
        }],
      });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
