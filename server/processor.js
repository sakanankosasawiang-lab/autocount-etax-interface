const fs = require('fs');
const path = require('path');
const { loadDB, saveDB, ensureDirSync } = require('./database');

// Resolve main document folder path
function getMainDocFolder(db) {
  if (process.env.VERCEL) {
    const vFolder = path.join('/tmp', 'etax_data');
    ensureDirSync(vFolder);
    return vFolder;
  }
  const mainSetting = db.setup.find(s => s.name === 'MAIN_DOCUMENT_FOLDER');
  let folder = mainSetting ? mainSetting.value : 'C:/Apps/Autocount/etax_data';
  // Normalize Windows slashes
  folder = path.resolve(folder);
  ensureDirSync(folder);
  return folder;
}

// Ensure folder hierarchy for all companies
function ensureCompanyFolders() {
  const db = loadDB();
  const rootDir = getMainDocFolder(db);

  db.companies.forEach(comp => {
    const compDir = path.join(rootDir, comp.folder);
    ensureDirSync(path.join(compDir, 'inbound'));
    ensureDirSync(path.join(compDir, 'outbound'));
    ensureDirSync(path.join(compDir, 'history'));
  });
}

// Generate realistic XML for e-Tax One.th format
function generateETaxXML(docData, comp) {
  const dateIso = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:TaxInvoice_CrossIndustryInvoice xmlns:rsm="urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2"
  xmlns:ram="urn:etda:uncefact:data:standard:TaxInvoice_ReusableAggregateBusinessInformationEntity:2">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>ER3-2560</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${docData.docNo}</ram:ID>
    <ram:Name>ใบกำกับภาษี/ใบเสร็จรับเงิน</ram:Name>
    <ram:TypeCode>${docData.docType || '388'}</ram:TypeCode>
    <ram:IssueDateTime>${dateIso}</ram:IssueDateTime>
    ${docData.reasonCode ? `<ram:PurposeCode>${docData.reasonCode}</ram:PurposeCode>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${comp.name}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="TXID">${comp.taxId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${docData.buyerName || 'ลูกค้ารายทั่วไป'}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="${docData.buyerRegType || 'TXID'}">${docData.buyerTaxId || '0000000000000'}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount currencyID="THB">${docData.subTotal || '1000.00'}</ram:LineTotalAmount>
        <ram:TaxTotalAmount currencyID="THB">${docData.taxAmount || '70.00'}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount currencyID="THB">${docData.grandTotal || '1070.00'}</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:TaxInvoice_CrossIndustryInvoice>`;
}

// Validate invoice data according to Slide 14 rules
function validateInvoice(doc) {
  // 1. Phone number format validation (H21, B10)
  // PPTX: "เบอร์โทร ทั้งหมด ไม่ได้ส่ง เพราะ ผิด Format (H21,B10) +ตัวเลข 1-3 หลัก-ตัวเลข หรือเครื่องหมาย <+ หรือ -> ไม่เกิน 30 หลัก"
  if (doc.phone) {
    const phoneRegex = /^(\+?\d{1,3}-?[\d\-]{5,20})$/;
    if (!phoneRegex.test(doc.phone.trim()) || doc.phone.length > 30) {
      return {
        valid: false,
        code: 'ERR_PHONE_FORMAT_INVALID',
        message: 'เบอร์โทร ทั้งหมด ไม่ได้ส่ง เพราะ ผิด Format (H21,B10) +ตัวเลข 1-3 หลัก-ตัวเลข หรือเครื่องหมาย <+ หรือ -> ไม่เกิน 30 หลัก'
      };
    }
  }

  // 2. Case DN / CN must specify eTax Reason
  // PPTX: "Case DN / CN ต้องระบุ รหัส eTax Reason แต่ละเอกสาร"
  const isDNCN = doc.docNo.startsWith('DN-') || doc.docNo.startsWith('CN-') || doc.docType === 'DN' || doc.docType === 'CN';
  if (isDNCN && (!doc.reasonCode || doc.reasonCode.trim() === '')) {
    return {
      valid: false,
      code: 'ERR_REASON_CODE_MISSING',
      message: 'Case DN / CN ต้องระบุ รหัส eTax Reason แต่ละเอกสาร'
    };
  }

  // 3. Buyer Registration Type and Country Code
  // PPTX: "ข้อมูลผู้ซื้อ ที่ครบถ้วน ตามหลักการใบกำกับภาษี ต้องกำหนด Registration Type และ Country Code"
  if (!doc.buyerRegType || !doc.buyerCountryCode) {
    return {
      valid: false,
      code: 'ERR_BUYER_REGISTRATION_MISSING',
      message: 'ข้อมูลผู้ซื้อ ไม่ครบถ้วน ตามหลักการใบกำกับภาษี ต้องกำหนด Registration Type และ Country Code'
    };
  }

  // 4. Buyer Email requirement
  // PPTX: "email ผู้ซื้อต้องกำหนด ใน Debtor Maintenance"
  if (!doc.buyerEmail || !doc.buyerEmail.includes('@')) {
    return {
      valid: false,
      code: 'ERR_BUYER_EMAIL_MISSING',
      message: 'email ผู้ซื้อต้องกำหนด ใน Debtor Maintenance'
    };
  }

  return { valid: true };
}

// Parse Autocount text export
function parseAutocountTxt(txtContent, filename) {
  const lines = txtContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const data = {
    docNo: path.basename(filename, path.extname(filename)),
    docType: '388',
    buyerName: 'ลูกค้าทั่วไป',
    buyerTaxId: '0105550000000',
    buyerRegType: 'TXID',
    buyerCountryCode: 'TH',
    buyerEmail: 'customer@example.com',
    phone: '+66-21234567',
    reasonCode: '',
    subTotal: '1000.00',
    taxAmount: '70.00',
    grandTotal: '1070.00'
  };

  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim().toUpperCase();
      const val = parts.slice(1).join('=').trim();
      if (key === 'DOCNO') data.docNo = val;
      if (key === 'DOCTYPE') data.docType = val;
      if (key === 'BUYERNAME') data.buyerName = val;
      if (key === 'BUYERTAXID') data.buyerTaxId = val;
      if (key === 'BUYERREGTYPE') data.buyerRegType = val;
      if (key === 'BUYERCOUNTRY') data.buyerCountryCode = val;
      if (key === 'BUYEREMAIL') data.buyerEmail = val;
      if (key === 'PHONE') data.phone = val;
      if (key === 'REASONCODE') data.reasonCode = val;
      if (key === 'SUBTOTAL') data.subTotal = val;
      if (key === 'TAXAMOUNT') data.taxAmount = val;
      if (key === 'GRANDTOTAL') data.grandTotal = val;
    }
  }

  return data;
}

// Process Inbound files for all or one company
function processInbound(companyId = null) {
  const db = loadDB();
  const rootDir = getMainDocFolder(db);
  const results = {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    items: []
  };

  const targetCompanies = companyId 
    ? db.companies.filter(c => c.id === parseInt(companyId, 10))
    : db.companies;

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);

  targetCompanies.forEach(comp => {
    const compDir = path.join(rootDir, comp.folder);
    const inboundDir = path.join(compDir, 'inbound');
    const outboundDir = path.join(compDir, 'outbound');
    const historyDir = path.join(compDir, 'history');

    ensureDirSync(inboundDir);
    ensureDirSync(outboundDir);
    ensureDirSync(historyDir);

    const files = fs.readdirSync(inboundDir);
    // Find text files or pair files
    const txtFiles = files.filter(f => f.toLowerCase().endsWith('.txt'));

    txtFiles.forEach(txtFile => {
      const baseName = path.basename(txtFile, path.extname(txtFile));
      const txtPath = path.join(inboundDir, txtFile);
      const pdfFile = files.find(f => path.basename(f, path.extname(f)).toLowerCase() === baseName.toLowerCase() && f.toLowerCase().endsWith('.pdf'));
      const pdfPath = pdfFile ? path.join(inboundDir, pdfFile) : null;

      try {
        const txtContent = fs.readFileSync(txtPath, 'utf-8');
        const docData = parseAutocountTxt(txtContent, txtFile);

        const validation = validateInvoice(docData);
        results.processedCount++;

        const newLogId = db.logs.length > 0 ? Math.max(...db.logs.map(l => l.id)) + 1 : 1;

        if (validation.valid) {
          // Success: Generate outbound XML and move PDF
          const xmlContent = generateETaxXML(docData, comp);
          const xmlOutPath = path.join(outboundDir, `${docData.docNo}.xml`);
          fs.writeFileSync(xmlOutPath, xmlContent, 'utf-8');

          if (pdfPath && fs.existsSync(pdfPath)) {
            const pdfOutPath = path.join(outboundDir, `${docData.docNo}.pdf`);
            fs.copyFileSync(pdfPath, pdfOutPath);
            fs.renameSync(pdfPath, path.join(historyDir, `${docData.docNo}_${Date.now()}.pdf`));
          }

          // Move txt to history
          fs.renameSync(txtPath, path.join(historyDir, `${docData.docNo}_${Date.now()}.txt`));

          // Log entry
          const logEntry = {
            id: newLogId,
            docNo: docData.docNo,
            companyId: comp.id,
            companyName: comp.name,
            serviceCode: 'S06',
            sentAt: dateStr,
            status: 'สร้างเอกสารสำเร็จ',
            detail: '-',
            errorCode: null,
            errorDescription: null
          };
          db.logs.unshift(logEntry);

          // Update company stats
          comp.stats.month = (comp.stats.month || 0) + 1;
          comp.stats.today = (comp.stats.today || 0) + 1;
          comp.stats.success = (comp.stats.success || 0) + 1;
          if (comp.stats.pending > 0) comp.stats.pending--;

          results.successCount++;
          results.items.push({ docNo: docData.docNo, status: 'SUCCESS' });
        } else {
          // Failed
          // Move txt and pdf to history with error indicator
          fs.renameSync(txtPath, path.join(historyDir, `FAILED_${docData.docNo}_${Date.now()}.txt`));
          if (pdfPath && fs.existsSync(pdfPath)) {
            fs.renameSync(pdfPath, path.join(historyDir, `FAILED_${docData.docNo}_${Date.now()}.pdf`));
          }

          const logEntry = {
            id: newLogId,
            docNo: docData.docNo,
            companyId: comp.id,
            companyName: comp.name,
            serviceCode: 'S06',
            sentAt: dateStr,
            status: 'สร้างเอกสารไม่สำเร็จ',
            detail: validation.message,
            errorCode: validation.code,
            errorDescription: validation.message
          };
          db.logs.unshift(logEntry);

          comp.stats.today = (comp.stats.today || 0) + 1;
          comp.stats.failed = (comp.stats.failed || 0) + 1;
          if (comp.stats.pending > 0) comp.stats.pending--;

          results.failedCount++;
          results.items.push({ docNo: docData.docNo, status: 'FAILED', reason: validation.message });
        }
      } catch (err) {
        console.error('Error processing file:', txtFile, err);
      }
    });

    // Also count any remaining unprocessed files as pending
    try {
      const remainingFiles = fs.readdirSync(inboundDir);
      const remainingTxt = remainingFiles.filter(f => f.toLowerCase().endsWith('.txt')).length;
      comp.stats.pending = remainingTxt;
    } catch (e) {
      // ignore
    }
  });

  saveDB(db);
  return results;
}

// Generate test sample files in inbound
function generateSampleInbound(companyId, type = 'success') {
  const db = loadDB();
  const comp = db.companies.find(c => c.id === parseInt(companyId, 10)) || db.companies[3];
  const rootDir = getMainDocFolder(db);
  const inboundDir = path.join(rootDir, comp.folder, 'inbound');
  ensureDirSync(inboundDir);

  const randNum = Math.floor(100000 + Math.random() * 900000);
  let docNo = '';
  let txtContent = '';

  if (type === 'success') {
    docNo = `TIT250${randNum.toString().slice(-4)}`;
    txtContent = `DOCNO=${docNo}
DOCTYPE=388
BUYERNAME=บริษัท คู่ค้าชั้นนำ จำกัด
BUYERTAXID=0105558012345
BUYERREGTYPE=TXID
BUYERCOUNTRY=TH
BUYEREMAIL=accounting@partner.co.th
PHONE=+66-29998888
SUBTOTAL=15000.00
TAXAMOUNT=1050.00
GRANDTOTAL=16050.00`;
  } else if (type === 'err_phone') {
    docNo = `TI-T250${randNum.toString().slice(-4)}`;
    txtContent = `DOCNO=${docNo}
DOCTYPE=388
BUYERNAME=ลูกค้ารายย่อย ทดสอบ
BUYERTAXID=0105558099999
BUYERREGTYPE=TXID
BUYERCOUNTRY=TH
BUYEREMAIL=buyer@retail.com
PHONE=02-123-4567-890-INVALID-FORMAT-TOO-LONG-AND-WRONG-PATTERN
SUBTOTAL=5000.00
TAXAMOUNT=350.00
GRANDTOTAL=5350.00`;
  } else if (type === 'err_reason') {
    docNo = `DN-000${randNum.toString().slice(-3)}`;
    txtContent = `DOCNO=${docNo}
DOCTYPE=DN
BUYERNAME=บริษัท เพิ่มหนี้ จำกัด
BUYERTAXID=0105558011111
BUYERREGTYPE=TXID
BUYERCOUNTRY=TH
BUYEREMAIL=dn@partner.co.th
PHONE=+66-23456789
REASONCODE=
SUBTOTAL=2000.00
TAXAMOUNT=140.00
GRANDTOTAL=2140.00`;
  } else if (type === 'err_buyer') {
    docNo = `TIT250${randNum.toString().slice(-4)}`;
    txtContent = `DOCNO=${docNo}
DOCTYPE=388
BUYERNAME=ไม่ระบุประเภทภาษี
BUYERTAXID=
BUYERREGTYPE=
BUYERCOUNTRY=
BUYEREMAIL=nobuyer@test.com
PHONE=+66-23334444
SUBTOTAL=3000.00
TAXAMOUNT=210.00
GRANDTOTAL=3210.00`;
  }

  // Create .txt
  fs.writeFileSync(path.join(inboundDir, `${docNo}.txt`), txtContent, 'utf-8');

  // Create dummy .pdf (Valid minimal PDF)
  const dummyPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
  fs.writeFileSync(path.join(inboundDir, `${docNo}.pdf`), dummyPdf, 'utf-8');

  // Update pending counter
  comp.stats.pending = (comp.stats.pending || 0) + 1;
  saveDB(db);

  return { docNo, company: comp.name, folder: comp.folder, type };
}

module.exports = {
  ensureCompanyFolders,
  processInbound,
  generateSampleInbound,
  getMainDocFolder
};
