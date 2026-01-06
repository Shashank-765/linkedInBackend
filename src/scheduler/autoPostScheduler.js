// controllers/autoPostController.js
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

import Post from "../models/Post.js";
import AutoPost from "../models/AutoPost.js";
import { generatePostContent } from "../content.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "../linkedin.js";

dotenv.config();

let cronJob = null;

/* ============================
   INDUSTRIES
============================ */
const INDUSTRIES = [
  "top",
  "world",
  "local",
  "business",
  "technology",
  "entertainment",
  "sports",
  "science",
  "health"
];

const getRandomIndustry = () =>
  INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];

/* ============================
   GOOGLE NEWS FETCHER
============================ */
const getRandomGoogleNewsTopic = async ({ country = "IN", limit = 10 } = {}) => {
  try {
    const newsApiUrl = `${process.env.BASE_URL}/news`;

    const { data } = await axios.get(newsApiUrl, {
      params: {
        country,
        category: getRandomIndustry(),
        limit
      }
    });

    const articles = data.articles || [];
    const validArticles = articles.filter(a => a.title && a.thumbnail && a.link);

    if (!validArticles.length) return null;

    const article = validArticles[Math.floor(Math.random() * validArticles.length)];

    return {
      topic: article.title,
      description: article.description ? article.description.replace(/<[^>]*>/g, "").slice(0, 200) : "",
      industry: getRandomIndustry(),
      link: article.link,
      thumbnail: article.thumbnail,
      source: article.source,
      publishedAt: article.published
    };

  } catch (err) {
    console.error("❌ Google News fetch error:", err.message);
    return null;
  }
};

/* ============================
   START AUTO POSTING
============================ */
export const startAutoPosting = async () => {
  let scheduler = await AutoPost.findOne();
  if (!scheduler) {
    scheduler = await AutoPost.create({ status: "active" });
  } else {
    scheduler.status = "active";
    await scheduler.save();
  }

  if (cronJob) return;

  const cronExpression = scheduler.cron || "*/1440 * * * *"; // default once a day

  cronJob = cron.schedule(cronExpression, async () => {
    let postToSend = null;

    try {
      const now = new Date();
      const scheduler = await AutoPost.findOne();
      if (!scheduler || scheduler.status !== "active") return;

      // Check for scheduled posts
      postToSend = await Post.findOne({
        status: "scheduled",
        scheduledAt: { $lte: now }
      });

      // Auto-generate post if none scheduled
      if (!postToSend) {
        const news = await getRandomGoogleNewsTopic();
        if (!news) return;

        const enrichedTopic = `
          ${news.topic}
          Industry: ${news.industry}
          Summary: ${news.description}
          Source: ${news.link}
        `.trim();

        const content = await generatePostContent(enrichedTopic);

        postToSend = await Post.create({
          topic: news.topic,
          content,
          images: news.thumbnail ? [news.thumbnail] : [],
          industry: news.industry,
          sourceUrl: news.link,
          status: "posting"
        });
      } else {
        postToSend.status = "posting";
        await postToSend.save();
      }

      console.log("📤 Posting:", postToSend.topic);

      // Upload images to LinkedIn
      let uploadedImages = [];
      if (Array.isArray(postToSend.images) && postToSend.images.length) {
        uploadedImages = await Promise.all(
          postToSend.images.filter(Boolean).map(uploadImageToLinkedIn)
        );
      }

      // Create LinkedIn post
      const linkedInUrl = await createLinkedInPost(postToSend.content, uploadedImages);

      // Update post
      postToSend.status = "posted";
      postToSend.postedAt = now;
      postToSend.scheduledAt = now;
      postToSend.linkedinPostUrl = linkedInUrl;
      await postToSend.save();

      // Update scheduler
      scheduler.lastPostedAt = now;
      scheduler.nextPostAt = new Date(now.getTime() + scheduler.interval);
      scheduler.linkedInPosts.push({ url: linkedInUrl, postedAt: now });
      await scheduler.save();

      console.log(`✅ Posted successfully: ${linkedInUrl}`);

    } catch (err) {
      console.error("❌ Auto-post error:", err);

      if (postToSend) {
        postToSend.attempts += 1;
        postToSend.lastError = err.message;
        postToSend.status = "failed";
        await postToSend.save();
      }
    }
  });

  cronJob.start();
  console.log(`🚀 Auto-post scheduler started with cron: ${cronExpression}`);
};

/* ============================
   STOP AUTO POSTING
============================ */
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

/* ============================
   UPDATE SCHEDULE (FROM FRONTEND)
============================ */
export const updateAutoPostSchedule = async (intervalMinutes, cron) => {
  try {

    let scheduler = await AutoPost.findOne();
    if (!scheduler) scheduler = new AutoPost();

    if (intervalMinutes) {
      scheduler.intervalMinutes = intervalMinutes;
      scheduler.interval = intervalMinutes * 60 * 1000;
      scheduler.cron = `*/${intervalMinutes} * * * *`;
    }

    if (cron) scheduler.cron = cron;

    await scheduler.save();

    // restart cron job
    if (cronJob) {
      cronJob.stop();
      cronJob = null;
    }

    await startAutoPosting();

    return { success: true, cron: scheduler.cron, intervalMinutes: scheduler.intervalMinutes };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/* ============================
   GET SCHEDULER STATUS
============================ */
export const getSchedulerStatus = async () => {
  const scheduler = await AutoPost.findOne();
  if (!scheduler) return ({ status: "stopped", linkedInPosts: [] });

  return({
    status: scheduler.status,
    cron: scheduler.cron,
    intervalMinutes: scheduler.intervalMinutes,
    lastPostedAt: scheduler.lastPostedAt,
    nextPostAt: scheduler.nextPostAt,
    running: scheduler.status === "active"? true : false,
    
    linkedInPosts: scheduler.linkedInPosts || []
  });
};
