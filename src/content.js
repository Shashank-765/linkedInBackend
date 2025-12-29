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
        const prompt = `Topic / Name: ${topic}

        Instructions:
        - Research the topic or individual
        - Highlight their starting point or early phase
        - Connect their decisions and mindset to long-term success
        - Extract lessons for youth, founders, or builders
        - Keep the content short, sharp, and human-like

        Generate a LinkedIn post with:
        - One strong heading
        - Brief narrative paragraphs
        - 3–5 key lessons or insights
        - A thoughtful closing line

        Formatting rules (STRICT):
        - Do NOT use asterisks (*)
        - Do NOT use bold text
        - Do NOT use markdown
        - Bullet points must start with a dash (-) only
        - Hashtags must be in the last line only
        - Simple, clean English
        - Output only the final content
        

        `;



          const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: `You are a research-driven storyteller who writes short, human-like LinkedIn posts.

        Your job is to:
        - Research the given person or topic
        - Understand their journey, mindset, or impact
        - Extract lessons relevant to youth, founders, and builders
        - Write concise, inspirational content that feels written by a real human

        Writing style:
        - Natural, reflective, and confident
        - Story-driven but brief
        - Inspirational without hype or exaggeration
        - Practical and grounded

        Structure rules:
        - Start with a strong heading
        - Use short paragraphs for readability
        - Include 3–5 clear lessons or insights (as lines or pointers)
        - End with a reflective or motivating closing thought
        - 5–8 relevant hashtags at the end


        Formatting rules:
        - Keep it LinkedIn-friendly and concise
        - Never use asterisks (*) or bold formatting
        - No emojis
        - No markdown
        - Simple, clear English
        - Output only the final content

        ` },
              { role: "user", content: prompt }],
          });

          console.log('responce============>', response.choices[0].message.content.trim())

          return response.choices[0].message.content.trim();
}

/**
 * Generate N images using OpenAI DALL·E 3
 */
export async function generateImages(topic, n = 1) {
  const filePaths = [];

                    for (let i = 0; i < n; i++) {
                  const prompt = `
                  Minimal, premium LinkedIn carousel background for Slide ${i + 1}.

                  Theme inspiration: "${topic}"

                  Visually represent the idea of this topic using abstract symbolism.
                  For example:
                  - Growth: upward motion, expanding shapes, rising light
                  - Innovation: flowing geometry, layered depth, dynamic curves
                  - Leadership: strong central form, balance, clarity
                  - Long-term vision: horizon lines, depth, perspective, light paths
                  - Resilience: solid structures, contrast, grounded composition

                  Design style:
                  - Clean, abstract, modern
                  - Professional and aspirational
                  - Business-focused visual language
                  - Smooth gradients with subtle depth
                  - Balanced composition with clear focal flow

                  Color palette:
                  - Use calm, confident colors (deep blues, muted purples, charcoal, soft whites, subtle accents)
                  - Avoid playful or neon tones

                  Strict rules:
                  - No text, letters, numbers, symbols, icons, logos, or typography
                  - No people, faces, animals, or objects
                  - No illustrations or cartoons
                  - Pure abstract background only
                  - Suitable for a LinkedIn professional carousel
                  `;




    const response = await client.images.generate({
      model: "dall-e-3", // DALL·E 3 (image model)
      prompt: prompt,
      size: "1024x1024", // options: "256x256", "512x512", "1024x1024"

    });

    // Image is returned as a URL (or base64 if requested)
    const image_url = response.data[0].url;
console.log('image_url', image_url)
    // // Download & save locally (optional)
    // const res = await fetch(image_url);
    // const buffer = Buffer.from(await res.arrayBuffer());

    // const filePath = path.resolve(`./uploads/gen_image_${i + 1}.png`);
    // fs.writeFileSync(filePath, buffer);

    filePaths.push(image_url);
  }

  return filePaths;
}
