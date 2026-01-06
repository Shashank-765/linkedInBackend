import express from "express";
import Post from "../models/Post.js";
import { generatePostContent, generateImages } from "../content.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "../linkedin.js";
import axios from "axios";
import dotenv from "dotenv";

import AutoPost from "../models/AutoPost.js";
import { upload } from "../middleware/upload.js";


dotenv.config();
import { startAutoPosting,
  stopAutoPosting,
  getSchedulerStatus,
  updateAutoPostSchedule } from "../scheduler/autoPostScheduler.js";

const router = express.Router();

/**
 * Generate draft post
 */
router.post("/generate", upload.single("image"), async (req, res) => {
  const { topic, autoApprove, image: imageUrl } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    let imagePath = null;

    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else if (imageUrl) {
      imagePath = imageUrl;
    }

    

    const content = await generatePostContent(topic);

    const auto = autoApprove === true || autoApprove === "true";

    const post = await Post.create({
      topic,
      content,
      images: imagePath ? [imagePath] : [],
      autoApprove: auto,
      status: auto ? "approved" : "pending",
    });

    res.json(post);
  } catch (err) {
    console.error("❌ Error generating post:", err);
    res.status(500).json({
      error: "Failed to generate post",
      details: err.message,
    });
  }
});




router.post("/start", async (req, res) => {
  try {
    await startAutoPosting();
    res.json({ success: true, message: "Auto-posting started" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/stop", async (req, res) => {
  try {
    await stopAutoPosting();
    res.json({ success: true, message: "Auto-posting stopped" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/status", async (req, res) => {
  const status = await getSchedulerStatus(

  );
  res.json({ success: true, data: status });
});

router.post("/update", async (req, res) => {
  const { intervalMinutes, cron } = req.body;
  const result = await updateAutoPostSchedule(intervalMinutes, cron);
  res.json(result);
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
    console.log('BASE_URL', process.env.BASE_URL)
    const newsApiUrl = `${process.env.BASE_URL}/news`;

    const newsResponse = await axios.get(newsApiUrl, {
      params: {
        country,
        category: industry,
        limit// fetch more for better trends
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



router.post("/generatePost", async (req, res) => {
  const { topic, autoApprove = false, image } = req.body;

  try {
    console.log('Generating post for topic:', topic, 'with autoApprove:', autoApprove, image);
    const content = await generatePostContent(topic);

    let post = await Post.create({
      topic,
      content,
      images: image ? [image] : ["https://images.icc-cricket.com/image/private/s--ceTYWUWH--/v1765887122/prd/assets/app-nav-dropdown/u19-cwc-2026-events-dropdown.png"],
      autoApprove: !!autoApprove,
      status: autoApprove ? "approved" : "pending",
      attempts: 0,
    });

    let claimed = null;

    // 🚀 Auto-posting flow
    if (autoApprove) {
      claimed = await Post.findOneAndUpdate(
        { _id: post._id, status: "approved" },
        { $set: { status: "scheduled", scheduledAt: new Date(), attempts: 1 } },
        { new: true }
      );

      // If you want to actually post to LinkedIn later:
      /*
      if (claimed) {
        const imageUrns = [];
        for (const imgPath of claimed.images) {
          const urn = await uploadImageToLinkedIn(imgPath);
          imageUrns.push(urn);
        }

        await createLinkedInPost(claimed.content, imageUrns);

        claimed = await Post.findByIdAndUpdate(
          claimed._id,
          { status: "posted", postedAt: new Date() },
          { new: true }
        );
      }
      */
    }

    res.json({
      success: true,
      post: claimed || post,
    });

  } catch (err) {
    console.error("❌ Error generating post:", err);
    res.status(500).json({ success: false, error: "Failed to generate content" });
  }
});




export default router;



