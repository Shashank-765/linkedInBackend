import axios from "axios";
import fs from "fs";

import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORG_URN = process.env.LINKEDIN_AUTHOR_URN;

/**
 * Upload one image to LinkedIn
 */
export async function uploadImageToLinkedIn(filePath) {
  const initRes = await axios.post(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    { initializeUploadRequest: { owner: ORG_URN } },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "LinkedIn-Version": "202508",
        "Content-Type": "application/json",
      },
    }
  );

  const uploadUrl = initRes.data.value.uploadUrl;
  const assetUrn = initRes.data.value.image;

 const res = await axios.get(filePath, { responseType: "arraybuffer" });
await axios.put(uploadUrl, res.data, {
  headers: { "Content-Type": "image/png" },
});

  return assetUrn;
}

/**
 * Create LinkedIn post with text + images
 */
export async function createLinkedInPost(commentary, imageUrns) {
  try {

    // 🔒 1️⃣ Sanitize LinkedIn-breaking characters
    const sanitizeLinkedInText = (text) => {
      return text
        // Convert (AMCs) → - AMCs
        .replace(/\(([^)]+)\)/g, " - $1")
        // Remove leftover brackets just in case
        .replace(/[()]/g, "")
        // Normalize excessive newlines
        .replace(/\n{3,}/g, "\n\n")
        // Trim whitespace
        .trim();
    };

    const safeCommentary = sanitizeLinkedInText(commentary);

    console.log("📝 Final LinkedIn Commentary:\n", safeCommentary);

    const postData = {
      author: ORG_URN,
      commentary: safeCommentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: imageUrns?.length
        ? {
          
            media: {
              id: imageUrns[0],
            },
          }
        : undefined,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    const postResponse = await axios.post(
      "https://api.linkedin.com/rest/posts",
      postData,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "LinkedIn-Version": "202508",
          "Content-Type": "application/json",
        },
      }
    );

    return postResponse.data;

  } catch (error) {
    console.error(
      "❌ LinkedIn post creation error:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }

}
