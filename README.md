# Flex Interface e-Tax (Autocount >> iNet e-Tax One.th)

ระบบเว็บแอปพลิเคชัน (Web Application) สำหรับเชื่อมต่อและจัดการนำส่งใบกำกับภาษีอิเล็กทรอนิกส์ระหว่าง **Autocount Accounting** และ **iNet e-Tax One.th** พัฒนาขึ้นตามสเปกและหน้าจอใน **"กรอบแดง" (Red Box)** ของไฟล์เอกสาร `Interfce e-Tax-Eurofin.pptx` (Slide 3 ถึง 14)

---

## 🌟 ภาพรวมระบบตามกรอบแดงใน Presentation (Slide 3 & 4)

ระบบ **Flex Interface e-Tax** ทำหน้าที่เป็นตัวกลาง (Middleware) ในการเชื่อมต่อข้อมูล:
1. **Autocount (Step 1):** จัดทำเอกสารใบกำกับภาษี รูปแบบ `.pdf` และ `.txt` ลงในโฟลเดอร์ `Inbound` ของแต่ละบริษัท (โดยวิธี Print 1 by 1 หรือ Batch Export eTax)
2. **Interface e-Tax Process (Step 2 - กรอบแดง):** ทำการกวาดข้อมูลจากโฟลเดอร์ Inbound ตามรอบเวลาอัตโนมัติ (`API_TIME_TO_SEND`) หรือกดปุ่ม **"นำส่งข้อมูลทันที"** พร้อมตรวจสอบความถูกต้องของข้อมูลตามข้อกำหนดสรรพากร
3. **Outbound to iNet (Step 3):** แปลงข้อมูลเป็น `.xml` (มาตรฐาน e-Tax Invoice) และส่งมอบคู่กับ `.pdf` ไปยังระบบ **iNet e-Tax One.th**
4. **Process Tracking (Step 4):** บันทึกประวัติ ติดตามสถานะการส่ง (สำเร็จ / ไม่สำเร็จ / ค้าง) และแสดงรายงานความผิดพลาด (Error Details)

---

## 🖥️ หน้าจอและฟังก์ชันการทำงานที่พัฒนาขึ้น (ครอบคลุม Slide 8 - 14)

### 1. หน้าจอ Login ระบบ (STAFFS LOGIN - Slide 8)
- โลโก้และแบรนดิ้ง **iNET e-Tax INTERFACE** และ **Flex SOFTWARE**
- ระบบพิสูจน์ตัวตนแยกสิทธิ์การใช้งาน (Admin / User)
- มีปุ่ม **Quick Demo Login** เพื่อความสะดวกในการทดสอบ

### 2. หน้าหลัก (HOME Dashboard - Slide 9)
- ปุ่ม **"นำส่งข้อมูลทันที"** (Instant Send / Manual Sweep) เพื่อสั่งประมวลผลไฟล์ใน Inbound ทันที
- ปุ่ม **"ทดสอบสร้างเอกสาร Inbound"** สำหรับจำลองไฟล์จาก Autocount เข้าระบบเพื่อทดสอบ
- สลับมุมมองแสดงผลได้ 2 แบบ: **List View (ตาราง)** และ **Grid View (การ์ด)**
- ตารางสรุปสถานะการนำส่งประจำวันและประจำเดือนของแต่ละบริษัท:
  - **เดือนนี้ / วันนี้:** แสดงจำนวนเอกสารทั้งหมด
  - **สำเร็จ (สีเขียว):** เอกสารที่ส่งผ่านสมบูรณ์
  - **ไม่สำเร็จ (สีแดง):** เอกสารที่ติดเงื่อนไขความผิดพลาด
  - **ค้าง (สีเหลือง):** เอกสารใน Inbound ที่รอรอบการส่ง
  - **ล้างเอกสาร:** ปุ่มสำหรับล้างรายการเอกสารค้างของบริษัท

### 3. ตั้งค่าระบบ (SETUP - Slide 10)
- หน้าจัดการตัวแปรระบบ (System Parameters):
  - `API_TIME_TO_SEND`: ความถี่ในการส่งข้อมูลอัตโนมัติ (นาที)
  - `MAIN_DOCUMENT_FOLDER`: โฟลเดอร์หลักของระบบ (เช่น `C:/Apps/Autocount/etax_data`)
  - `SEARCH_LIMIT`: จำนวนวันสูงสุดในการค้นหาข้อมูล (วัน)
  - `SQLSV_SERVER`: SQL เซอร์เว่อร์ (เช่น `ROSSI\A2006`)
  - `SQLSV_USERNAME`: SQL ชื่อเข้าใช้งาน
  - `SQLSV_PASSWORD`: SQL รหัสผ่าน
- ฟอร์มเพิ่ม/แก้ไขตัวแปร พร้อมปุ่ม **รีโหลด**

### 4. ข้อมูลบริษัท (COMPANY - Slide 11)
- จัดการข้อมูลบริษัทคู่ค้าหรือสาขาในระบบ:
  - ชื่อบริษัท, เลขประจำตัวผู้เสียภาษี (13 หลัก), สาขา, เบอร์โทร
  - โฟลเดอร์สำหรับทำงาน (Working Folder)
  - รูปแบบการส่ง: ส่งไฟล์คู่ TXT และ PDF / ส่งเฉพาะ TXT / ส่งเฉพาะ PDF
  - Authorization Code และ API Key ของ iNet
- **ระบบสร้างโฟลเดอร์อัตโนมัติ:** เมื่อเพิ่มบริษัท ระบบจะสร้างโครงสร้างโฟลเดอร์ `inbound`, `outbound`, `history` ให้อัตโนมัติทันที

### 5. ผู้ใช้งานระบบ (USERS - Slide 12)
- ฝั่งซ้าย: รายชื่อผู้ใช้ พร้อมปุ่ม **+ NEW** และปุ่มลบ
- ฝั่งขวา: การ์ดแก้ไขข้อมูลผู้ใช้ (EDIT)
  - ประเภท: **Admin** (สามารถ Setup และจัดการ e-Tax) หรือ **User** (จัดการนำส่ง e-Tax เท่านั้น)
  - ชื่อผู้ใช้งาน (Staff Name), Username, Password, Email, รูปโปรไฟล์
  - ปุ่ม **ปรับปรุง** และ **ยกเลิก**

### 6. ประวัติการทำงาน (LOGFILES / Tracking - Slide 13 & 14)
- ตัวกรองค้นหาละเอียด:
  - บริษัท (เลือกรายบริษัท หรือ ทั้งหมด)
  - สถานะ (ทั้งหมด / สร้างเอกสารสำเร็จ / สร้างเอกสารไม่สำเร็จ)
  - ช่วงวันที่ (วันที่ส่งเอกสาร จากวันที่ - ถึงวันที่)
  - ช่องค้นหาด่วน (Search เลขที่เอกสาร)
- ตารางแสดงรายการ: ลำดับ, เลขที่เอกสาร, Service Code (`S06`), วันที่ส่ง, สถานะ
- **Modal แสดงรายละเอียด Error (Slide 14):** เมื่อคลิกไอคอน `(i)` สีแดง ระบบจะเปิดหน้าต่างแจกแจงสาเหตุและข้อผิดพลาดตามเกณฑ์สรรพากร:
  - เบอร์โทรศัพท์ผิด Format (H21,B10)
  - เอกสาร DN / CN ขาดรหัส eTax Reason
  - ข้อมูลผู้ซื้อขาด Registration Type หรือ Country Code
  - ขาด Email ผู้ซื้อใน Debtor Maintenance
  - พร้อมคำแนะนำวิธีแก้ไขในระบบ Autocount

### 7. โครงสร้างสถาปัตยกรรม (Architecture Modal)
- มีเมนู **"โครงสร้างระบบ (กรอบแดง)"** บน Navbar ที่เปิดไดอะแกรมขั้นตอน 1-2-3-4 จาก Slide 3 & Slide 4 ให้ผู้ใช้งานเข้าใจภาพรวมได้ทันที

---

## 🚀 วิธีการติดตั้งและรันเว็บแอปพลิเคชัน

### วิธีที่ 1: ดับเบิลคลิกเปิดไฟล์
ดับเบิลคลิกที่ไฟล์ **`start.bat`** ในโฟลเดอร์ `c:\Apps\Autocount`
ระบบจะทำการเปิดเซิร์ฟเวอร์และเปิดเบราว์เซอร์ไปยัง `http://localhost:3000` โดยอัตโนมัติ

### วิธีที่ 2: รันผ่าน Terminal / PowerShell
```powershell
cd c:\Apps\Autocount
node server.js
```
จากนั้นเปิดเบราว์เซอร์ไปที่: **http://localhost:3000**

---

## 🔑 บัญชีเข้าสู่ระบบสำหรับทดสอบ (Demo Accounts)

| Username | Password | Role | สิทธิ์การใช้งาน |
| :--- | :--- | :--- | :--- |
| **admin** | **admin** | Admin | เข้าได้ทุกหน้า (Setup, Company, Users, Logs, Home) |
| **arther** | **password123** | Admin | เข้าได้ทุกหน้า |
| **user1** | **user123** | User | เข้าได้เฉพาะหน้าหลัก (Home) และประวัติการทำงาน (Logs) |

*(หรือคลิกปุ่ม Quick Demo Login ในหน้าแรกเพื่อเข้าสู่ระบบได้ทันที)*

---

## 🚀 การ Deploy ขึ้น Vercel (Vercel Deployment)

โปรเจกต์นี้ได้รับการคอนฟิกไฟล์ `vercel.json` และ `api/index.js` พร้อมใช้งานบน **Vercel** เรียบร้อยแล้ว:

1. **Import repository เข้า Vercel:**
   - ไปที่ [Vercel Dashboard](https://vercel.com/dashboard) -> คลิก **"Add New..."** -> **"Project"**
   - เลือก Repository: `sakanankosasawiang-lab/autocount-etax-interface`
   - Framework Preset: **Other** (หรือ Express / Node.js)
   - Root Directory: `./`
2. **คลิก Deploy:**
   - Vercel จะ build และ deploy ระบบขึ้น Cloud อัตโนมัติทันที
   - รองรับทั้งหน้า **Flex Interface e-Tax** (`/`) และ **AutoCount API POC Dashboard** (`/autocount-poc`)
   - ระบบฐานข้อมูลและโฟลเดอร์ Inbound/Outbound จะสลับไปใช้ `/tmp` ในสภาพแวดล้อม Serverless อัตโนมัติ

---

## 📁 โครงสร้างโฟลเดอร์ของระบบ

```
c:\Apps\Autocount\
├── etax_data\                      <-- โฟลเดอร์หลักจัดเก็บเอกสาร e-Tax
│   ├── Flex_Software\
│   │   ├── inbound\                <-- ไฟล์ .pdf & .txt จาก Autocount
│   │   ├── outbound\               <-- ไฟล์ .xml & .pdf ที่ส่งไป iNet
│   │   └── history\                <-- ประวัติไฟล์ที่ประมวลผลแล้ว
│   ├── Narumon\
│   ├── Number_two_services\
│   └── sahasart\
├── data\
│   └── database.json               <-- ฐานข้อมูลระบบ (JSON Store)
├── public\                         <-- Frontend Web Application
│   ├── assets\                     <-- ภาพโลโก้ e-Tax, Login Hero, Avatar
│   ├── css\style.css               <-- สไตล์ตรงตามสไลด์นำเสนอ
│   ├── js\app.js                   <-- ตรรกะการทำงานฝั่งผู้ใช้
│   └── index.html                  <-- หน้าเว็บหลัก SPA
├── server\                         <-- Backend Node.js Engine
│   ├── database.js                 <-- ระบบจัดการฐานข้อมูล
│   ├── processor.js                <-- ตรวจสอบไฟล์, แปลง XML, กวาด Inbound
│   ├── scheduler.js                <-- ตัวนับเวลากวาดข้อมูลอัตโนมัติ
│   └── routes.js                   <-- API Endpoints
├── server.js                       <-- จุดเริ่มต้นเซิร์ฟเวอร์
├── start.bat                       <-- ไฟล์เปิดโปรแกรม 1-Click
└── Interfce e-Tax-Eurofin.pptx     <-- ไฟล์ Presentation ต้นแบบ
```
