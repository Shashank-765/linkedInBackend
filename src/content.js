import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate LinkedIn-style commentary
 */
export async function generatePostContent(topic) {
  const prompt = `Create a LinkedIn carousel style post about: "${topic}".
Format with emojis, bullets, and hashtags. Keep it engaging, under 200 words.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate N images using Stability AI (SD3)
 */
export async function generateImages(topic, n = 2) {
  const filePaths = [];

  for (let i = 0; i < n; i++) {
    const payload = {
      prompt: `Minimal, bold LinkedIn carousel graphic about: ${topic}. Slide ${i + 1}`,
      output_format: "png",
    };

    // const response = await axios.postForm(
    //   "https://api.stability.ai/v2beta/stable-image/generate/sd3",
    //   axios.toFormData(payload, new FormData()),
    //   {
    //     validateStatus: undefined,
    //     responseType: "arraybuffer",
    //     headers: {
    //       Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
    //       Accept: "image/*",
    //     },
    //   }
    // );

    const filePath = path.resolve(`./gen_image_${i + 1}.png`);
    filePaths.push(filePath);
    // if (response.status === 200) {
    //   fs.writeFileSync(filePath, Buffer.from(response.data));
    // } else {
    //   throw new Error(`${response.status}: ${response.data.toString()}`);
    // }
  }

  return filePaths;
}
