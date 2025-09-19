import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

import postsRouter from "./routes/posts.js";
import Post from "./models/Post.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "./linkedin.js";
import { scheduleEveryFiveSeconds } from "./scheduler.js";
import cors from "cors";


dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// 🔗 DB connect
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Routes
app.use("/posts", postsRouter);

// Scheduler – auto post
// run every 5s for testing
scheduleEveryFiveSeconds(async () => {
  const now = new Date();

  // find candidates (not claimed yet)
  const candidates = await Post.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  }).limit(20); // limit to reasonable batch size

  for (const candidate of candidates) {
    // Atomically claim the job: change status scheduled -> posting
    const claimed = await Post.findOneAndUpdate(
      { _id: candidate._id, status: "scheduled" },
      { $set: { status: "posting", postingAt: new Date(), attempts: (candidate.attempts || 0) + 1 } },
      { new: true }
    );

    // if claimed is null, someone else already claimed it — skip
    if (!claimed) continue;

    try {
      // Upload each image and collect URNs
      const imageUrns = [];
      for (const imgPath of claimed.images) {
        const urn = await uploadImageToLinkedIn(imgPath);
        imageUrns.push(urn);
      }

      // Create LinkedIn post
      const response = await createLinkedInPost(claimed.content, imageUrns);

      // Extract returned id (URN) from LinkedIn response (adjust as API returns)
      const linkedinId = response.id || response.urn || response.activity; // safe checks
      const linkedinUrl = linkedinId ? `https://www.linkedin.com/feed/update/${linkedinId}` : null;

      // Mark as posted
      await Post.findByIdAndUpdate(claimed._id, {
        $set: { status: "posted", postedAt: new Date(), linkedinPostUrl: linkedinUrl },
      });

      console.log("✅ Posted:", linkedinUrl || claimed._id);
    } catch (err) {
      console.error("❌ Posting error for", claimed._id, err);

      // Increment attempts handled earlier; decide retry or fail
      const maxAttempts = 3;
      const attempts = (claimed.attempts || 1);

      if (attempts >= maxAttempts) {
        // mark as failed
        await Post.findByIdAndUpdate(claimed._id, {
          $set: { status: "failed", lastError: err.message || String(err) },
        });
      } else {
        // re-schedule after short delay (e.g. 1 minute) for retry
        const retryDelayMs = 60 * 1000;
        await Post.findByIdAndUpdate(claimed._id, {
          $set: {
            status: "scheduled",
            scheduledAt: new Date(Date.now() + retryDelayMs),
            lastError: err.message || String(err),
            attempts,
          },
        });
      }
    }
  }
});



app.listen(3000, () => console.log("🚀 API running at http://localhost:3000"));



