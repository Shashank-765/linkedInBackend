import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  content: { type: String, required: true },
  images: { type: [String], default: [] },
  status: {
    type: String,
    enum: ["pending", "approved", "scheduled", "posting", "posted", "failed"],
    default: "pending",
  },
  scheduledAt: { type: Date },
  autoApprove: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now },

  // result fields
  postedAt: { type: Date },
  linkedinPostUrl: { type: String },
});

export default mongoose.model("Post", PostSchema);
