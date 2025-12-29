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
  const { topic, autoApprove, image } = req.body;
  try {
    const content = await generatePostContent(topic);
    // if(!image){
    // image = await generateImages(topic, 1);
    // }
    console.log('req.body', req.body)

    let post = await Post.create({
      topic,
      content,
      images: image ? [image] : [],
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
 * Google News based trending topics by industry
 */
router.get("/trending-topics", async (req, res) => {
  try {
    console.log('hello',  req.query)
    const {
      industry = "technology",
      country = "IN",
      page = 1,
      limit = 5
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // 🔗 Your existing Google News API
    const newsApiUrl = `http://localhost:5003/api/news`;

    const newsResponse = await axios.get(newsApiUrl, {
      params: {
        country,
        category: industry,
        limit: 5 // fetch more for better trends
      }
    });
  // console.log('newsResponse.data', newsResponse.data)
    const articles = newsResponse.data.articles || [];

    /**
     * Convert articles → trending topics
     * Logic:
     * - Use title as topic
     * - Rank decides popularity
     * - Count similar sources
     */
    const topics = articles.map((article, index) => ({
      topic: article.title,
      tweets:  article.rank, // simulated popularity
      description: article.description
        ? article.description.replace(/<[^>]*>/g, "").slice(0, 120)
        : "Trending technology news",
      source: article.source,
      publishedAt: article.published,
      link: article.link,
      image: article.thumbnail
    }));

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTopics = topics.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      industry,
      country,
      page: pageNum,
      limit: limitNum,
      totalTopics: topics.length,
      topics: paginatedTopics
    });

  } catch (error) {
    console.error("Trending topics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trending topics from Google News"
    });
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



