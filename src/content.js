import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import dotenv from "dotenv";
dotenv.config();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });






const PRICING = {
  "gpt-4o-mini": {
    input: 0.15 / 1_000_000,
    output: 0.60 / 1_000_000,
  }
};

function calculateCost(model, inputTokens, outputTokens) {
  const rates = PRICING[model];

  const inputCost = inputTokens * rates.input;
  const outputCost = outputTokens * rates.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
}

/**
 * Generate LinkedIn-style commentary
 */
export async function generatePostContent(topic) {
  const prompt = `
Topic: ${topic}

Step 1 — Internally classify the topic into one of these types:
- Person (founder, leader, public figure)
- Company or Product
- Technology or Trend
- Concept or Skill
- Event or News

Step 2 — Adapt the writing based on the type:
- If Person → focus on journey, early struggles, decisions, mindset.
- If Company/Product → focus on origin, problem solved, why it matters.
- If Technology/Trend → focus on what changed, why now, future impact.
- If Concept/Skill → focus on why it's important, how it helps, how to apply.
- If Event/News → focus on what happened, why it matters, what we learn.

Step 3 — Write a LinkedIn post that is specific to THIS topic, not generic.

Step 4 — Add a human layer:
- Subtly connect the topic to common feelings: confusion, ambition, fear of starting, slow progress, discipline, uncertainty, or learning curves.
- Make the reader feel “this applies to me” without saying it explicitly.
- The tone should feel supportive, grounded, and realistic — not motivational, not hype.

Strict requirements:
- Mention at least 2 concrete, topic-specific facts or examples.
- Avoid vague phrases like "this shows that hard work matters".
- No generic motivational language.
- Be precise, thoughtful, and relevant.

Generate a LinkedIn post with:
- One strong heading
- 2 short narrative paragraphs (not long)
- 3–4 practical lessons or insights derived from the topic
- A thoughtful, slightly human closing line (reflective, not inspirational)

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
    temperature: 0.6, // slightly lower = less generic, more factual
    messages: [
      {
        role: "system",
        content: `

        You are a topic-aware research writer for LinkedIn.

                Your job:
                - Understand the topic deeply before writing.
                - Adapt tone, angle, and structure to the topic type.
                - Use concrete facts and context.
                - Avoid generic inspiration.

                Style:
                - Clear
                - Insightful
                - Human
                - Specific

                Never:
                - Use emojis
                - Use markdown
                - Use hype language
                - Use generic life advice

                Always:
                - Be grounded in the topic
                - Be useful to builders, founders, and young professionals
                - Output only the final content
                `
      },
      { role: "user", content: prompt }
    ]
  });
  const usage = response.usage;

  const cost = calculateCost(
    "gpt-4o-mini",
    usage.prompt_tokens,
    usage.completion_tokens
  );

  console.log("Token usage:", usage);
  console.log("Cost breakdown (USD):", {
    input: cost.inputCost.toFixed(8),
    output: cost.outputCost.toFixed(8),
    total: cost.totalCost.toFixed(8),
  });

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
