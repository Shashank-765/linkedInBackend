import cron from "node-cron";

/**
 * Test scheduler – runs every 5 seconds
 */
export function scheduleEveryFiveSeconds(job) {
  const task = cron.schedule(
    "*/2 * * * *", // every 2 minutes
    async () => {
      await job();
    },
    { timezone: "Asia/Kolkata", scheduled: true }
  );
  return task;
}
