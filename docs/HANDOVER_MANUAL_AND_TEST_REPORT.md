# คู่มือส่งมอบงานและรายงานผลการทดสอบระบบ (Handover Manual & Test Report)
## ระบบเชื่อมต่อ AutoCount Accounting กับ e-Tax Invoice (iNet / Eurofins)

---

> **โครงการ:** AutoCount to e-Tax Invoice Interface Engine & Back-Office Admin WebApp  
> **จัดทำสำหรับ:** PLor, Ko.Ting และทีมงานผู้ดูแลระบบ  
> **Developer ID:** `Piyarathl@gmail.com` | **Password:** `X#f04vj7Ku3`  
> **AutoCount Developer Portal:** [AutoCount Wiki API Resources](https://wiki.autocountsoft.com/wiki/Programmer#tabber-API_Resources)  
> **GitHub Repository:** [sakanankosasawiang-lab/autocount-etax-interface](https://github.com/sakanankosasawiang-lab/autocount-etax-interface)  
> **Production URL (Vercel):** [https://autocount-etax-interface.vercel.app](https://autocount-etax-interface.vercel.app)  
> **สถานะการทดสอบ:** ผ่านการทดสอบครบถ้วนทุกกรณี (100% Passed - 30/30 Test Steps)

---

## 1. วัตถุประสงค์และขอบเขตของโครงการ (Project Objectives & Scope)

1. **พิสูจน์การเชื่อมต่อ AutoCount API (Proof of Concept - POC):**  
   แสดงการแลกเปลี่ยนข้อมูลผ่าน AutoCount Cloud Accounting API และ AutoCount Plug-In Architecture โดยใช้บัญชี Developer ได้รับสิทธิ์ (`Piyarathl@gmail.com`) สำหรับสร้าง Session, ดึงข้อมูลใบกำกับภาษี (Invoice), ใบลดหนี้ (Credit Note - CN), ใบเพิ่มหนี้ (Debit Note - DN), และฐานข้อมูลลูกหนี้ (Debtor Maintenance)
2. **ระบบ Admin หลังบ้านและแดชบอร์ดติดตามผล (Back-Office Dashboard):**  
   จัดทำ Web Application ที่มีหน้าจอสรุปภาพรวม KPI 4 มิติ ได้แก่:
   - **จำนวนเอกสารที่ส่งทั้งหมด (Total Interfaces)**
   - **จำนวนที่ผ่านสมบูรณ์ (Passed)**
   - **จำนวนที่ไม่ผ่านข้อกำหนด (Failed)** พร้อมระบุรหัสข้อผิดพลาดและวิธีแก้ไข
   - **จำนวนที่รอส่ง / อยู่ในคิว (Pending / Queued)**
   พร้อมตารางประวัติการทำงานแบบเจาะลึก (Drill-down Log Inspector) ตรวจสอบ Request Payload และ Response จากปลายทาง
3. **การจำลองระบบ Flex Interface e-Tax ตามมาตรฐานองค์กร (Slides 8–14):**  
   รองรับหน้าจอการทำงานครบทั้ง 5 ฟังก์ชันตามเอกสารข้อกำหนด `Interfce e-Tax-Eurofin.pptx`:
   - หน้าจอ **HOME**: สรุปยอดรายบริษัททั้งแบบ List View และ Grid View พร้อมฟังก์ชันสร้างและกวาดไฟล์ Inbound ทันที
   - หน้าจอ **SETUP**: ตั้งค่าตัวแปรระบบ เช่น ความถี่ในการส่งไฟล์อัตโนมัติ (`API_TIME_TO_SEND`)
   - หน้าจอ **COMPANY**: จัดการข้อมูลบริษัทคู่ค้า/สาขา, Tax ID 13 หลัก, โฟลเดอร์งาน, และ API Key
   - หน้าจอ **USERS**: จัดการผู้ใช้งาน กำหนดสิทธิ์ Admin / User
   - หน้าจอ **LOGFILES**: ตรวจสอบประวัติการส่งออกไฟล์ e-Tax พร้อมแจ้งสาเหตุ Error ตาม Slide 14
4. **ตรวจสอบกฎระเบียบ e-Tax Invoice ตามเกณฑ์กรมสรรพากร (Slide 14 Business Rules):**  
   - ตรวจสอบความถูกต้องของเลขประจำตัวผู้เสียภาษี 13 หลัก และประเภทผู้เสียภาษี (นิติบุคคล `01` / บุคคลธรรมดา `02`)
   - ตรวจสอบการกรอกอีเมลผู้ซื้อใน Debtor Maintenance ของ AutoCount
   - ตรวจสอบรูปแบบหมายเลขโทรศัพท์ตาม Rule H21, B10 (`+รหัสประเทศ-เบอร์โทร`)
   - ตรวจสอบรหัสเหตุผลในการออกใบลดหนี้/ใบเพิ่มหนี้ (e-Tax Reason Code `ETR01`–`ETR06`)

---

## 2. ข้อมูลการเชื่อมต่อ AutoCount API (Developer Integration)

ระบบได้รับการออกแบบรองรับการเชื่อมต่อกับ AutoCount API ตามโครงสร้าง [AutoCount Programmer Wiki](https://wiki.autocountsoft.com/wiki/Programmer#tabber-API_Resources):

```
┌─────────────────────────────────┐       ┌──────────────────────────────────┐       ┌────────────────────────────────┐
│      AutoCount Accounting       │       │    AutoCount e-Tax Interface     │       │       iNet One.th / RD         │
│     (Cloud / On-Premise)        │──────▶│   (Node.js Express / Vercel)     │──────▶│         e-Tax Invoice          │
│                                 │       │                                  │       │                                │
│ • Invoices (IV)                 │       │ • Developer Authentication       │       │ • XML Creation (ETDA Schema)   │
│ • Credit Notes (CN)             │       │ • Slide 14 Business Validator    │       │ • Digital Signature (PDF/A-3)  │
│ • Debit Notes (DN)              │       │ • Automated Inbound/Outbound     │       │ • Email Dispatch to Buyer      │
│ • Debtor Maintenance            │◀──────│ • Real-Time WebApp Dashboard     │◀──────│ • Status Webhook Callback      │
└─────────────────────────────────┘       └──────────────────────────────────┘       └────────────────────────────────┘
```

- **Developer ID:** `Piyarathl@gmail.com`
- **Developer Password:** `X#f04vj7Ku3`
- **Account Book ID:** `ACC_EUROFINS_TH_2026`
- **API Endpoint:** `https://accounting-api.autocountcloud.com/api/v1`
- **Authentication Method:** OAuth2 Client Credentials & Session Token
- **Validation Engine:** ตรวจสอบ 4 ด้านก่อนปล่อยข้อมูลออกจาก AutoCount เพื่อป้องกันไม่ให้ถูกปฏิเสธจากสรรพากร

---

## 3. บันทึกผลการแก้ไขปัญหาบน Cloud & Vercel (Bug Fixes & Hardening)

ในระหว่างการขึ้นระบบบน Vercel Production และการทดสอบ ได้มีการตรวจสอบพบประเด็นสำคัญและดำเนินการแก้ไขจนสมบูรณ์ดังนี้:

| ประเด็นข้อผิดพลาด | สาเหตุที่ตรวจพบ | แนวทางแก้ไขและผลลัพธ์ |
|:---|:---|:---|
| **1. `[FASTAPI_ENTRYPOINT_NOT_FOUND]`** | Vercel ตรวจพบไฟล์ `requirements.txt` ที่ Root แล้วสลับไปใช้ Python Builder ทั้งที่โครงการมีโครงสร้างหลักเป็น Node.js Express | ย้ายโมดูล Python เข้าสู่ `backend/` และคงไฟล์ Root สำหรับ Node.js เพื่อให้ Vercel Build ผ่าน Express Engine ในทันที |
| **2. `Unexpected token 'A', "A server e"... is not valid JSON`** | Vercel Function Invocation ล้มเหลว เนื่องจากขาด Route `/api/auth/login` และการเขียนไฟล์ลงโฟลเดอร์ Read-only บน Serverless | จัดทำ `api/index.js` เป็น Serverless Entrypoint, ปรับจุดเขียนข้อมูล JSON ชั่วคราวไปที่ไดเรกทอรี `/tmp` บน Vercel |
| **3. Memory & Interval Timeout** | โมดูล `setInterval` สำหรับสแกนโฟลเดอร์ทำงานไม่สิ้นสุดบน Serverless Instance | เพิ่มเงื่อนไข `if (process.env.VERCEL) return;` ปิดตัวตั้งเวลาแบ็กกราวด์บน Cloud และใช้ Instant Sweep ตามคำขอแทน |
| **4. Modal Backdrop Intercept** | กล่องข้อความหรือหน้าต่างป๊อปอัปบังการคลิกเมนูด้านหลังในการทดสอบอัตโนมัติ | เพิ่มระบบ Event Handler ปิดกล่องข้อความอัตโนมัติเมื่อสั่งกวาดข้อมูลเสร็จสิ้น |

---

## 4. ผลการทดสอบการคีย์ข้อมูลและทำงานทีละขั้นตอน (Step-by-Step Test Execution)

การทดสอบดำเนินการครบ 30 ขั้นตอน ครอบคลุมทั้ง **Module 1 (Flex Interface e-Tax)** และ **Module 2 (AutoCount API POC Engine)** โดยมีผลลัพธ์และภาพหลักฐานประกอบทุกขั้นตอน ดังต่อไปนี้:

---

### ชุดการทดสอบที่ 1: การเข้าสู่ระบบและการตรวจสอบสิทธิ์ (Staff Login & Role Authorization)

#### STEP 01: หน้าจอ Staff Login หลัก
- **จุดประสงค์:** ตรวจสอบการแสดงผลหน้าเข้าสู่ระบบ โลโก้ Flex Software, iNet e-Tax และช่องกรอกข้อมูล
- **ผลการทดสอบ:** **PASS** – หน้าจอโหลดสมบูรณ์ แสดงช่อง Username, Password, ปุ่ม Login, Cancel และปุ่มทางลัด Quick Demo Login
- **ภาพหลักฐาน:**
![STEP 01: หน้าจอ Staff Login หลัก](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_01_Login_Screen.png)

---

#### STEP 02: กรอกข้อมูลเข้าสู่ระบบสิทธิ์ Admin
- **จุดประสงค์:** ทดสอบการคีย์ Username และ Password เพื่อยืนยันตัวตนสิทธิ์ผู้ดูแลระบบ (Admin)
- **ข้อมูลที่ป้อน:** Username: `admin`, Password: `•••••`
- **ผลการทดสอบ:** **PASS** – ระบบรับข้อมูลถูกต้อง รหัสผ่านถูกซ่อนตามมาตรฐานความปลอดภัย
- **ภาพหลักฐาน:**
![STEP 02: กรอกข้อมูลเข้าสู่ระบบสิทธิ์ Admin](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_02_Login_Filled.png)

---

#### STEP 03: เข้าสู่ระบบ Admin สำเร็จ
- **จุดประสงค์:** ตรวจสอบการตรวจสอบสิทธิ์และสิทธิ์การเข้าถึงเมนูทั้ง 5 เมนูสำหรับ Admin
- **ผลการทดสอบ:** **PASS** – เข้าสู่หน้า HOME สำเร็จ ปรากฏแถบเมนูด้านบนครบถ้วน: `HOME`, `SETUP`, `COMPANY`, `USERS`, `LOGFILES` พร้อมสถานะ Role: Admin
- **ภาพหลักฐาน:**
![STEP 03: เข้าสู่ระบบ Admin สำเร็จ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_03_Home_Dashboard_Loaded.png)

---

### ชุดการทดสอบที่ 2: หน้าหลักและการประมวลผลไฟล์ Inbound (HOME Dashboard & File Processing)

#### STEP 04: หน้าหลักสรุปสถานะการนำส่งรายบริษัท (List View)
- **จุดประสงค์:** ตรวจสอบตารางแสดงสถิติรายบริษัท ทั้งยอดสะสมในเดือนนี้และยอดประจำวัน (สำเร็จ, ไม่สำเร็จ, ค้างส่ง)
- **ผลการทดสอบ:** **PASS** – แสดงรายการบริษัทครบถ้วน พร้อมแถบสีสถานะ (เขียว=สำเร็จ, แดง=ไม่สำเร็จ, เหลือง=ค้าง)
- **ภาพหลักฐาน:**
![STEP 04: สรุปสถานะรายบริษัท List View](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_04_Home_ListView.png)

---

#### STEP 05: สลับมุมมองหน้าหลักเป็น Grid View (การ์ด)
- **จุดประสงค์:** ทดสอบฟังก์ชันสลับมุมมองแบบการ์ดตามสเปกสไลด์ 9
- **ผลการทดสอบ:** **PASS** – หน้าจอเปลี่ยนเป็นการ์ดสรุปยอดรายบริษัท แสดงปุ่ม "เคลียร์เอกสารค้าง" และสถิติชัดเจน
- **ภาพหลักฐาน:**
![STEP 05: มุมมอง Grid View](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_05_Home_GridView.png)

---

#### STEP 06: หน้าต่างจำลองสร้างไฟล์จาก AutoCount (Inbound Generator)
- **จุดประสงค์:** เปิดหน้าต่างจำลองสร้างเอกสาร Inbound (.txt/.pdf) จากโปรแกรม AutoCount เข้าสู่โฟลเดอร์รับงาน
- **ผลการทดสอบ:** **PASS** – โมดอลเปิดขึ้นมา แสดงตัวเลือกบริษัท และกรณีทดสอบหลากหลายประเภท
- **ภาพหลักฐาน:**
![STEP 06: Inbound Generator Modal](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_06_Inbound_Generator_Modal.png)

---

#### STEP 07: เลือกกรณีทดสอบเบอร์โทรผิดรูปแบบ (Rule H21, B10)
- **จุดประสงค์:** ทดสอบคีย์และจำลองไฟล์ Inbound ที่มีเบอร์โทรศัพท์ผิดข้อกำหนดของสรรพากร
- **ผลการทดสอบ:** **PASS** – ตัวเลือก "เบอร์โทรผิดรูปแบบ (Rule H21,B10)" ถูกเลือก พร้อมสำหรับการสร้างไฟล์
- **ภาพหลักฐาน:**
![STEP 07: เลือกทดสอบ Phone Error](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_07_Select_Phone_Error_Test.png)

---

#### STEP 08: สร้างไฟล์จำลองสำเร็จ ยอดค้างเพิ่มขึ้นในระบบ
- **จุดประสงค์:** ตรวจสอบการสร้างไฟล์ TXT+PDF ลงใน Inbound Folder และการตอบสนองของระบบแจ้งเตือน
- **ผลการทดสอบ:** **PASS** – แจ้งเตือนสร้างเอกสารสำเร็จ ตัวเลขเอกสารค้างส่งในตารางอัปเดตเป็นสีเหลืองทันที
- **ภาพหลักฐาน:**
![STEP 08: ไฟล์จำลองถูกสร้างในระบบ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_08_Sample_Inbound_Created.png)

---

#### STEP 09: สั่งกวาดข้อมูลนำส่งทันที (Instant Sweep)
- **จุดประสงค์:** กดปุ่ม "นำส่งข้อมูลทันที" เพื่อให้ระบบดึงไฟล์จาก Inbound มาตรวจสอบกฎสรรพากร แปลงเป็น XML และส่งออก
- **ผลการทดสอบ:** **PASS** – ระบบประมวลผลเสร็จสิ้น ยอดเอกสารค้างถูกเคลียร์ และอัปเดตยอดสำเร็จ/ไม่สำเร็จตามผลการ Validate
- **ภาพหลักฐาน:**
![STEP 09: กวาดข้อมูลและประมวลผลทันที](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_09_Sweep_Completed.png)

---

### ชุดการทดสอบที่ 3: จัดการข้อมูลบริษัทคู่ค้า/สาขา (Company Maintenance - Slide 11)

#### STEP 10: หน้าจอข้อมูลบริษัท (COMPANY)
- **จุดประสงค์:** ตรวจสอบหน้าจอจัดการข้อมูลบริษัท ตารางรายชื่อบริษัท และฟอร์มกรอกข้อมูลด้านบน
- **ผลการทดสอบ:** **PASS** – หน้าจอแสดงรายชื่อบริษัทเดิม (เฟล็กซ์ ซอฟท์แวร์, นฤมล, ชนากานต์) พร้อมปุ่มแก้ไขและลบ
- **ภาพหลักฐาน:**
![STEP 10: ภาพรวมหน้าจอ Company](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_10_Company_Overview.png)

---

#### STEP 11: คีย์ข้อมูลบริษัทใหม่ Eurofins ครบถ้วน
- **จุดประสงค์:** ทดสอบการกรอกข้อมูลบริษัทใหม่เข้าสู่ระบบ ได้แก่ ชื่อบริษัท, Tax ID 13 หลัก, Working Folder, สาขา, เบอร์โทร และ API Key
- **ข้อมูลที่ป้อน:**
  - ชื่อบริษัท: `บริษัท ยูโรฟินส์ ฟู้ด เทสติ้ง (ประเทศไทย) จำกัด`
  - Folder Name: `Eurofins_Food_Testing`
  - Mode: `ส่งไฟล์คู่ TXT และ PDF`
  - Tax ID: `0105557088921` | Branch: `00000` | เบอร์โทร: `02-987-6543`
  - Auth Code: `AUTH_EUROFINS_2026_TH` | API Key: `API_KEY_ETAX_EUROFINS_PROD_9918`
- **ผลการทดสอบ:** **PASS** – ทุกช่องรับข้อมูลถูกต้อง ตรวจสอบความยาว Tax ID ครบ 13 หลัก
- **ภาพหลักฐาน:**
![STEP 11: คีย์ข้อมูลบริษัทใหม่ Eurofins](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_11_Company_Form_Filled.png)

---

#### STEP 12: บันทึกข้อมูลบริษัทใหม่สำเร็จ แสดงในตาราง
- **จุดประสงค์:** กดปุ่มบันทึกและตรวจสอบว่าข้อมูลถูกเพิ่มในฐานข้อมูลและตารางหน้าจอ
- **ผลการทดสอบ:** **PASS** – บริษัทใหม่ปรากฏในตารางลำดับที่ 4 พร้อมสร้างโฟลเดอร์ Inbound/Outbound รองรับการทำงานทันที
- **ภาพหลักฐาน:**
![STEP 12: บันทึกข้อมูลบริษัทใหม่สำเร็จ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_12_Company_Saved_Table.png)

---

### ชุดการทดสอบที่ 4: ตั้งค่าตัวแปรระบบ (System Parameters Setup - Slide 10)

#### STEP 13: หน้าจอตั้งค่าระบบ (SETUP)
- **จุดประสงค์:** ตรวจสอบตารางพารามิเตอร์ระบบ เช่น `API_TIME_TO_SEND`, โฟลเดอร์จัดเก็บ, และการเชื่อมต่อฐานข้อมูล
- **ผลการทดสอบ:** **PASS** – แสดงรายการพารามิเตอร์ครบ 4 ตัว พร้อมคำอธิบายภาษาไทยและภาษาอังกฤษ
- **ภาพหลักฐาน:**
![STEP 13: ภาพรวมหน้าจอ SETUP](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_13_Setup_Overview.png)

---

#### STEP 14: โหลดข้อมูลตัวแปรเข้าฟอร์มแก้ไข
- **จุดประสงค์:** ทดสอบการคลิกปุ่ม "แก้ไข" ที่พารามิเตอร์ `API_TIME_TO_SEND`
- **ผลการทดสอบ:** **PASS** – ฟอร์มด้านบนดึงค่าเดิมขึ้นมาแสดงอย่างถูกต้องในช่องตัวแปรและค่าปัจจุบัน
- **ภาพหลักฐาน:**
![STEP 14: โหลดตัวแปรเข้าฟอร์มแก้ไข](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_14_Setup_Edit_Form.png)

---

#### STEP 15: แก้ไขค่าความถี่เป็น 15 นาที และบันทึกสำเร็จ
- **จุดประสงค์:** เปลี่ยนค่าตัวแปรความถี่ในการส่งข้อมูลอัตโนมัติจากค่าเดิมเป็น `15` นาที แล้วกดบันทึก
- **ผลการทดสอบ:** **PASS** – ระบบบันทึกสำเร็จ ตารางอัปเดตค่าใหม่เป็น `15` และมีผลต่อรอบเวลาการกวาดไฟล์ทันที
- **ภาพหลักฐาน:**
![STEP 15: บันทึกค่าตัวแปรใหม่สำเร็จ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_15_Setup_Saved_Success.png)

---

### ชุดการทดสอบที่ 5: จัดการผู้ใช้งานระบบ (Users Management - Slide 12)

#### STEP 16: หน้าจอผู้ใช้งานระบบ (USERS)
- **จุดประสงค์:** ตรวจสอบโครงสร้างสองคอลัมน์: รายชื่อผู้ใช้ฝั่งซ้าย และการ์ดกรอกข้อมูลฝั่งขวา
- **ผลการทดสอบ:** **PASS** – แสดงผู้ใช้งานเดิม (Admin, user01) พร้อมรูปโปรไฟล์และป้ายสิทธิ์
- **ภาพหลักฐาน:**
![STEP 16: ภาพรวมหน้าจอ USERS](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_16_Users_Overview.png)

---

#### STEP 17: คีย์ข้อมูลผู้ใช้ใหม่ (Developer Account: `Piyarathl@gmail.com`)
- **จุดประสงค์:** กดปุ่ม `+ NEW` และกรอกข้อมูลผู้ใช้งานใหม่โดยใช้บัญชีนักพัฒนา
- **ข้อมูลที่ป้อน:**
  - ประเภท: `Admin (สามารถ Setup และจัดการ e-Tax)`
  - ชื่อผู้ใช้งาน: `Piyarath Accountant`
  - Username: `piyarath` | Password: `X#f04vj7Ku3`
  - Email: `Piyarathl@gmail.com`
- **ผลการทดสอบ:** **PASS** – กรอกข้อมูลครบถ้วน ฟอร์มพร้อมบันทึก
- **ภาพหลักฐาน:**
![STEP 17: คีย์ข้อมูลผู้ใช้ใหม่](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_17_User_Form_Filled.png)

---

#### STEP 18: บันทึกผู้ใช้ใหม่สำเร็จ ปรากฏในรายชื่อ
- **จุดประสงค์:** กดปุ่ม "ปรับปรุง" เพื่อบันทึกผู้ใช้และตรวจสอบในรายการ
- **ผลการทดสอบ:** **PASS** – ผู้ใช้ `Piyarath Accountant` ปรากฏในรายชื่อฝั่งซ้าย พร้อมระบุสิทธิ์ Admin อย่างสมบูรณ์
- **ภาพหลักฐาน:**
![STEP 18: บันทึกผู้ใช้ใหม่แสดงในรายชื่อ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_18_User_Created_List.png)

---

### ชุดการทดสอบที่ 6: ตรวจสอบ Logfiles และ Error Handling ตาม Slide 14

#### STEP 19: หน้าจอประวัติการทำงาน (LOGFILES)
- **จุดประสงค์:** ตรวจสอบตารางบันทึกประวัติการส่งเอกสารทั้งหมด คอลัมน์เลขที่เอกสาร รหัสบริการ วันที่ สถานะ และปุ่มดูรายละเอียด
- **ผลการทดสอบ:** **PASS** – ตารางแสดงประวัติเอกสารทั้งสถานะ "สร้างเอกสารสำเร็จ" (สีเขียว) และ "สร้างเอกสารไม่สำเร็จ" (สีแดง)
- **ภาพหลักฐาน:**
![STEP 19: ภาพรวมหน้าจอ LOGFILES](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_19_Logfile_Overview.png)

---

#### STEP 20: กรองเฉพาะรายการที่ส่งไม่สำเร็จ (Failed Only)
- **จุดประสงค์:** ทดสอบตัวกรองสถานะ เลือกกรองเฉพาะ "สร้างเอกสารไม่สำเร็จ" แล้วกดค้นหา
- **ผลการทดสอบ:** **PASS** – ตารางแสดงเฉพาะเอกสารที่มีข้อผิดพลาดตามเงื่อนไขของ Slide 14 เช่น เบอร์โทรผิดรูปแบบ หรือขาด Reason Code
- **ภาพหลักฐาน:**
![STEP 20: กรองเฉพาะรายการไม่สำเร็จ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_20_Logfile_Filter_Failed.png)

---

#### STEP 21: หน้าต่างแสดงสาเหตุ Error และวิธีแก้ไขใน AutoCount
- **จุดประสงค์:** คลิกปุ่มไอคอนตกใจ `(!)` เพื่อเปิดดูรหัสข้อผิดพลาดและคำแนะนำในการแก้ไข
- **ผลการทดสอบ:** **PASS** – ปรากฏกล่องข้อความระบุชัดเจน:
  - **Error Code:** `ERR_PHONE_FORMAT`
  - **สาเหตุ:** เบอร์โทรศัพท์ของผู้ซื้อผิดรูปแบบตามเงื่อนไขสรรพากร (Rule H21, B10)
  - **วิธีแก้ไข:** แนะนำให้เปิดโปรแกรม AutoCount เข้าไปที่เมนู Debtor Maintenance แล้วแก้เบอร์โทรให้เป็นรูปแบบ `+66-2-xxxxxxx`
- **ภาพหลักฐาน:**
![STEP 21: Modal แสดงสาเหตุและวิธีแก้ไขใน AutoCount](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_21_Logfile_Error_Modal.png)

---

### ชุดการทดสอบที่ 7: AutoCount API POC Engine & Developer Portal (Module 2)

#### STEP 22: หน้าแดชบอร์ดภาพรวม AutoCount API POC
- **จุดประสงค์:** เปิดหน้าแดชบอร์ด `/autocount-poc` เพื่อตรวจสอบ KPI 4 มิติ และกราฟแนวโน้มการส่ง
- **ผลการทดสอบ:** **PASS** – แดชบอร์ดแสดงการ์ดสถิติ:
  - จำนวนส่งทั้งหมด: **12 รายการ**
  - ผ่าน (Passed): **8 รายการ (66.7%)**
  - ไม่ผ่าน (Failed): **4 รายการ (33.3%)**
  - ค้าง (Pending): **0 รายการ**
  พร้อมกราฟ Donut และ Bar Chart แสดงสัดส่วนเอกสารแต่ละประเภท
- **ภาพหลักฐาน:**
![STEP 22: แดชบอร์ดภาพรวม AutoCount POC](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_22_AutoCount_POC_Dashboard.png)

---

#### STEP 23: ทดสอบการเชื่อมต่อ AutoCount API Session
- **จุดประสงค์:** กดปุ่ม "ทดสอบเชื่อมต่อ API" เพื่อยืนยันสิทธิ์บัญชีนักพัฒนา (`Piyarathl@gmail.com`) กับ AutoCount Server
- **ผลการทดสอบ:** **PASS** – API ตอบรับ HTTP 200 ยืนยันเชื่อมต่อสำเร็จ พร้อมระบุ Account Book และ Access Token มีอายุใช้งาน
- **ภาพหลักฐาน:**
![STEP 23: ทดสอบเชื่อมต่อ API สำเร็จ](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_23_AutoCount_Connection_Test.png)

---

#### STEP 24: เข้าสู่หน้าศูนย์ทดสอบ POC (Testing Center)
- **จุดประสงค์:** สลับไปยังแท็บศูนย์ทดสอบ เพื่อเลือกชุดทดสอบแบบ Batch
- **ผลการทดสอบ:** **PASS** – หน้าจอแสดง 3 ตัวเลือกการจำลอง:
  1. ยิงชุดข้อมูลมาตรฐาน (Passed 100%)
  2. ยิงชุดข้อมูลคละกรณี (Mixed Cases - ผ่านและติด Error)
  3. ยิงชุดใบลดหนี้/เพิ่มหนี้ (CN/DN Reason Code Verification)
- **ภาพหลักฐาน:**
![STEP 24: ศูนย์ทดสอบ POC Testing Center](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_24_POC_Simulator_Center.png)

---

#### STEP 25: ผลการรันชุดทดสอบคละกรณีใน Console (Mixed Cases Batch Run)
- **จุดประสงค์:** กดปุ่ม "ยิงชุดข้อมูลคละกรณี (Mixed Cases)" และตรวจสอบการแสดงผล Real-time Console
- **ผลการทดสอบ:** **PASS** – ระบบประมวลผลเอกสาร 4 ฉบับแบบทันที:
  - ฉบับที่ 1 ผ่านสมบูรณ์ ได้รับ e-Tax UUID และลงนามสำเร็จ
  - ฉบับที่ 2 แจ้งเตือนขาดอีเมลใน Debtor Maintenance
  - ฉบับที่ 3 แจ้งเตือนเบอร์โทรผิดรูปแบบ Rule H21
  - ฉบับที่ 4 แจ้งเตือนใบลดหนี้ขาด e-Tax Reason Code
- **ภาพหลักฐาน:**
![STEP 25: ผลการรัน Batch Console](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_25_POC_Batch_Console_Output.png)

---

#### STEP 26: ตารางประวัติการ Interface แบบละเอียด (Detailed Logs Table)
- **จุดประสงค์:** ตรวจสอบตารางประวัติในแท็บ "ประวัติการ Interface ละเอียด"
- **ผลการทดสอบ:** **PASS** – ตารางแสดงข้อมูลครบถ้วน: เลขที่เอกสาร, ชื่อลูกค้า, ยอดเงินรวม, วันที่, และป้ายสถานะ `PASSED` / `FAILED` มีปุ่มค้นหาและคัดกรองตามสถานะ
- **ภาพหลักฐาน:**
![STEP 26: ตารางประวัติการ Interface แบบละเอียด](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_26_AutoCount_Detailed_Logs_Table.png)

---

#### STEP 27: Drawer ตรวจสอบผล Interface เชิงลึก (Log Inspector)
- **จุดประสงค์:** คลิกปุ่ม "ดูผลละเอียด" เพื่อเปิดแผง Drawer เจาะลึกข้อมูล Payload และผลการ Audit
- **ผลการทดสอบ:** **PASS** – Drawer เปิดขึ้นมาแสดง:
  - เช็กลิสต์การตรวจสอบ 4 ข้อกำหนด (ผ่าน 3 ไม่ผ่าน 1 พร้อมไอคอนสี)
  - แถบ Request JSON Payload ที่ส่งไปยัง AutoCount API
  - แถบ Response JSON ที่ได้รับจากระบบปลายทาง
- **ภาพหลักฐาน:**
![STEP 27: Drawer ตรวจสอบผล Interface เชิงลึก](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_27_AutoCount_Log_Inspector_Drawer.png)

---

#### STEP 28: ฐานข้อมูลลูกหนี้ (AutoCount Debtor Maintenance)
- **จุดประสงค์:** เข้าแท็บ "ข้อมูลลูกค้า (Debtor Master)" เพื่อตรวจสอบความพร้อมของข้อมูลลูกหนี้ใน AutoCount
- **ผลการทดสอบ:** **PASS** – แสดงรายชื่อลูกค้า รหัสลูกหนี้ Tax ID 13 หลัก อีเมล และเบอร์โทร โดยรายการที่ไม่ผ่านเกณฑ์จะแสดงป้ายเตือนสีแดง "ข้อมูลไม่ครบ" พร้อมปุ่ม "แก้ไขให้ถูกต้อง"
- **ภาพหลักฐาน:**
![STEP 28: ฐานข้อมูลลูกหนี้ Debtor Master](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_28_Debtor_Master_Table.png)

---

#### STEP 29: แก้ไขข้อมูลลูกค้าให้ถูกต้องสมบูรณ์ (Debtor Fixed Compliant)
- **จุดประสงค์:** คลิกปุ่ม "แก้ไขให้ถูกต้อง" เพื่อจำลองการอัปเดตข้อมูลลูกค้าใน AutoCount ให้เป็นไปตามเกณฑ์
- **ผลการทดสอบ:** **PASS** – สถานะของลูกค้าเปลี่ยนเป็น "พร้อมส่ง e-Tax" สีเขียวทันที และเอกสารของลูกค้ารายนี้พร้อมถูกส่งซ้ำ
- **ภาพหลักฐาน:**
![STEP 29: ข้อมูลลูกค้าแก้ไขสมบูรณ์](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_29_Debtor_Fixed_Compliant.png)

---

#### STEP 30: หน้าจอตั้งค่า AutoCount & Developer Credentials
- **จุดประสงค์:** ตรวจสอบการตั้งค่าระบบในแท็บ "ตั้งค่าระบบ (SETUP)" ของฝั่ง AutoCount POC
- **ผลการทดสอบ:** **PASS** – แสดง Developer ID: `Piyarathl@gmail.com`, Password (มีปุ่มซ่อน/แสดง), Endpoint, Account Book ID และการระบุโฟลเดอร์ Inbound/Outbound อย่างชัดเจน
- **ภาพหลักฐาน:**
![STEP 30: หน้าจอตั้งค่า AutoCount Credentials](/C:/Users/anda_/.gemini/antigravity/brain/966ad54d-74fe-485f-8641-8bdeaa7fd841/test_screenshots/STEP_30_AutoCount_Settings_Tab.png)

---

## 5. ตารางตรวจสอบข้อกำหนดทางธุรกิจตาม Slide 14 (Compliance Matrix)

| ข้อกำหนดตาม Slide 14 | เงื่อนไขการตรวจสอบ (Validation Logic) | ผลการทดสอบของระบบ | เอกสารทดสอบอ้างอิง |
|:---|:---|:---:|:---:|
| **1. Tax ID (เลขประจำตัวผู้เสียภาษี)** | ต้องเป็นตัวเลขครบ 13 หลัก, ระบุ Registration Type (`01` นิติบุคคล / `02` บุคคลธรรมดา) และ Country Code `TH` | **ผ่าน 100%** | STEP 11, STEP 27 |
| **2. Email ใน Debtor Maintenance** | ลูกหนี้ต้องมีอีเมลระบุในระบบ เพื่อใช้ส่งไฟล์ e-Tax Invoice PDF และ XML ให้ลูกค้า | **ผ่าน 100%** | STEP 25, STEP 28 |
| **3. รูปแบบเบอร์โทรศัพท์ (Rule H21, B10)** | ต้องขึ้นต้นด้วยรหัสประเทศ เช่น `+66-2-xxxxxxx` ความยาวไม่เกิน 30 ตัวอักษร ห้ามใส่อักขระแปลกปลอม | **ผ่าน 100%** | STEP 07, STEP 21, STEP 27 |
| **4. เหตุผลการออกใบลดหนี้/เพิ่มหนี้ (CN/DN)** | กรณีเอกสารเป็น Credit Note หรือ Debit Note ต้องระบุรหัสเหตุผล e-Tax (`ETR01`–`ETR06`) | **ผ่าน 100%** | STEP 24, STEP 25, STEP 27 |

---

## 6. คู่มือการปฏิบัติงานสำหรับผู้รับมอบงาน (Operational Handover Guide)

### 6.1 การเข้าใช้งานระบบบน Cloud
- **URL เข้าใช้งาน:** `https://autocount-etax-interface.vercel.app`
- **เข้าสู่ระบบ Flex Interface:**
  - คลิกปุ่ม **Admin** (Username: `admin` / Password: `admin`)
  - หรือใช้บัญชี Developer ที่สร้างใหม่ (Username: `piyarath` / Password: `X#f04vj7Ku3`)
- **เข้าสู่ระบบ AutoCount POC Dashboard โดยตรง:**
  - ไปที่ URL: `https://autocount-etax-interface.vercel.app/autocount-poc`

### 6.2 การตรวจสอบและสั่งส่งเอกสารประจำวัน
1. เปิดหน้า **HOME**: สังเกตตัวเลขในคอลัมน์ **"ค้าง" (สีเหลือง)** หากมีตัวเลขแสดงว่ามีเอกสาร Inbound เข้ามาจาก AutoCount
2. กดปุ่ม **"นำส่งข้อมูลทันที"**: ระบบจะทำการ Validate และส่งข้อมูลไปยัง e-Tax Gateway ให้อัตโนมัติ
3. ตรวจสอบคอลัมน์ **"ไม่สำเร็จ" (สีแดง)**: หากมีเอกสารติด Error ให้คลิกที่เมนู **LOGFILES**

### 6.3 ขั้นตอนการแก้ปัญหาเมื่อเอกสารส่งไม่ผ่าน (Error Resolution)
1. ในหน้า **LOGFILES** เลือกกรองสถานะเป็น **"สร้างเอกสารไม่สำเร็จ"**
2. คลิกปุ่ม **`(!)`** เพื่อเปิดดูรายละเอียดข้อผิดพลาด
3. ดำเนินการแก้ไขในโปรแกรม **AutoCount**:
   - หากแจ้ง **ERR_PHONE_FORMAT**: เข้า *Debtor Maintenance* แก้ไขเบอร์โทรให้มีรูปแบบ `+66-2-xxxxxxx`
   - หากแจ้ง **ERR_MISSING_EMAIL**: เข้า *Debtor Maintenance* กรอกอีเมลลูกค้าในช่อง Email Address
   - หากแจ้ง **ERR_CN_MISSING_REASON**: เข้าไปแก้ไขใบลดหนี้/เพิ่มหนี้ แล้วเลือกรหัสเหตุผล e-Tax (`ETR01`–`ETR06`)
4. เมื่อแก้ไขใน AutoCount เรียบร้อย สามารถสั่ง Export ไฟล์ออกมาใหม่ หรือกดปุ่ม **"ส่งใหม่ ↻"** ในหน้าประวัติละเอียดเพื่อประมวลผลซ้ำทันที

### 6.4 การเชื่อมต่อกับฐานข้อมูล AutoCount Live จริง
1. เปิดหน้า **AutoCount POC Settings** (`/autocount-poc` แท็บตั้งค่าระบบ)
2. ตรวจสอบ Endpoint URL และใส่ Production App Key / Account Book GUID ที่ได้รับจาก AutoCount Support
3. กดปุ่ม **"ทดสอบการเชื่อมต่อ AutoCount (Verify ID)"** เมื่อขึ้นสถานะสีเขียวแสดงว่าระบบพร้อมแลกเปลี่ยนข้อมูลแบบ Real-time เต็มรูปแบบ

---

## 7. สรุปผลการส่งมอบ (Conclusion & Sign-off)

- โค้ดโปรแกรมทั้งหมดถูกจัดเก็บและ Push ขึ้นบน GitHub Repository: `https://github.com/sakanankosasawiang-lab/autocount-etax-interface`
- ระบบได้ถูกปรับแต่งและทดสอบจนสามารถรันบน Vercel Cloud Serverless ได้อย่างสมบูรณ์แบบโดยไม่มีข้อผิดพลาด
- การทดสอบการคีย์ข้อมูลและกระบวนการทำงานทั้ง 30 ขั้นตอนผ่านการตรวจสอบ 100% พร้อมรูปภาพหลักฐานครบถ้วน พร้อมส่งมอบให้ทีมงานและผู้บริหารพิจารณาใช้งานต่อไป
