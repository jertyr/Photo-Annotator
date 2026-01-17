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

  // Step 1: Clarify what the user wants to mark (fast model)
  app.post("/api/clarify-markup", async (req, res) => {
    try {
      const { imageBase64, description } = req.body;

      if (!imageBase64 || !description) {
        return res.status(400).json({ error: "Image and description are required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for a construction photo annotation app. The user will show you a photo and describe what they want to mark up.

Your job is to:
1. Look at the photo carefully
2. Understand what the user is trying to mark
3. Clarify and confirm what you'll annotate

IMPORTANT - MOVE/ADJUST COMMANDS:
If the user says "move", "adjust", "reposition", or "drag" an existing annotation, respond with:
"You can drag any annotation to reposition it - just tap and hold, then move it where you want."
Do NOT try to create a new annotation for move commands.

RESPOND WITH A SHORT, FRIENDLY CONFIRMATION of what you found and will mark. Be VERY SPECIFIC about:
- The exact object you see (color, shape, position in photo)
- Where on that object the annotation will be placed

Examples:
- User: "circle the car" → "I see a red sedan in the center of the driveway. I'll circle it."
- User: "arrow to the crack" → "I found a horizontal crack in the upper-left wall near the ceiling. I'll point an arrow at it."
- User: "8 inches wide on the bowl" → "I see a yellow bowl. I'll add an 8-inch measurement line spanning across the top rim of the bowl."
- User: "move the line" → "You can drag any annotation to reposition it - just tap and hold, then move it where you want."

If you can't find what they're describing, ask for clarification.
Keep responses to 1-2 sentences max.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "low",
                },
              },
              {
                type: "text",
                text: description,
              },
            ],
          },
        ],
        max_completion_tokens: 100,
        temperature: 0.3,
      });

      const clarification = completion.choices[0]?.message?.content?.trim() || 
        `I'll mark: "${description}"`;

      res.json({ clarification, original: description });
    } catch (error) {
      console.error("Error clarifying markup:", error);
      // Fallback - just echo back
      res.json({ 
        clarification: `I'll mark: "${req.body.description}"`, 
        original: req.body.description 
      });
    }
  });

  // Step 2: Generate the actual annotations (vision model)
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
            content: `You are an expert construction photo annotator. Your job is to analyze photos and place annotations PRECISELY on the objects the user describes.

VIEWPORT: The image is ${width}px wide by ${height}px tall. Coordinates are in pixels from top-left (0,0).

STEP-BY-STEP OBJECT DETECTION:
1. First, scan the ENTIRE image and identify ALL visible objects
2. Find the SPECIFIC object the user mentioned (by color, shape, position)
3. Determine the object's EXACT pixel boundaries (left edge, right edge, top edge, bottom edge)
4. Place the annotation AT those boundaries, not near them

ANNOTATION TYPES:
1. "circle" - Place (x,y) at the EXACT CENTER of the object. "size" = radius to encompass the object.
2. "arrow" - Place (x,y) at the ARROW TIP which should touch the object's edge.
3. "measurement" - For showing dimensions:
   - (x,y) = the LEFT END of the measurement line (at the object's left edge)
   - "width" = the horizontal span in pixels from left edge to right edge of the object
   - If user says "top of the bowl", place y at the TOP EDGE of the bowl
   - If user says "8 inches wide", the text should show "8""
4. "text" - A simple text label at (x,y).
5. "highlight" - Rectangular area with "width" and "height".

MEASUREMENT PLACEMENT EXAMPLES:
- "8 inches wide at the top of the bowl": Find the bowl, locate its TOP RIM, measure from left edge to right edge of the rim. x = left edge x-coordinate, y = top rim y-coordinate, width = pixels from left to right edge.
- "36 inch doorway": Find the door frame, x = left door frame edge, y = top of door, width = door frame pixel width.

CRITICAL: Look at the ACTUAL object edges. If there's a yellow bowl, find where the yellow pixels START and END on each side. Don't guess - analyze the image.

RESPOND ONLY WITH JSON:
{
  "annotations": [
    { 
      "type": "circle" | "arrow" | "measurement" | "text" | "highlight",
      "x": number (LEFT edge for measurements, CENTER for circles),
      "y": number (object position - top edge if specified),
      "text": "string",
      "size": number (for circle radius),
      "width": number (for measurement span in pixels),
      "height": number (for highlight)
    }
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
                text: `User request: "${description}"

ANALYZE THIS IMAGE:
1. What objects do you see? List them mentally.
2. Which object matches what the user is describing?
3. What are the EXACT pixel coordinates of that object's edges?
4. Place the annotation at those precise coordinates.

For measurements: The measurement line should span the ACTUAL width of the object in the image.`,
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
