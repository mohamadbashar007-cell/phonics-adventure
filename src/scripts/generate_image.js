import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

async function generateAndSaveImage() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: 'A vibrant, high-quality 3D cartoon illustration for children. A young boy with brown hair and a blue shirt and a girl with curly red hair are playing in a sunny garden. The boy is crouched by a small stream looking at a snail. There is a red playground slide on the left. In the background, there are yellow flowers, a stone fountain, and a friendly green snake peeking from a tree. The style is soft, colorful, and cinematic 3D animation style.',
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:2",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const buffer = Buffer.from(base64Data, 'base64');
        
        const dir = './src/assets';
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const filePath = path.join(dir, 'story-s.png');
        fs.writeFileSync(filePath, buffer);
        console.log(`Image saved successfully to ${filePath}`);
        return;
      }
    }
    console.error("No image part found in response");
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

generateAndSaveImage();
