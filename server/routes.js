const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { loadDB, saveDB, ensureDirSync } = require('./database');
const { processInbound, generateSampleInbound, ensureCompanyFolders, getMainDocFolder } = require('./processor');
const { updateSchedulerInterval, getSchedulerStatus } = require('./scheduler');
const pocRoutes = require('./pocRoutes');

// Mount AutoCount POC routes
router.use(pocRoutes);

// -------------------------------------------------------------
// AUTH
// -------------------------------------------------------------
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (Invalid Username or Password)' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email,
    image: user.image
  };

  return res.json({ success: true, user: safeUser });
});

// -------------------------------------------------------------
// HOME DASHBOARD
// -------------------------------------------------------------
router.get('/home/summary', (req, res) => {
  const db = loadDB();
  res.json({
    success: true,
    companies: db.companies,
    scheduler: getSchedulerStatus()
  });
});

router.post('/home/clear/:companyId', (req, res) => {
  const companyId = parseInt(req.params.companyId, 10);
  const db = loadDB();
  const comp = db.companies.find(c => c.id === companyId);
  if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });

  // Reset pending count and clear inbound
  const rootDir = getMainDocFolder(db);
  const inboundDir = path.join(rootDir, comp.folder, 'inbound');
  if (fs.existsSync(inboundDir)) {
    const files = fs.readdirSync(inboundDir);
    files.forEach(f => {
      try {
        fs.unlinkSync(path.join(inboundDir, f));
      } catch (e) {}
    });
  }
  comp.stats.pending = 0;
  saveDB(db);

  res.json({ success: true, message: `ล้างเอกสารค้างของ ${comp.name} สำเร็จ`, company: comp });
});

router.post('/process/send-now', (req, res) => {
  const { companyId } = req.body;
  const results = processInbound(companyId);
  res.json({
    success: true,
    message: 'นำส่งข้อมูลสำเร็จ',
    results
  });
});

// -------------------------------------------------------------
// SETUP
// -------------------------------------------------------------
router.get('/setup', (req, res) => {
  const db = loadDB();
  res.json({ success: true, setup: db.setup });
});

router.post('/setup', (req, res) => {
  const { name, descTH, descEN, value } = req.body;
  if (!name || value === undefined) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อตัวแปรและค่าตัวแปร' });
  }

  const db = loadDB();
  const existingIndex = db.setup.findIndex(s => s.name === name);

  if (existingIndex >= 0) {
    db.setup[existingIndex].value = value;
    if (descTH) db.setup[existingIndex].descTH = descTH;
    if (descEN) db.setup[existingIndex].descEN = descEN;
  } else {
    const newId = db.setup.length > 0 ? Math.max(...db.setup.map(s => s.id)) + 1 : 1;
    db.setup.push({
      id: newId,
      name,
      descTH: descTH || name,
      descEN: descEN || name,
      value
    });
  }

  saveDB(db);

  if (name === 'API_TIME_TO_SEND') {
    updateSchedulerInterval(value);
  }
  if (name === 'MAIN_DOCUMENT_FOLDER') {
    ensureCompanyFolders();
  }

  res.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อย', setup: db.setup });
});

// -------------------------------------------------------------
// COMPANIES
// -------------------------------------------------------------
router.get('/companies', (req, res) => {
  const db = loadDB();
  res.json({ success: true, companies: db.companies });
});

router.post('/companies', (req, res) => {
  const { name, folder, mode, taxId, branch, phone, authCode, apiKey } = req.body;
  if (!name || !folder || !taxId) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อบริษัท, โฟลเดอร์, เลขผู้เสียภาษี)' });
  }

  const db = loadDB();
  const newId = db.companies.length > 0 ? Math.max(...db.companies.map(c => c.id)) + 1 : 1;
  const newCompany = {
    id: newId,
    name,
    folder: folder.replace(/[^a-zA-Z0-9_\-]/g, '_'),
    mode: mode || 'ส่งไฟล์คู่ TXT และ PDF',
    taxId,
    branch: branch || '00000',
    phone: phone || '',
    authCode: authCode || '',
    apiKey: apiKey || '',
    stats: {
      month: 0,
      today: 0,
      success: 0,
      failed: 0,
      pending: 0
    }
  };

  db.companies.push(newCompany);
  saveDB(db);
  ensureCompanyFolders();

  res.json({ success: true, message: 'บันทึกข้อมูลบริษัทสำเร็จ', company: newCompany });
});

router.put('/companies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const comp = db.companies.find(c => c.id === id);
  if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });

  const { name, folder, mode, taxId, branch, phone, authCode, apiKey } = req.body;
  if (name) comp.name = name;
  if (folder) comp.folder = folder.replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (mode) comp.mode = mode;
  if (taxId) comp.taxId = taxId;
  if (branch) comp.branch = branch;
  if (phone) comp.phone = phone;
  if (authCode) comp.authCode = authCode;
  if (apiKey) comp.apiKey = apiKey;

  saveDB(db);
  ensureCompanyFolders();

  res.json({ success: true, message: 'แก้ไขข้อมูลบริษัทสำเร็จ', company: comp });
});

router.delete('/companies/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  db.companies = db.companies.filter(c => c.id !== id);
  saveDB(db);
  res.json({ success: true, message: 'ลบข้อมูลบริษัทสำเร็จ' });
});

// -------------------------------------------------------------
// USERS
// -------------------------------------------------------------
router.get('/users', (req, res) => {
  const db = loadDB();
  const safeUsers = db.users.map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    email: u.email,
    image: u.image
  }));
  res.json({ success: true, users: safeUsers });
});

router.post('/users', (req, res) => {
  const { name, username, password, role, email, image } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ, Username และ Password' });
  }

  const db = loadDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Username นี้ถูกใช้งานแล้ว' });
  }

  const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
  const newUser = {
    id: newId,
    name,
    username,
    password,
    role: role || 'User',
    email: email || '',
    image: image || '/assets/avatar-user.svg'
  };

  db.users.push(newUser);
  saveDB(db);

  res.json({ success: true, message: 'เพิ่มผู้ใช้งานสำเร็จ', user: newUser });
});

router.put('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const { name, username, password, role, email, image } = req.body;
  if (name) user.name = name;
  if (username) user.username = username;
  if (password) user.password = password;
  if (role) user.role = role;
  if (email !== undefined) user.email = email;
  if (image) user.image = image;

  saveDB(db);
  res.json({ success: true, message: 'ปรับปรุงข้อมูลผู้ใช้งานสำเร็จ', user });
});

router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  if (db.users.length <= 1) {
    return res.status(400).json({ success: false, message: 'ไม่สามารถลบผู้ใช้งานคนสุดท้ายได้' });
  }
  db.users = db.users.filter(u => u.id !== id);
  saveDB(db);
  res.json({ success: true, message: 'ลบผู้ใช้งานสำเร็จ' });
});

// -------------------------------------------------------------
// LOGFILES
// -------------------------------------------------------------
router.get('/logs', (req, res) => {
  const { companyId, status, doc_type, dateFrom, dateTo, start_date, end_date, search, page = 1, limit, page_size } = req.query;
  const db = loadDB();
  let list = [...(db.logs || [])];

  // Normalize fields on items
  list = list.map(l => ({
    ...l,
    doc_no: l.doc_no || l.docNo,
    docNo: l.docNo || l.doc_no,
    created_at: l.created_at || l.sentAt || '',
    sentAt: l.sentAt || l.created_at || '',
    debtor_name: l.debtor_name || l.companyName || '',
    companyName: l.companyName || l.debtor_name || '',
    debtor_code: l.debtor_code || `COMP-${l.companyId || '01'}`,
    debtor_branch: l.debtor_branch || '00000',
    total_amount: l.total_amount || 5350.0,
    status: (l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED') ? 'PASSED' :
            (l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED') ? 'FAILED' : 'PENDING',
    status_th: (l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED') ? 'สร้างเอกสารสำเร็จ' :
               (l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED') ? 'สร้างเอกสารไม่สำเร็จ' : 'ค้าง',
    error_code: l.error_code || l.errorCode || '',
    error_message: l.error_message || l.errorDescription || l.detail || '',
    doc_type: l.doc_type || (l.docNo && l.docNo.startsWith('CN') ? 'Credit Note' : l.docNo && l.docNo.startsWith('DN') ? 'Debit Note' : 'Sales Invoice')
  }));

  // Filter status
  if (status && status !== 'ALL' && status !== 'ทั้งหมด') {
    if (status === 'PASSED' || status === 'สร้างเอกสารสำเร็จ') {
      list = list.filter(l => l.status === 'PASSED' || l.status_th === 'สร้างเอกสารสำเร็จ');
    } else if (status === 'FAILED' || status === 'สร้างเอกสารไม่สำเร็จ') {
      list = list.filter(l => l.status === 'FAILED' || l.status_th === 'สร้างเอกสารไม่สำเร็จ');
    } else if (status === 'PENDING' || status === 'ค้าง') {
      list = list.filter(l => l.status === 'PENDING' || l.status_th === 'ค้าง');
    }
  }

  // Filter company
  if (companyId && companyId !== 'all') {
    list = list.filter(l => l.companyId === parseInt(companyId, 10));
  }

  // Filter doc_type
  if (doc_type && doc_type !== 'ALL') {
    list = list.filter(l => l.doc_type === doc_type);
  }

  // Filter date
  const fromD = start_date || dateFrom;
  const toD = end_date || dateTo;
  if (fromD) {
    list = list.filter(l => (l.created_at || '').substring(0, 10) >= fromD);
  }
  if (toD) {
    list = list.filter(l => (l.created_at || '').substring(0, 10) <= toD);
  }

  // Search keyword
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(l =>
      (l.doc_no && l.doc_no.toLowerCase().includes(q)) ||
      (l.debtor_name && l.debtor_name.toLowerCase().includes(q)) ||
      (l.debtor_code && l.debtor_code.toLowerCase().includes(q)) ||
      (l.error_message && l.error_message.toLowerCase().includes(q)) ||
      (l.error_code && l.error_code.toLowerCase().includes(q))
    );
  }

  const total = list.length;
  const limitNum = parseInt(page_size || limit, 10) || 10;
  const pageNum = parseInt(page, 10) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedLogs = list.slice(startIndex, startIndex + limitNum);

  res.json({
    success: true,
    total,
    total_records: total,
    page: pageNum,
    page_size: limitNum,
    totalPages: Math.ceil(total / limitNum),
    total_pages: Math.ceil(total / limitNum),
    logs: paginatedLogs,
    items: paginatedLogs
  });
});

router.get('/logs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const log = db.logs.find(l => l.id === id);
  if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
  const normalized = {
    ...log,
    doc_no: log.doc_no || log.docNo,
    created_at: log.created_at || log.sentAt || '',
    debtor_name: log.debtor_name || log.companyName || '',
    total_amount: log.total_amount || 5350.0,
    status: (log.status === 'สร้างเอกสารสำเร็จ' || log.status === 'PASSED') ? 'PASSED' :
            (log.status === 'สร้างเอกสารไม่สำเร็จ' || log.status === 'FAILED') ? 'FAILED' : 'PENDING',
    error_code: log.error_code || log.errorCode || '',
    error_message: log.error_message || log.errorDescription || log.detail || '',
    request_payload: log.request_payload || { doc_no: log.docNo, company: log.companyName },
    response_payload: log.response_payload || { status: log.status, detail: log.detail },
    validation_details: log.validation_details || []
  };
  res.json({ success: true, log: normalized, ...normalized });
});

// -------------------------------------------------------------
// TEST FILE GENERATOR & SIMULATION
// -------------------------------------------------------------
router.post('/inbound/generate-sample', (req, res) => {
  const { companyId, type = 'success' } = req.body;
  try {
    const generated = generateSampleInbound(companyId, type);
    res.json({
      success: true,
      message: `สร้างตัวอย่างเอกสาร Inbound สำเร็จ (${generated.docNo})`,
      generated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// SYSTEM STATUS
// -------------------------------------------------------------
router.get('/system/status', (req, res) => {
  const db = loadDB();
  const rootDir = getMainDocFolder(db);
  res.json({
    success: true,
    rootDir,
    companyCount: db.companies.length,
    userCount: db.users.length,
    logCount: db.logs.length,
    scheduler: getSchedulerStatus()
  });
});

module.exports = router;
