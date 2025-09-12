import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";

// 🔑 ENV Variables
const OPENAI_API_KEY = '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';
const LINKEDIN_ACCESS_TOKEN = 'AQXvOScVaXT2RhCBJSsqOFbRyPZgBKL7fMxLv-PoXN0QyrLabwSOzFZyZwi7TPnauXRro-SJ_qfz2-Y1DsnK5_xt3Prgx7HpE-yByAK2pVDuWHom2np3RMw0bVLYoVghPgrau51BEYyHO6v8cMMe4ADKgqBc9Bg-0uVqnpRNMKhenNX5A2OXx05zKXaHPaAyMCb7Zm2WzIJwCViRFyjKRSsCP0409QPYnC3o3xYBqOTH4oQXc8Sa1VQh0EGzJYC7nQB9rLp8dsoPQVC3xDdLyIGjz_LY586DQrQAdXdFzgVrFFqv3TCF_xU2AUdNK1MacZlTP7rMyepEBXbRYsDHJeDK1lA3JA'
const ORG_URN = "urn:li:organization:108456956"; // Replace with your org

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Step 1: Generate LinkedIn-style post content
async function generatePostContent(topic) {
  const prompt = `Create a LinkedIn carousel style post about: "${topic}".
Format with emojis, bullets, and hashtags. Keep it engaging, professional, and under 250 words.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}

// Step 2: Generate N images with OpenAI
async function generateImages(topic, n = 2) {
  let imagePaths = [];

  for (let i = 0; i < n; i++) {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt: `A professional LinkedIn-style illustration about: ${topic}. Slide ${i + 1}`,
      size: "1024x1024",
    });

    const url = response.data[0].url;
    const filePath = path.resolve(`./image_${i + 1}.png`);

    // Download and save locally
    const imgRes = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, imgRes.data);

    imagePaths.push(filePath);
  }

  return imagePaths;
}

// Step 3: Upload image to LinkedIn
async function uploadImageToLinkedIn(filePath) {
  const initRes = await axios.post(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    { initializeUploadRequest: { owner: ORG_URN } },
    {
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        "LinkedIn-Version": "202401",
        "Content-Type": "application/json",
      },
    }
  );

  const uploadUrl = initRes.data.value.uploadUrl;
  const assetUrn = initRes.data.value.image;

  const imgData = fs.readFileSync(filePath);
  await axios.put(uploadUrl, imgData, {
    headers: { "Content-Type": "image/png" },
  });

  return assetUrn; // e.g. urn:li:image:XXXX
}

// Step 4: Create LinkedIn post
async function createLinkedInPost(topic) {
  try {
    console.log("📝 Generating post content...");
    const commentary = await generatePostContent(topic);

    // console.log("🎨 Generating images...");
    // const imagePaths = await generateImages(topic, 2); // Generate 2 images

    // console.log("⬆️ Uploading images to LinkedIn...");
    // const imageUrns = [];
    // for (const filePath of imagePaths) {
    //   const urn = await uploadImageToLinkedIn(filePath);
    //   imageUrns.push({ id: urn });
    // }

    const postData = {
      author: ORG_URN,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        multiImage: {
         "images": [
        { "id": "urn:li:image:D5610AQF1CA-VBcnfYg" },
        { "id": "urn:li:image:D5610AQHJIADSGY_5YA" }
      ]
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    console.log("🚀 Creating LinkedIn post...");
    const postResponse = await axios.post(
      "https://api.linkedin.com/rest/posts",
      postData,
      {
        headers: {
          Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
          "LinkedIn-Version": "202508",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Post successfully published:", postResponse.data);
  } catch (error) {
    console.error("❌ Error posting to LinkedIn:", error || error);
  }
}

// Run with a topic
const topic = "Etherium Blockhain "; // 👈 Change your topic here
createLinkedInPost(topic);
