import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";
import cors from "cors";

import postsRouter from "./routes/posts.js";
import Post from "./models/Post.js";
import { uploadImageToLinkedIn, createLinkedInPost } from "./linkedin.js";
import { scheduleEveryFiveSeconds } from "./scheduler.js";

const app = express();

// ------------------ LOGIN SETUP ------------------
const USERS = {
  Durgesh: { password: "1234", env: ".env_main" },
  Shashank: { password: "123", env: ".env" },
};



function loadEnv(file) {
  dotenv.config({ path: file, override: true });
  console.log(`🔁 Loaded env: ${file}`);
}


// default load
loadEnv(".env");

// ------------------ MIDDLEWARE ------------------

app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "hardcoded-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// ------------------ LOGIN ROUTES ------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = USERS[username];
  console.log('user', user)
  if (!user || user.password !== password) {
    return res.status(401).send("Invalid login");
  }

  req.session.user = username;
  req.session.envFile = user.env;

  loadEnv(user.env);

  // reconnect DB with new env
  await mongoose.disconnect();
  await mongoose.connect(process.env.MONGO_URI);
 

  console.log(`✅ ${username} logged in, DB reconnected`);
return res.send("Login successful");
  // res.redirect("/dashboard");
});


export function getLinkedInConfig() {
  return {
    TOKEN: process.env.LINKEDIN_ACCESS_TOKEN,
    ORG_URN: process.env.LINKEDIN_AUTHOR_URN,
  };
}


//return evn data for tesing which env used right now
app.get("/envdata", (req, res) => {
  res.json({
    linkedinAuthor: process.env.LINKEDIN_AUTHOR_URN || "not set",
    mongoUri: process.env.MONGO_URI || "not set",
    envFile: req.session?.envFile || "default",
    user: req.session?.user || "not logged in",
  });
});


// ------------------ DB CONNECT ------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ------------------ STATIC ------------------
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ------------------ ROUTES ------------------
app.use("/posts", postsRouter);

app.get("/", (req, res) => {
  res.send("Welcome to the LinkedIn Auto-Poster API");
});

// ------------------ SCHEDULER ------------------
scheduleEveryFiveSeconds(async () => {
  const now = new Date();

  const candidates = await Post.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  }).limit(20);
console.log('candidates', candidates)
  for (const candidate of candidates) {
    const claimed = await Post.findOneAndUpdate(
      { _id: candidate._id, status: "scheduled" },
      { $set: { status: "posting", postingAt: new Date(), attempts: (candidate.attempts || 0) + 1 } },
      { new: true }
    );

    if (!claimed) continue;

    try {
      const imageUrns = [];
      for (const imgPath of claimed.images) {
        imageUrns.push(await uploadImageToLinkedIn(imgPath));
      }

      const response = await createLinkedInPost(claimed.content, imageUrns);
      const linkedinId = response.id || response.urn || response.activity;
      const linkedinUrl = linkedinId ? `https://www.linkedin.com/feed/update/${linkedinId}` : null;

      await Post.findByIdAndUpdate(claimed._id, {
        $set: { status: "posted", postedAt: new Date(), linkedinPostUrl: linkedinUrl },
      });

      console.log("✅ Posted:", linkedinUrl || claimed._id);
    } catch (err) {
      console.error("❌ Posting error:", claimed._id, err);

      const attempts = claimed.attempts || 1;
      if (attempts >= 10) {
        await Post.findByIdAndUpdate(claimed._id, {
          $set: { status: "failed", lastError: err.message },
        });
      } else {
        await Post.findByIdAndUpdate(claimed._id, {
          $set: {
            status: "scheduled",
            scheduledAt: new Date(Date.now() + 60000),
            lastError: err.message,
            attempts,
          },
        });
      }
    }
  }
});

// ------------------ START ------------------
app.listen(3002, () => console.log("🚀 API running at http://localhost:3002"));
