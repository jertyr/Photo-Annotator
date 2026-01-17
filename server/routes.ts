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
            content: `You are an expert construction photo annotator with precise object detection skills. Your job is to analyze photos and place annotations EXACTLY on the objects the user describes.

VIEWPORT: The image is ${width}px wide by ${height}px tall. Coordinates are in pixels from top-left (0,0).

ANNOTATION TYPES:
1. "circle" - A transparent circle to highlight/circle an object. Place (x,y) at CENTER of the object. Include "size" (radius in pixels, typically 30-80).
2. "arrow" - An arrow pointing TO an object with a label. Place (x,y) at the ARROW TIP on the object.
3. "measurement" - An architectural dimension line showing a measurement. Include "width" for horizontal span in pixels.
4. "text" - A simple text label. Place (x,y) at the label position.
5. "highlight" - A rectangular highlight area. Include "width" and "height" in pixels.

CRITICAL RULES FOR ACCURACY:
1. LOOK CAREFULLY at the photo. Find the EXACT object mentioned (car, crack, tile, outlet, etc.).
2. Place coordinates at the ACTUAL pixel location of that object, not just somewhere in the image.
3. For "circle the car" - find the car's center coordinates precisely.
4. For measurements like "36 inches wide" - create a measurement annotation spanning the object.
5. For "arrow pointing to X" - place the arrow tip ON the object X.

MEASUREMENT FORMAT:
When user mentions dimensions (36", 4 feet, 2.5m), create a "measurement" type with the text showing the dimension in architectural format: 3'-0", 36", 4'-6", etc.

RESPOND ONLY WITH JSON:
{
  "annotations": [
    { 
      "type": "circle" | "arrow" | "measurement" | "text" | "highlight",
      "x": number,
      "y": number,
      "text": "string",
      "size": number (for circle radius),
      "width": number (for measurement/highlight),
      "height": number (for highlight)
    }
  ]
}

Be PRECISE. The user will drag to adjust if needed, but give them the best starting position by actually finding the object in the image.`,
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
                text: `Analyze this photo carefully. Find and mark: "${description}"

Look at the image and identify the EXACT location of what I'm describing. Place the annotation precisely on that object.`,
              },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0.2,
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
            x: width / 2,
            y: height / 2,
            text: description,
          }],
        };
      }

      if (!result.annotations || !Array.isArray(result.annotations)) {
        result.annotations = [{
          type: "text",
          x: width / 2,
          y: height / 2,
          text: description,
        }];
      }

      result.annotations = result.annotations.map((ann: any) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ann.type || "text",
        x: Math.max(10, Math.min(width - 20, ann.x || width / 2)),
        y: Math.max(10, Math.min(height - 20, ann.y || height / 2)),
        text: ann.text || description,
        size: ann.size || 40,
        width: ann.width || 100,
        height: ann.height || 50,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error analyzing markup:", error);
      res.status(500).json({ 
        error: "Failed to analyze image",
        annotations: [{
          id: Date.now().toString(),
          type: "text",
          x: 100,
          y: 100,
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
