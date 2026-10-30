const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {
  fetchLatestBOTRates,
  getStagingRates,
  generateAutoCountTSQL,
  syncDirectSQL,
  syncAutoCountAPI,
  getDefaultConfig
} = require('./botExchangeRateService');
const { loadDB, saveDB } = require('./database');

// 1. Get Staged Rates & Stats
router.get('/bot-rates', (req, res) => {
  try {
    const data = getStagingRates();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Fetch Latest Rates from Bank of Thailand (BOT API)
router.post('/bot-rates/fetch', async (req, res) => {
  try {
    const { date } = req.body || {};
    const result = await fetchLatestBOTRates(date);
    res.json({
      success: true,
      message: `ดึงข้อมูลอัตราแลกเปลี่ยนจากธนาคารแห่งประเทศไทย (BOT API) สำเร็จ จำนวน ${result.total} สกุลเงิน`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก ธปท.: ' + err.message });
  }
});

// 3. Sync to AutoCount: Method 1 - Direct SQL Insertion
router.post('/bot-rates/sync/sql', async (req, res) => {
  try {
    const { rates, config } = req.body || {};
    const result = await syncDirectSQL(rates, config);
    res.json({
      success: true,
      message: result.log.message,
      currencies_synced: result.currencies_synced,
      affected_rows: result.affected_rows,
      duration_ms: result.duration_ms,
      log: result.log
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 4. Sync to AutoCount: Method 2 - API / Webhook Dispatch
router.post('/bot-rates/sync/api', async (req, res) => {
  try {
    const { rates, config } = req.body || {};
    const result = await syncAutoCountAPI(rates, config);
    res.json({
      success: true,
      message: result.log.message,
      currencies_synced: result.currencies_synced,
      batch_id: result.batch_id,
      duration_ms: result.duration_ms,
      log: result.log
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5. Generate / Download T-SQL Script for AutoCount Database
router.get('/bot-rates/sql-script', (req, res) => {
  try {
    const db = loadDB();
    const rates = db.bot_exchange_rates || [];
    if (rates.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลอัตราแลกเปลี่ยน กรุณากดดึงข้อมูลก่อน' });
    }
    const config = db.exchange_rate_config || getDefaultConfig();
    const sql = generateAutoCountTSQL(rates, config);

    if (req.query.download === '1') {
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', 'attachment; filename="AutoCount_BOT_Exchange_Rates.sql"');
      return res.send(sql);
    }

    res.json({ success: true, sql_script: sql });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Simulated AutoCount Inbound API Endpoint (for testing webhook / plugin reception)
router.post('/autocount/exchange-rates', (req, res) => {
  const { developer_id, currencies, rate_date } = req.body || {};
  if (!currencies || !Array.isArray(currencies)) {
    return res.status(400).json({ success: false, message: 'Invalid payload: currencies array is required' });
  }

  const batchId = `AC-BATCH-${Date.now().toString().slice(-6)}`;
  return res.json({
    success: true,
    code: 'AUTOCONT_API_SUCCESS',
    batch_id: batchId,
    received_count: currencies.length,
    rate_date: rate_date || new Date().toISOString().slice(0, 10),
    developer_id: developer_id || 'Piyarathl@gmail.com',
    message: `AutoCount API successfully committed ${currencies.length} foreign currency exchange rates into database.`
  });
});

// 7. Download Plugin Package (DLL or ZIP)
router.get('/bot-rates/download-plugin', (req, res) => {
  const format = req.query.format || 'zip';
  let filePath = '';
  let fileName = '';

  if (format === 'dll') {
    filePath = path.join(__dirname, '..', 'public', 'downloads', 'AutoCount.Plugin.BOTExchangeRate.dll');
    fileName = 'AutoCount.Plugin.BOTExchangeRate.dll';
  } else {
    filePath = path.join(__dirname, '..', 'public', 'downloads', 'AutoCount_BOT_Exchange_Rate_Plugin.zip');
    fileName = 'AutoCount_BOT_Exchange_Rate_Plugin.zip';
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Plugin file not found on server' });
  }

  res.download(filePath, fileName);
});

// 8. Update Configuration
router.post('/bot-rates/config', (req, res) => {
  try {
    const db = loadDB();
    db.exchange_rate_config = {
      ...(db.exchange_rate_config || getDefaultConfig()),
      ...req.body
    };
    saveDB(db);
    res.json({ success: true, config: db.exchange_rate_config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
