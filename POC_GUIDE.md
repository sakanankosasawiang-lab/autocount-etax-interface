# คู่มือระบบ AutoCount Interface & e-Tax Tracking WebApp (POC)

ระบบ Proof of Concept (POC) สำหรับเชื่อมโยงข้อมูลระหว่าง **AutoCount Accounting** และระบบภาษีอิเล็กทรอนิกส์ (**e-Tax Invoice / INET One.th**) พร้อมระบบ **Admin WebApp หลังบ้าน** แสดง Dashboard สรุปผลและประวัติการทำงานแบบละเอียด

---

## 1. ข้อมูลการเชื่อมต่อและการศึกษา AutoCount API

อ้างอิงจาก [AutoCount Resource Center (Programmer Wiki)](https://wiki.autocountsoft.com/wiki/Programmer#tabber-API_Resources):
- **Developer ID:** `Piyarathl@gmail.com`
- **Developer Password:** `X#f04vj7Ku3`
- **API Endpoint:** `https://accounting-api.autocountcloud.com` (AutoCount Cloud REST API / Swagger v1)
- **Account Book ID:** `ACC-TH-EUROFINS-01`
- **รูปแบบการเชื่อมโยง (Integration Methods):**
  1. **Direct REST API / Web Service:** สื่อสารผ่าน REST Endpoints (เช่น `/{accountBookId}/invoice`, `/{accountBookId}/debtor`, `/{accountBookId}/creditnote`)
  2. **AutoCount Plug-In (.app):** สร้างและลงนามโมดูลด้วย AutoCount Plug-In Builder ผ่าน Developer ID
  3. **Inbound / Outbound File Bridge:** กวาดไฟล์ `.pdf & .txt` / `.json` จากโฟลเดอร์ Inbound เข้ามาประมวลผล และส่งออก `.pdf & .xml` (e-Tax Standard) ไปยังโฟลเดอร์ Outbound

---

## 2. กฎการตรวจสอบความถูกต้องของข้อมูล (Validation Rules - Slide 14)

ระบบทำการตรวจสอบข้อมูลตามข้อกำหนดสำคัญของใบกำกับภาษีอิเล็กทรอนิกส์ในสไลด์นำเสนอ (Slide 14):
1. **Debtor Tax ID & Registration Type:**
   - นิติบุคคล (01) หรือ บุคคลธรรมดา (02) ต้องระบุเลขประจำตัว 13 หลักให้ถูกต้อง
   - ต้องระบุรหัสประเทศ (เช่น `TH`)
2. **Debtor Email in Debtor Maintenance:**
   - อีเมลของผู้ซื้อต้องได้รับการบันทึกในระบบ Debtor Maintenance เพื่อใช้จัดส่งใบกำกับภาษี e-Tax
3. **Phone Number Format (กฎ H21, B10):**
   - เบอร์โทรศัพท์ต้องเป็นไปตามฟอร์แมตสากล เช่น `+66-2xxxxxxx` ความยาวไม่เกิน 30 ตัวอักษร
4. **Credit Note (CN) / Debit Note (DN) Reason Code:**
   - ใบลดหนี้และใบเพิ่มหนี้ต้องระบุรหัสเหตุผล e-Tax (`ETR01` ถึง `ETR06`) ทุกเอกสาร

---

## 3. สถาปัตยกรรมและโครงสร้างไฟล์ของโปรเจกต์

```text
C:\Apps\Autocount\
├── backend\
│   ├── main.py              # FastAPI Web Backend & Static Server
│   ├── autocount_client.py  # AutoCount Interface Engine & Validation Rules
│   ├── database.py          # SQLite Storage (Config, Logs, Debtors)
│   └── seed_data.py         # จำลองข้อมูลตั้งต้น 50+ รายการ
├── frontend\
│   └── index.html           # Admin WebApp (Vue 3 + Tailwind CSS + Chart.js)
├── inbound\                 # โฟลเดอร์รับไฟล์ Inbound (.pdf & .txt)
├── outbound\                # โฟลเดอร์ไฟล์ผลลัพธ์ Outbound (.pdf & .xml)
├── autocount_interface.db   # ฐานข้อมูล SQLite จัดเก็บประวัติและสถิติ
├── run_poc_interface.py     # สคริปต์รัน POC ผ่าน Command Line
├── start_server.py          # สคริปต์เปิดรันเซิร์ฟเวอร์ WebApp หลังบ้าน
└── POC_GUIDE.md             # เอกสารคู่มือฉบับนี้
```

---

## 4. วิธีการเปิดใช้งานระบบ WebApp หลังบ้าน

เซิร์ฟเวอร์เปิดทำงานอยู่ที่พอร์ต **8000**:

```bash
# รันเปิดเซิร์ฟเวอร์
python start_server.py
```

- **URL เข้าใช้งาน Dashboard:** [http://localhost:8000](http://localhost:8000)
- **API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 5. ฟังก์ชันเด่นในระบบ Admin WebApp

### 5.1 Dashboard (หน้าหลัก)
- **KPI Summary Cards:**
  - จำนวนที่ส่งทั้งหมด (Total Interfaced)
  - ผ่าน / สำเร็จ (Passed) พร้อมอัตราความสำเร็จ (%)
  - ไม่สำเร็จ (Failed) พร้อมเปอร์เซ็นต์
  - ค้างส่ง / รอดำเนินการ (Pending)
- **Interactive Charts (Chart.js):**
  - กราฟแท่งแนวโน้มรายวัน (Daily Interface Trends) แสดงสัดส่วน ผ่าน vs ไม่ผ่าน
  - กราฟโดนัทแสดงสัดส่วนผลลัพธ์การนำส่ง (Status Distribution)
  - แผนภูมิสาเหตุข้อผิดพลาดที่พบบ่อย (Top Validation Errors)
  - สัดส่วนตามประเภทเอกสาร (Sales Invoice, AR Invoice, Credit Note, Debit Note)

### 5.2 Logfile & Process Tracking (ประวัติการทำงานแบบละเอียด)
- ค้นหาได้ตามเลขที่เอกสาร, ชื่อลูกค้า, หรือรหัส Error
- ตัวกรองสถานะ: **ทั้งหมด**, **ผ่าน (Passed)**, **ไม่ผ่าน (Failed)**, **ค้าง (Pending)**
- แสดงข้อมูลละเอียดระดับเอกสาร: เลขที่เอกสาร, ผู้ซื้อ, ยอดเงินรวม, สถานะ, เวลาที่ใช้
- **ปุ่ม "ดูผลละเอียด":** เปิดหน้าต่าง Drawer/Modal ตรวจสอบ:
  - Checklist การตรวจสอบเงื่อนไข e-Tax 4 ด้าน
  - Request Payload JSON (โครงสร้างข้อมูลที่ส่งเข้า AutoCount)
  - AutoCount Response JSON (ผลลัพธ์ตอบกลับจาก AutoCount พร้อม e-Tax UUID)
  - ปุ่ม **"ลองส่งใหม่ (Retry Interface)"** เพื่อยิงเอกสารซ้ำทันที

### 5.3 POC Testing Center (ห้องทดสอบการ Interface)
- ปุ่มรันชุดข้อมูลทดสอบ 3 รูปแบบ:
  1. **Standard Invoices:** ชุดข้อมูลที่ถูกต้องครบถ้วน (ผ่าน 100%)
  2. **Mixed Scenarios:** ชุดข้อมูลคละกรณีผิด/ถูก เพื่อทดสอบระบบตรวจจับ Error (Slide 14)
  3. **Credit Note & Debit Note:** ทดสอบการตรวจสอบรหัส eTax Reason
- มีกล่องแสดง Console Output สดๆ แสดงเลขที่เอกสาร, สถานะ, AutoCount UUID และ eTax UUID แบบ Real-time

### 5.4 Debtor Master (ข้อมูลลูกค้า)
- ตรวจสอบความพร้อมของข้อมูลลูกค้าใน AutoCount Debtor Maintenance
- มีปุ่ม **"แก้ไขให้ถูกต้อง"** ในกรณีที่ลูกค้าขาดอีเมลหรือเบอร์โทรผิดรูปแบบ เพื่อทดสอบกระบวนการแก้ไขแล้วสั่งส่งใหม่ (Fix & Retry Workflow)

### 5.5 System Configuration (ตั้งค่าระบบ)
- แสดงและแก้ไข Developer ID: `Piyarathl@gmail.com`
- ตั้งค่า Password, API Endpoint, Account Book ID
- ปุ่ม **"ทดสอบการเชื่อมต่อ AutoCount (Verify ID)"** ตรวจสอบสถานะการเชื่อมต่อทันที

---

## 6. การรัน POC ผ่าน Command Line

สามารถรันสคริปต์ POC ผ่าน Terminal เพื่อดูผลลัพธ์ได้ทันทีโดยไม่ต้องเปิดเบราว์เซอร์:

```bash
python run_poc_interface.py
```
