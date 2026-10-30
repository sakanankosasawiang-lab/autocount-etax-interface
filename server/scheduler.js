const { loadDB } = require('./database');
const { processInbound, ensureCompanyFolders } = require('./processor');

let timer = null;
let currentIntervalMinutes = 10;
let lastRunTime = null;
let nextRunTime = null;

function calculateNextRun(mins) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

function startScheduler() {
  ensureCompanyFolders();
  if (process.env.VERCEL) {
    console.log('[Scheduler] Running on Vercel Serverless: Background intervals disabled.');
    return;
  }
  const db = loadDB();
  const setting = db.setup.find(s => s.name === 'API_TIME_TO_SEND');
  currentIntervalMinutes = setting ? parseInt(setting.value, 10) || 10 : 10;

  if (timer) clearInterval(timer);

  console.log(`[Scheduler] Auto sweep timer active: every ${currentIntervalMinutes} minutes.`);
  nextRunTime = calculateNextRun(currentIntervalMinutes);

  timer = setInterval(() => {
    console.log(`[Scheduler] Sweeping inbound folders (Interval: ${currentIntervalMinutes} mins)...`);
    lastRunTime = new Date();
    processInbound();
    nextRunTime = calculateNextRun(currentIntervalMinutes);
  }, currentIntervalMinutes * 60 * 1000);
}

function updateSchedulerInterval(newMinutes) {
  currentIntervalMinutes = parseInt(newMinutes, 10) || 10;
  startScheduler();
}

function getSchedulerStatus() {
  return {
    intervalMinutes: currentIntervalMinutes,
    lastRunTime,
    nextRunTime
  };
}

module.exports = {
  startScheduler,
  updateSchedulerInterval,
  getSchedulerStatus
};
