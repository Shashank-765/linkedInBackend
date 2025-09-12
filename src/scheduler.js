import cron from "node-cron";

/**
 * Test scheduler – runs every 5 seconds
 */
export function scheduleEveryFiveSeconds(job) {
  const task = cron.schedule(
    "*/20 * * * * *", // every 5 sec
    async () => {
      await job();
    },
    { timezone: "Asia/Kolkata", scheduled: true }
  );
  return task;
}
