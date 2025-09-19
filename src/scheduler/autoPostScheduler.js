import cron from "node-cron";
import Post from "../models/Post.js";
import AutoPost from "../models/AutoPost.js";
import { generatePostContent, generateImages } from "../content.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "../linkedin.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

let cronJob = null;

export const startAutoPosting = async () => {
  let scheduler = await AutoPost.findOne();
  if (!scheduler) {
    scheduler = await AutoPost.create({ status: "active" });
  } else {
    scheduler.status = "active";
    await scheduler.save();
  }

  if (cronJob) return; // avoid duplicate jobs

  cronJob = cron.schedule("0 10 * * *", async () => { // every day at 10 AM
    let postToSend = null;
    try {
      const now = new Date();

      // reload scheduler state
      const scheduler = await AutoPost.findOne();
      if (!scheduler || scheduler.status !== "active") return;

      // 🔹 Step 1: Check for scheduled posts
      postToSend = await Post.findOne({
        status: "scheduled",
        scheduledAt: { $lte: now },
      });

      if (!postToSend) {
        // 🔹 Step 2: No scheduled → auto-generate
        // const topic = "Latest trending topic"; // replace with real source if needed
        const topicsList = await topics();
        // console.log('topicsList', topicsList)
       let topic =  topicsList[0].description || "Latest trending topic";
        const content = await generatePostContent(topic);
        const images = await generateImages(topic);

        postToSend = await Post.create({
          topic,
          content,
          images,
          status: "posting",
        });
        console.log('postToSend', postToSend)
      } else {
        postToSend.status = "posting";
        await postToSend.save();
      }

      // 🔹 Step 3: Upload images
      let uploadedImages = [];
      if (postToSend.images && postToSend.images.length > 0) {
        uploadedImages = await Promise.all(
          postToSend.images.map((imgPath) => uploadImageToLinkedIn(imgPath))
        );
      }

      // 🔹 Step 4: Create LinkedIn post
      const linkedInUrl = await createLinkedInPost(
        postToSend.content,
        uploadedImages
      );

      // 🔹 Step 5: Update Post
      postToSend.status = "posted";
      postToSend.postedAt = now;
      postToSend.linkedinPostUrl = linkedInUrl;
      await postToSend.save();

      // 🔹 Step 6: Update Scheduler
      scheduler.lastPostedAt = now;
      scheduler.nextPostAt = new Date(now.getTime() + scheduler.interval);
      scheduler.linkedInPosts.push({ url: linkedInUrl, postedAt: now });
      await scheduler.save();

      console.log(`✅ Posted successfully: ${linkedInUrl}`);
    } catch (err) {
      console.error("❌ Auto-post error:", err);

      // If a post exists in this cycle, mark it failed
      if (postToSend) {
        postToSend.attempts += 1;
        postToSend.lastError = err.message;
        postToSend.status = "failed";
        await postToSend.save();
      }
    }
  });

  cronJob.start();
  console.log("🚀 Auto-post scheduler started");
};

export const stopAutoPosting = async () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  const scheduler = await AutoPost.findOne();
  if (scheduler) {
    scheduler.status = "stopped";
    await scheduler.save();
  }

  console.log("⏹️ Auto-post scheduler stopped");
};

export const getSchedulerStatus = async () => {
  const scheduler = await AutoPost.findOne();
  if (!scheduler) return { status: "stopped", linkedInPosts: [] };

  return {
    status: scheduler.status,
    lastPostedAt: scheduler.lastPostedAt,
    nextPostAt: scheduler.nextPostAt,
    linkedInPosts: scheduler.linkedInPosts || [],
  };
};


const topics = async() => {
      try {
    // GPT prompt to generate trending topics
    const prompt = `
You are an AI assistant that outputs ONLY valid JSON, no explanations, no markdown, no code blocks.

Generate 5 latest trending topics on Twitter TODAY. 
Output must be a JSON array in this exact format:

[
  {
    "topic": "string",
    "tweets": number,
    "description": "string"
  }
]

Ensure that:
- "topic" is the trending keyword or hashtag
- "tweets" is an approximate number of tweets
- "description" is a short summary of the topic
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an AI assistant that outputs valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const text = response.data.choices[0].message.content.trim();
console.log('response.data.choices[0]', response.data.choices[0])
    let topics;
    try {
      topics = JSON.parse(text);
    } catch (err) {
      console.error("Invalid JSON from GPT:", text);
      return res.status(500).json({ error: "Invalid JSON received from GPT" });
    }
    return topics;

  } catch (err) {
    console.error("Error fetching trending topics:", err);
    return { error: "Failed to fetch trending topics" };
  }
  
}
