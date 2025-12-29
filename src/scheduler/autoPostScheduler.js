import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

import Post from "../models/Post.js";
import AutoPost from "../models/AutoPost.js";

import { generatePostContent, generateImages } from "../content.js";
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
   GOOGLE NEWS (INTERNAL USE)
============================ */
const getRandomGoogleNewsTopic = async ({
  country = "IN",
  limit = 50
} = {}) => {
  try {
    const industry = getRandomIndustry();

    const newsApiUrl =
      "https://1b8h8nts-5000.inc1.devtunnels.ms/api/news";

    const newsResponse = await axios.get(newsApiUrl, {
      params: {
        country,
        category: industry,
        limit
      }
    });

    const articles = newsResponse.data?.articles || [];
    if (!articles.length) return null;

    const topics = articles.map(article => ({
      topic: article.title,
      description: article.description
        ? article.description.replace(/<[^>]*>/g, "").slice(0, 120)
        : "Trending news",
      source: article.source,
      publishedAt: article.published,
      link: article.link
    }));

    const selected =
      topics[Math.floor(Math.random() * topics.length)];

    return {
      industry,
      ...selected
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

  // ⏱ every 2 minutes (testing)
  cronJob = cron.schedule("*/2 * * * *", async () => {
    let postToSend = null;

    try {
      const now = new Date();

      const scheduler = await AutoPost.findOne();
      if (!scheduler || scheduler.status !== "active") return;

      // 🔹 Check scheduled posts
      postToSend = await Post.findOne({
        status: "scheduled",
        scheduledAt: { $lte: now }
      });

      // 🔹 Auto-generate if none scheduled
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
        const images = await generateImages(news.topic);

        postToSend = await Post.create({
          topic: news.topic,
          content,
          images,
          industry: news.industry,
          sourceUrl: news.link,
          status: "posting"
        });
      } else {
        postToSend.status = "posting";
        await postToSend.save();
      }
      console.log('postToSend', postToSend);
      // 🔹 Upload images
      let uploadedImages = [];
      if (postToSend.images?.length) {
        uploadedImages = await Promise.all(
          postToSend.images.map(img =>
            uploadImageToLinkedIn(img)
          )
        );
      }

      // 🔹 Create LinkedIn post
      const linkedInUrl = await createLinkedInPost(
        postToSend.content,
        uploadedImages
      );

      // 🔹 Update post
      postToSend.status = "posted";
      postToSend.postedAt = now;
      postToSend.linkedinPostUrl = linkedInUrl;
      await postToSend.save();

      // 🔹 Update scheduler
      scheduler.lastPostedAt = now;
      scheduler.nextPostAt = new Date(
        now.getTime() + scheduler.interval
      );
      scheduler.linkedInPosts.push({
        url: linkedInUrl,
        postedAt: now
      });
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
  console.log("🚀 Auto-post scheduler started");
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
   GET STATUS
============================ */
export const getSchedulerStatus = async () => {
  const scheduler = await AutoPost.findOne();
  if (!scheduler)
    return { status: "stopped", linkedInPosts: [] };

  return {
    status: scheduler.status,
    lastPostedAt: scheduler.lastPostedAt,
    nextPostAt: scheduler.nextPostAt,
    linkedInPosts: scheduler.linkedInPosts || []
  };
};
