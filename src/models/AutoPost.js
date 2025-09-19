// models/AutoPost.js
import mongoose from "mongoose";

const autoPostSchema = new mongoose.Schema({
  topic: { type: String },
  status: { type: String, enum: ["active", "stopped"], default: "active" },
  startDate: { type: Date, default: Date.now },
  nextPostAt: { type: Date, default: () => new Date() },
  interval: { type: Number, default: 24 * 60 * 60 * 1000 }, // 1 day
  lastPostedAt: { type: Date },
  linkedInPosts: [
    { url: { type: String }, postedAt: { type: Date } },
  ],
});

const AutoPost = mongoose.model("AutoPost", autoPostSchema);

export default AutoPost;
