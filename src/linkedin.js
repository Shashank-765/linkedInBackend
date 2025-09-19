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

  const imgData = fs.readFileSync(`./uploads/${filePath}`);
  await axios.put(uploadUrl, imgData, {
    headers: { "Content-Type": "image/png" },
  });

  return assetUrn;
}

/**
 * Create LinkedIn post with text + images
 */
export async function createLinkedInPost(commentary, imageUrns) {
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
      multiImage: { images: imageUrns.map((id) => ({ id })) },
    },
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
}
