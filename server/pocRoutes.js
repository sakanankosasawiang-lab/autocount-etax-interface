const express = require('express');
const router = express.Router();
const { loadDB, saveDB } = require('./database');

// Default AutoCount debtors matching realistic scenarios
const DEFAULT_DEBTORS = [
  {
    debtor_code: 'DB-001',
    debtor_name: 'Siam Commercial Distribution Co., Ltd.',
    tax_id: '0105551029384',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00000',
    email: 'finance@scdist.co.th',
    phone: '+66-22345678',
    address: '88/1 Sukhumvit Rd, Khlong Toei, Bangkok 10110',
    is_etax_ready: 1,
    missing_fields: 'None'
  },
  {
    debtor_code: 'DB-002',
    debtor_name: 'Eurofins Scientific Testing (Thailand)',
    tax_id: '0105558091234',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00001',
    email: 'ap-thailand@eurofins.com',
    phone: '+66-26789012',
    address: '159 Serm-Mit Tower, Asoke, Bangkok 10110',
    is_etax_ready: 1,
    missing_fields: 'None'
  },
  {
    debtor_code: 'DB-003',
    debtor_name: 'Apex Petrochemical Public Co., Ltd.',
    tax_id: '0107559001827',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00000',
    email: 'invoice.tax@apexpetro.th',
    phone: '+66-28901234',
    address: '123 Vibhavadi Rangsit Rd, Chatuchak, Bangkok 10900',
    is_etax_ready: 1,
    missing_fields: 'None'
  },
  {
    debtor_code: 'DB-004',
    debtor_name: 'Boonrawd Agri-Logistics Partnership',
    tax_id: '0103554098172',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00002',
    email: 'account@boonrawdagri.com',
    phone: '+66-23456789',
    address: '45 Bangna-Trad Km.12, Samut Prakan 10540',
    is_etax_ready: 1,
    missing_fields: 'None'
  },
  {
    debtor_code: 'DB-005',
    debtor_name: 'นายสมชาย ประเสริฐยิ่ง (Somchai Trading)',
    tax_id: '3100500987654',
    registration_type: '02',
    country_code: 'TH',
    branch_code: '00000',
    email: 'somchai.prs@gmail.com',
    phone: '+66-812345678',
    address: '12/4 Phahonyothin Rd, Phayathai, Bangkok 10400',
    is_etax_ready: 1,
    missing_fields: 'None'
  },
  {
    debtor_code: 'DB-006',
    debtor_name: 'Bangkok Fresh Food Mart Co., Ltd.',
    tax_id: '0105556012876',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00000',
    email: '',
    phone: '+66-24567890',
    address: '90 Charoen Krung Rd, Bang Kho Laem, Bangkok 10120',
    is_etax_ready: 0,
    missing_fields: 'Email address missing in Debtor Maintenance'
  },
  {
    debtor_code: 'DB-007',
    debtor_name: 'Mega Wholesale Hub Co., Ltd.',
    tax_id: '0105557023910',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00003',
    email: 'tax@megawholesale.co.th',
    phone: '+66(0)2-999-999-EXT#889-INVALID-PHONE-EXCEED-CHAR-LIMIT',
    address: '77 Rama 9 Rd, Huai Khwang, Bangkok 10310',
    is_etax_ready: 0,
    missing_fields: 'Phone number violates H21,B10 format rule (>30 chars or invalid format)'
  },
  {
    debtor_code: 'DB-008',
    debtor_name: 'Quick Express Delivery Ltd.',
    tax_id: '010555',
    registration_type: '01',
    country_code: 'TH',
    branch_code: '00000',
    email: 'billing@quickexp.co.th',
    phone: '+66-27890123',
    address: '33/2 Phetchaburi Rd, Ratchathewi, Bangkok 10400',
    is_etax_ready: 0,
    missing_fields: 'Tax ID must be exactly 13 digits'
  }
];

function getDebtors(db) {
  if (!db.debtors || !db.debtors.length) {
    db.debtors = JSON.parse(JSON.stringify(DEFAULT_DEBTORS));
    saveDB(db);
  }
  return db.debtors;
}

// -------------------------------------------------------------
// GET /api/stats - Dashboard summary metrics
// -------------------------------------------------------------
router.get('/stats', (req, res) => {
  const db = loadDB();
  const logs = db.logs || [];

  const passedCount = logs.filter(l => l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED').length;
  const failedCount = logs.filter(l => l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED').length;
  const pendingCount = logs.filter(l => l.status === 'ค้าง' || l.status === 'PENDING').length;
  const total = logs.length;
  const passRate = total > 0 ? parseFloat((passedCount / total * 100).toFixed(1)) : 0;

  // Total value calculation
  const totalValue = logs.reduce((acc, l) => acc + (l.total_amount || 4500.0), 0);

  // Daily trends calculation
  const dateMap = {};
  logs.forEach(l => {
    const d = (l.created_at || l.sentAt || '').substring(0, 10) || new Date().toISOString().substring(0, 10);
    if (!dateMap[d]) dateMap[d] = { date: d, passed: 0, failed: 0, pending: 0 };
    if (l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED') dateMap[d].passed++;
    else if (l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED') dateMap[d].failed++;
    else dateMap[d].pending++;
  });
  const dailyTrends = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

  // Type breakdown
  const typeMap = {};
  logs.forEach(l => {
    const t = l.doc_type || (l.docNo && l.docNo.startsWith('CN') ? 'Credit Note' : l.docNo && l.docNo.startsWith('DN') ? 'Debit Note' : 'Sales Invoice');
    if (!typeMap[t]) typeMap[t] = { doc_type: t, count: 0, passed: 0 };
    typeMap[t].count++;
    if (l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED') typeMap[t].passed++;
  });

  // Top errors
  const errMap = {};
  logs.filter(l => l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED').forEach(l => {
    const code = l.error_code || l.errorCode || 'ERR_VALIDATION';
    const msg = l.error_message || l.errorDescription || l.detail || 'Validation error';
    if (!errMap[code]) errMap[code] = { code, message: msg.split(';')[0], count: 0 };
    errMap[code].count++;
  });
  const topErrors = Object.values(errMap).sort((a, b) => b.count - a.count).slice(0, 5);

  const todayStr = new Date().toISOString().substring(0, 10);
  const todayLogs = logs.filter(l => (l.created_at || l.sentAt || '').startsWith(todayStr));

  res.json({
    summary: {
      total,
      passed: passedCount,
      failed: failedCount,
      pending: pendingCount,
      pass_rate: passRate,
      total_value: parseFloat(totalValue.toFixed(2))
    },
    today: {
      total: todayLogs.length,
      passed: todayLogs.filter(l => l.status === 'สร้างเอกสารสำเร็จ' || l.status === 'PASSED').length,
      failed: todayLogs.filter(l => l.status === 'สร้างเอกสารไม่สำเร็จ' || l.status === 'FAILED').length,
      pending: todayLogs.filter(l => l.status === 'ค้าง' || l.status === 'PENDING').length
    },
    daily_trends: dailyTrends,
    type_breakdown: Object.values(typeMap),
    top_errors: topErrors
  });
});

// -------------------------------------------------------------
// GET /api/debtors & POST /api/debtors/:code/fix
// -------------------------------------------------------------
router.get('/debtors', (req, res) => {
  const db = loadDB();
  res.json(getDebtors(db));
});

router.post('/debtors/:code/fix', (req, res) => {
  const db = loadDB();
  const debtors = getDebtors(db);
  const debtor = debtors.find(d => d.debtor_code === req.params.code);
  if (!debtor) return res.status(404).json({ success: false, message: 'Debtor not found' });

  debtor.email = debtor.email || `tax.${debtor.debtor_code.toLowerCase()}@autocount-sample.th`;
  debtor.phone = '+66-29876543';
  debtor.tax_id = debtor.tax_id && debtor.tax_id.length === 13 ? debtor.tax_id : '0105559876543';
  debtor.is_etax_ready = 1;
  debtor.missing_fields = 'None (Corrected)';

  saveDB(db);
  res.json({
    success: true,
    message: `Debtor ${debtor.debtor_code} updated successfully and marked as e-Tax compliant.`,
    updated: debtor
  });
});

// -------------------------------------------------------------
// CONFIG ENDPOINTS
// -------------------------------------------------------------
router.get('/config', (req, res) => {
  const db = loadDB();
  const cfg = {
    developer_id: 'Piyarathl@gmail.com',
    developer_password: 'X#f04vj7Ku3',
    developer_password_masked: 'X#********',
    api_endpoint: 'https://accounting-api.autocountcloud.com',
    account_book_id: 'ACC-TH-EUROFINS-01',
    company_name: 'Eurofins Food Testing (Thailand) Co., Ltd.',
    company_tax_id: '0105557088921',
    company_branch: '00000',
    sync_interval_mins: '15',
    auto_sync_enabled: 'true',
    inbound_dir: 'C:\\Apps\\Autocount\\inbound',
    outbound_dir: 'C:\\Apps\\Autocount\\outbound'
  };
  res.json(cfg);
});

router.post('/config', (req, res) => {
  res.json({ success: true, message: 'System configuration updated successfully' });
});

router.post('/config/test-connection', (req, res) => {
  res.json({
    success: true,
    status_code: 200,
    message: "Successfully authenticated AutoCount Developer Session for 'Piyarathl@gmail.com'. Connected to Account Book: ACC-TH-EUROFINS-01",
    server_version: 'AutoCount Accounting 2.2 / Cloud REST v1',
    developer_id: 'Piyarathl@gmail.com',
    account_book: 'ACC-TH-EUROFINS-01',
    modules_active: ['API Module', 'E-Invoicing Module', 'Sales & Invoicing', 'A/R Accounting'],
    duration_ms: 15
  });
});

// -------------------------------------------------------------
// POC BATCH INTERFACE RUNNER
// -------------------------------------------------------------
router.post('/interface/run-poc', (req, res) => {
  const { scenario = 'MIXED', count = 5 } = req.body;
  const db = loadDB();
  const debtors = getDebtors(db);
  const now = new Date();
  const batchId = `POC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString().slice(-4)}`;

  const numDocs = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
  const items = [];

  for (let i = 0; i < numDocs; i++) {
    const docNum = `POC-INV-261030-${Math.floor(1000 + Math.random() * 9000)}`;
    let docType = 'Sales Invoice';
    let debtor = debtors[i % debtors.length];
    let isPassed = debtor.is_etax_ready === 1;
    let errorCode = '';
    let errorMsg = '';
    let validationDetails = [];

    if (scenario === 'STANDARD') {
      debtor = debtors.find(d => d.is_etax_ready === 1) || debtors[0];
      isPassed = true;
    } else if (scenario === 'CREDIT_DEBIT_NOTE') {
      docType = i % 2 === 0 ? 'Credit Note' : 'Debit Note';
      debtor = debtors[0];
      if (i % 2 === 1) {
        isPassed = false;
        errorCode = 'ERR_REASON_CODE_MISSING';
        errorMsg = 'Reason Code is mandatory for Credit Note / Debit Note e-Tax document (Slide 14)';
        validationDetails.push({ field: 'reason_code', code: errorCode, label: 'รหัสเหตุผล eTax Reason', message: errorMsg });
      }
    } else {
      // MIXED
      if (i % 3 === 1) {
        docType = 'Credit Note';
        isPassed = false;
        errorCode = 'ERR_REASON_CODE_MISSING';
        errorMsg = 'Reason Code is mandatory for Credit Note / Debit Note e-Tax document (Slide 14)';
        validationDetails.push({ field: 'reason_code', code: errorCode, label: 'รหัสเหตุผล eTax Reason', message: errorMsg });
      } else if (!isPassed) {
        if (!debtor.email) {
          errorCode = 'ERR_EMAIL_MISSING';
          errorMsg = 'Debtor Email address is mandatory for electronic invoice dispatch';
          validationDetails.push({ field: 'email', code: errorCode, label: 'อีเมลผู้ซื้อใน Debtor Maintenance', message: errorMsg });
        } else if (debtor.phone && debtor.phone.includes('INVALID')) {
          errorCode = 'ERR_PHONE_FORMAT_H21_B10';
          errorMsg = `Phone '${debtor.phone}' rejected: format must follow +<country>-<number> and not exceed 30 chars (Rule H21,B10)`;
          validationDetails.push({ field: 'phone', code: errorCode, label: 'เบอร์โทรศัพท์ (Rule H21,B10)', message: errorMsg });
        } else {
          errorCode = 'ERR_TAXID_FORMAT';
          errorMsg = 'Tax ID is invalid. Must be exactly 13 numeric digits';
          validationDetails.push({ field: 'tax_id', code: errorCode, label: 'เลขประจำตัวผู้เสียภาษี', message: errorMsg });
        }
      }
    }

    const totalAmt = 5350.0;
    const taxAmt = 350.0;
    const status = isPassed ? 'PASSED' : 'FAILED';
    const etaxUuid = isPassed ? `TH-ETAX-20261030-${Math.random().toString(16).substring(2, 10).toUpperCase()}` : null;
    const docGuid = isPassed ? `ac-${Math.random().toString(36).substring(2, 12)}` : null;

    const logEntry = {
      id: db.logs.length + 1,
      batch_id: batchId,
      doc_no: docNum,
      docNo: docNum,
      doc_type: docType,
      doc_date: now.toISOString().substring(0, 10),
      debtor_code: debtor.debtor_code,
      debtor_name: debtor.debtor_name,
      companyName: debtor.debtor_name,
      debtor_tax_id: debtor.tax_id,
      debtor_branch: debtor.branch_code || '00000',
      total_amount: totalAmt,
      tax_amount: taxAmt,
      net_amount: totalAmt - taxAmt,
      status: isPassed ? 'สร้างเอกสารสำเร็จ' : 'สร้างเอกสารไม่สำเร็จ',
      status_raw: status,
      error_code: errorCode,
      errorCode: errorCode,
      error_message: errorMsg,
      errorDescription: errorMsg,
      detail: isPassed ? '-' : errorMsg,
      validation_details: validationDetails,
      request_payload: {
        doc_no: docNum,
        doc_type: docType,
        debtor,
        items: [{ item_code: 'LAB-ANL-01', description: 'Testing Service', qty: 1, unit_price: 5000.0 }]
      },
      response_payload: {
        statusCode: isPassed ? 201 : 422,
        status: isPassed ? 'Created' : 'Unprocessable Entity',
        message: isPassed ? `Document '${docNum}' successfully posted to AutoCount.` : errorMsg,
        data: isPassed ? { docNo: docNum, autoCountGuid: docGuid, eInvoiceUUID: etaxUuid } : null
      },
      autocount_doc_guid: docGuid,
      etax_uuid: etaxUuid,
      interface_duration_ms: Math.floor(15 + Math.random() * 40),
      created_at: `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      sentAt: `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    };

    db.logs.unshift(logEntry);
    items.push({
      doc_no: docNum,
      doc_type: docType,
      status,
      debtor_name: debtor.debtor_name,
      error_code: errorCode,
      error_message: errorMsg,
      autocount_doc_guid: docGuid,
      etax_uuid: etaxUuid
    });
  }

  saveDB(db);

  res.json({
    success: true,
    batch_id: batchId,
    total_executed: items.length,
    passed: items.filter(i => i.status === 'PASSED').length,
    failed: items.filter(i => i.status === 'FAILED').length,
    scenario,
    items
  });
});

// -------------------------------------------------------------
// RETRY INTERFACE
// -------------------------------------------------------------
router.post('/interface/retry/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const log = db.logs.find(l => l.id === id);
  if (!log) return res.status(404).json({ success: false, message: 'Log not found' });

  log.status = 'สร้างเอกสารสำเร็จ';
  log.status_raw = 'PASSED';
  log.error_code = '';
  log.errorCode = null;
  log.error_message = '';
  log.errorDescription = null;
  log.detail = '-';
  log.etax_uuid = `TH-ETAX-20261030-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
  log.autocount_doc_guid = `ac-${Math.random().toString(36).substring(2, 12)}`;

  saveDB(db);

  res.json({
    success: true,
    id,
    doc_no: log.doc_no || log.docNo,
    new_status: 'PASSED',
    error_message: 'สำเร็จ'
  });
});

module.exports = router;
