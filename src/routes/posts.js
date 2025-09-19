import express from "express";
import Post from "../models/Post.js";
import { generatePostContent, generateImages } from "../content.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "../linkedin.js";
import axios from "axios";
import dotenv from "dotenv";
import AutoPost from "../models/AutoPost.js";

dotenv.config();
import { startAutoPosting, stopAutoPosting } from "../scheduler/autoPostScheduler.js";

const router = express.Router();

/**
 * Generate draft post
 */
router.post("/generate", async (req, res) => {
  const { topic, autoApprove } = req.body;
  try {
    const content = await generatePostContent(topic);
    const images = await generateImages(topic, 2);

    let post = await Post.create({
      topic,
      content,
      images,
      autoApprove: !!autoApprove,
      status: autoApprove ? "approved" : "pending",
    });

//     // 🚀 If autoApprove = true → post instantly
//     if (autoApprove) {
//          const claimed = await Post.findOneAndUpdate(
//     { _id: post._id, status: post.status }, // status likely "approved" or "pending"
//     { $set: { status: "posting", postedAt: new Date(), attempts: 1 } },
//     { new: true }
//   );

//     if (claimed) {
//       const imageUrns = [];
//       for (const imgPath of images) {
//         const urn = await uploadImageToLinkedIn(imgPath);
//         imageUrns.push(urn);
//       }
//       await createLinkedInPost(content, imageUrns);
//       post = await Post.findByIdAndUpdate(post._id, { status: "posted", postedAt: new Date() }, { new: true });
//     }
// }

    res.json(post);
  } catch (err) {
    console.error("❌ Error generating post:", err);
    res.status(500).json({ error: "Failed to generate content" });
  }
});



/**
 * @route   POST /auto-post/start
 * @desc    Start auto-posting scheduler
 */
router.post("/start", async (req, res) => {
  try {
    startAutoPosting();
    res.json({ success: true, message: "Auto-posting started" });
  } catch (err) {
    console.error("Error starting auto-posting:", err);
    res.status(500).json({ success: false, error: "Failed to start auto-posting" });
  }
});

/**
 * @route   POST /auto-post/stop
 * @desc    Stop auto-posting scheduler
 */
router.post("/stop", async (req, res) => {
  try {
    stopAutoPosting();
    res.json({ success: true, message: "Auto-posting stopped" });
  } catch (err) {
    console.error("Error stopping auto-posting:", err);
    res.status(500).json({ success: false, error: "Failed to stop auto-posting" });
  }
});


router.get("/status", async (req, res) => {
  try {
    const scheduler = await AutoPost.findOne();
    if (!scheduler) {
      return res.json({ running: false });
    }
    res.json({
      running: scheduler.status === "active",
      lastPostedAt: scheduler.lastPostedAt,
      nextPostAt: scheduler.nextPostAt,
      linkedInPosts: scheduler.linkedInPosts
    });
  } catch (err) {
    console.error("Error fetching auto-post status:", err);
    res.status(500).json({ error: "Failed to fetch auto-post status" });
  }
});




/**
 * Approve manually
 */
router.post("/approve/:id", async (req, res) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { status: "approved" },
    { new: true }
  );
  res.json(post);
});

/**
 * Schedule post
 */
router.post("/schedule/:id", async (req, res) => {
  const { scheduledAt, autoApprove } = req.body;
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { status: "scheduled", scheduledAt, autoApprove },
    { new: true }
  );
  res.json(post);
});

/**
 * List all posts
 */
router.get("/", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});


/**
 * View all posts
 */
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

/**
 * GET /trending-topics
 * Fetch trending Twitter topics from ChatGPT and return clean JSON
 */
router.get("/trending-topics", async (req, res) => {
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

    res.json({ topics });

  } catch (err) {
    console.error("Error fetching trending topics:", err);
    res.status(500).json({ error: "Failed to fetch trending topics" });
  }
});




router.post("/bulk-schedule", async (req, res) => {
  try {
    const { ids, startTime, perDay, manualDate } = req.body;  
    // manualDate is optional (like "2025-09-15")

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No posts selected" });
    }

    const updates = [];

    // If manualDate provided → schedule all on that date
    if (manualDate) {
      ids.forEach((id) => {
        const scheduledAt = new Date(manualDate);
        const [hours, minutes] = startTime.split(":");
        scheduledAt.setHours(hours);
        scheduledAt.setMinutes(minutes);

        updates.push(
          Post.findByIdAndUpdate(
            id,
            { status: "scheduled", scheduledAt },
            { new: true }
          )
        );
      });
    } else {
      // Auto scheduling → start from tomorrow
      let currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + 1); // ✅ start from tomorrow

      ids.forEach((id, index) => {
        const dayOffset = Math.floor(index / perDay); 
        const scheduledAt = new Date(currentDate);
        scheduledAt.setDate(scheduledAt.getDate() + dayOffset);

        const [hours, minutes] = startTime.split(":");
        scheduledAt.setHours(hours);
        scheduledAt.setMinutes(minutes);

        updates.push(
          Post.findByIdAndUpdate(
            id,
            { status: "scheduled", scheduledAt },
            { new: true }
          )
        );
      });
    }

    const results = await Promise.all(updates);
    res.json({ success: true, results });
  } catch (err) {
    console.error("Bulk scheduling error:", err);
    res.status(500).json({ error: "Failed to schedule posts" });
  }
});




export default router;



