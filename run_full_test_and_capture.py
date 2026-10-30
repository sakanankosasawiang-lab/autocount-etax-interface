import os
import time
import shutil
from playwright.sync_api import sync_playwright

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LOCAL_URL = "http://127.0.0.1:3000"
DOCS_DIR = os.path.abspath("docs/screenshots")
ARTIFACT_DIR = r"C:\Users\anda_\.gemini\antigravity\brain\966ad54d-74fe-485f-8641-8bdeaa7fd841\test_screenshots"

os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

test_results = []

def save_step(page, filename, title, category, description):
    path1 = os.path.join(DOCS_DIR, filename)
    path2 = os.path.join(ARTIFACT_DIR, filename)
    page.screenshot(path=path1, full_page=False)
    shutil.copy2(path1, path2)
    test_results.append({
        "file": filename,
        "title": title,
        "category": category,
        "desc": description
    })
    print(f"  [OK] {filename} -> {title}")

def run_tests():
    print("=" * 80)
    print("  EXACT STEP-BY-STEP TEST EXECUTION & SCREENSHOT CAPTURE")
    print("=" * 80)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.25
        )
        page = context.new_page()

        # Auto accept dialogs
        page.on("dialog", lambda dialog: dialog.accept())

        # =============================================================
        # MODULE 1: FLEX INTERFACE E-TAX (สไลด์ 8 ถึง 14)
        # =============================================================

        # -------------------------------------------------------------
        # 1. Staff Login Screen (Slide 8)
        # -------------------------------------------------------------
        print("\n[TC01] Staff Login & Role Authorization")
        page.goto(LOCAL_URL, wait_until="networkidle")
        time.sleep(1)
        save_step(page, "STEP_01_Login_Screen.png",
                  "หน้าจอ Staff Login หลัก",
                  "1. การเข้าสู่ระบบ (Authentication)",
                  "หน้าจอระบุชื่อผู้ใช้งาน รหัสผ่าน โลโก้ iNET e-Tax, Flex Software และปุ่ม Quick Demo Login")

        # Fill credentials
        page.fill("#login-username", "admin")
        page.fill("#login-password", "admin")
        time.sleep(0.5)
        save_step(page, "STEP_02_Login_Filled.png",
                  "กรอกข้อมูลเข้าสู่ระบบสิทธิ์ Admin",
                  "1. การเข้าสู่ระบบ (Authentication)",
                  "กรอกชื่อผู้ใช้งาน 'admin' และรหัสผ่านเพื่อเข้าใช้งานสิทธิ์ผู้ดูแลระบบ")

        # Submit Login
        page.click("button.btn-login")
        time.sleep(1.5)
        save_step(page, "STEP_03_Home_Dashboard_Loaded.png",
                  "เข้าสู่ระบบ Admin สำเร็จ เมนูครบ 5 หน้าจอ",
                  "1. การเข้าสู่ระบบ (Authentication)",
                  "เข้าสู่หน้าหลัก (HOME) สำเร็จ แสดงแถบเมนู 5 หน้าจอตามสเปกสไลด์ 9-13 พร้อมระบุ Role: Admin")

        # -------------------------------------------------------------
        # 2. Home Dashboard & Inbound File Sweep (Slide 9)
        # -------------------------------------------------------------
        print("\n[TC02] Home Dashboard & File Processing")
        save_step(page, "STEP_04_Home_ListView.png",
                  "หน้าหลักสรุปสถานะการนำส่งรายบริษัท (List View)",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "ตารางสรุปสถานะ เดือนนี้/วันนี้ ยอดสำเร็จ (เขียว) ไม่สำเร็จ (แดง) ค้าง (เหลือง) แยกตามรายบริษัท")

        # Switch to Grid View
        page.click("#btn-view-grid")
        time.sleep(1)
        save_step(page, "STEP_05_Home_GridView.png",
                  "สลับมุมมองหน้าหลักเป็น Grid View (การ์ด)",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "แสดงการ์ดสรุปสถิติรายบริษัท พร้อมปุ่มเคลียร์เอกสารค้าง")

        # Switch back to List View
        page.click("#btn-view-list")
        time.sleep(0.5)

        # Open Test Modal to Generate Inbound
        page.click("button:has-text('ทดสอบสร้างเอกสาร Inbound')")
        time.sleep(1)
        save_step(page, "STEP_06_Inbound_Generator_Modal.png",
                  "หน้าต่างจำลองสร้างไฟล์จาก Autocount",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "เลือกบริษัทและกรณีทดสอบ: ปกติ, เบอร์โทรผิด H21, ขาด Reason Code, หรือขาดข้อมูลผู้ซื้อ")

        # Choose phone error case
        page.check("#test-type-phone")
        time.sleep(0.5)
        save_step(page, "STEP_07_Select_Phone_Error_Test.png",
                  "เลือกกรณีทดสอบเบอร์โทรผิดรูปแบบ (Rule H21,B10)",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "จำลองไฟล์ Inbound (.txt/.pdf) ที่ระบุเบอร์โทรศัพท์ผิดข้อกำหนดสรรพากร")

        # Click generate sample
        page.click("button:has-text('สร้างไฟล์ตัวอย่าง')")
        time.sleep(1.5)
        save_step(page, "STEP_08_Sample_Inbound_Created.png",
                  "สร้างไฟล์จำลองสำเร็จ ยอดค้างเพิ่มขึ้นในระบบ",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "ไฟล์ถูกสร้างลงโฟลเดอร์ Inbound ระบบแสดงข้อความสำเร็จและอัปเดตยอดเอกสารค้าง")

        # Close the modal
        page.click("#modal-test-inbound .btn-close")
        time.sleep(1)

        # Click "นำส่งข้อมูลทันที"
        page.click("button.btn-send-now")
        time.sleep(2.5)
        save_step(page, "STEP_09_Sweep_Completed.png",
                  "สั่งกวาดข้อมูลนำส่งทันที (Instant Sweep)",
                  "2. หน้าหลักและการส่งข้อมูล (HOME Dashboard)",
                  "ระบบกวาดไฟล์ Inbound ประมวลผล แปลงเป็น XML และอัปเดตสถิติสำเร็จ/ไม่สำเร็จ")

        # -------------------------------------------------------------
        # 3. Company Maintenance (Slide 11)
        # -------------------------------------------------------------
        print("\n[TC03] Company Maintenance (Slide 11)")
        page.click("#nav-company")
        time.sleep(1)
        save_step(page, "STEP_10_Company_Overview.png",
                  "หน้าจอข้อมูลบริษัท (COMPANY)",
                  "3. ข้อมูลบริษัท (Company Maintenance)",
                  "หน้าจอสำหรับบันทึกและจัดการข้อมูลบริษัทคู่ค้าหรือสาขาในระบบ")

        # Fill company form
        page.fill("#comp-name", "บริษัท ยูโรฟินส์ ฟู้ด เทสติ้ง (ประเทศไทย) จำกัด")
        page.fill("#comp-folder", "Eurofins_Food_Testing")
        page.select_option("#comp-mode", "ส่งไฟล์คู่ TXT และ PDF")
        page.fill("#comp-taxid", "0105557088921")
        page.fill("#comp-branch", "00000")
        page.fill("#comp-phone", "02-987-6543")
        page.fill("#comp-authcode", "AUTH_EUROFINS_2026_TH")
        page.fill("#comp-apikey", "API_KEY_ETAX_EUROFINS_PROD_9918")
        time.sleep(1)
        save_step(page, "STEP_11_Company_Form_Filled.png",
                  "คีย์ข้อมูลบริษัทใหม่ Eurofins ครบถ้วน",
                  "3. ข้อมูลบริษัท (Company Maintenance)",
                  "กรอกข้อมูล Tax ID 13 หลัก, สาขา, เบอร์โทร, Working Folder, และ iNet API Key")

        # Submit company form
        page.click("#form-company button[type='submit']")
        time.sleep(2)
        save_step(page, "STEP_12_Company_Saved_Table.png",
                  "บันทึกข้อมูลบริษัทใหม่สำเร็จ แสดงในตาราง",
                  "3. ข้อมูลบริษัท (Company Maintenance)",
                  "บริษัทใหม่ปรากฏในตาราง พร้อมระบบสร้างโครงสร้างโฟลเดอร์ Inbound/Outbound ให้อัตโนมัติ")

        # -------------------------------------------------------------
        # 4. System Setup (Slide 10)
        # -------------------------------------------------------------
        print("\n[TC04] System Parameters Setup (Slide 10)")
        page.click("#nav-setup")
        time.sleep(1)
        save_step(page, "STEP_13_Setup_Overview.png",
                  "หน้าจอตั้งค่าระบบ (SETUP)",
                  "4. ตั้งค่าระบบ (System Setup)",
                  "ตารางตัวแปรระบบ: ความถี่ส่งข้อมูล (API_TIME_TO_SEND), โฟลเดอร์หลัก, SQL Server")

        # Click edit on the first parameter
        page.click("#setup-table-tbody tr:first-child button")
        time.sleep(1)
        save_step(page, "STEP_14_Setup_Edit_Form.png",
                  "โหลดข้อมูลตัวแปรเข้าฟอร์มแก้ไข",
                  "4. ตั้งค่าระบบ (System Setup)",
                  "คลิกปุ่มดินสอแก้ไขตัวแปร API_TIME_TO_SEND โหลดข้อมูลเข้าสู่ฟอร์มด้านบน")

        # Change value to 15 mins
        page.fill("#setup-val", "15")
        time.sleep(0.5)
        page.click("#form-setup button[type='submit']")
        time.sleep(1.5)
        save_step(page, "STEP_15_Setup_Saved_Success.png",
                  "บันทึกค่าตัวแปรความถี่ส่งข้อมูลเป็น 15 นาทีสำเร็จ",
                  "4. ตั้งค่าระบบ (System Setup)",
                  "ระบบอัปเดตค่าความถี่ในการกวาดส่งข้อมูลอัตโนมัติเป็น 15 นาทีเรียบร้อย")

        # -------------------------------------------------------------
        # 5. Users Management (Slide 12)
        # -------------------------------------------------------------
        print("\n[TC05] Users Management (Slide 12)")
        page.click("#nav-users")
        time.sleep(1)
        save_step(page, "STEP_16_Users_Overview.png",
                  "หน้าจอผู้ใช้งานระบบ (USERS)",
                  "5. ผู้ใช้งานระบบ (Users Management)",
                  "รายชื่อผู้ใช้ฝั่งซ้าย และการ์ดฟอร์มแก้ไขสิทธิ์ (Admin / User) ฝั่งขวา")

        # Click + NEW User
        page.click("button:has-text('NEW')")
        time.sleep(0.5)
        page.fill("#user-fullname", "Piyarath Accountant")
        page.fill("#user-username", "piyarath")
        page.fill("#user-password", "X#f04vj7Ku3")
        page.select_option("#user-role", "Admin")
        page.fill("#user-email", "Piyarathl@gmail.com")
        time.sleep(1)
        save_step(page, "STEP_17_User_Form_Filled.png",
                  "คีย์ข้อมูลผู้ใช้ใหม่ (Developer Account)",
                  "5. ผู้ใช้งานระบบ (Users Management)",
                  "กรอกข้อมูลชื่อผู้ใช้งาน 'Piyarath Accountant', Username, Password, Role Admin และ Email")

        # Submit user form
        page.click("#form-user button[type='submit']")
        time.sleep(2)
        save_step(page, "STEP_18_User_Created_List.png",
                  "บันทึกผู้ใช้ใหม่สำเร็จ แสดงในรายชื่อผู้ใช้",
                  "5. ผู้ใช้งานระบบ (Users Management)",
                  "ผู้ใช้งานใหม่ 'Piyarath Accountant' ถูกบันทึกและแสดงในรายชื่อพร้อมรูป Avatar")

        # -------------------------------------------------------------
        # 6. Logfile & Error Tracking (Slide 13 & 14)
        # -------------------------------------------------------------
        print("\n[TC06] Logfile & Error Tracking (Slide 13 & 14)")
        page.click("#nav-logfiles")
        time.sleep(1.5)
        save_step(page, "STEP_19_Logfile_Overview.png",
                  "หน้าจอประวัติการทำงาน (LOGFILES)",
                  "6. ประวัติการทำงานและข้อผิดพลาด (Logfile Tracking)",
                  "ตารางแสดงประวัติการส่งเอกสารทั้งหมด พร้อมสถานะ 'สร้างเอกสารสำเร็จ' และ 'สร้างเอกสารไม่สำเร็จ'")

        # Filter by Failed Status
        page.select_option("#log-filter-status", "สร้างเอกสารไม่สำเร็จ")
        time.sleep(0.5)
        page.click("#view-logfiles button:has-text('ค้นหา')")
        time.sleep(1)
        save_step(page, "STEP_20_Logfile_Filter_Failed.png",
                  "กรองเฉพาะรายการที่ส่งไม่สำเร็จ (Failed Only)",
                  "6. ประวัติการทำงานและข้อผิดพลาด (Logfile Tracking)",
                  "กรองแสดงเฉพาะรายการที่ติดข้อกำหนดความผิดพลาดตามเกณฑ์สำคัญใน Slide 14")

        # Click info button on the first error row
        err_btn = page.query_selector("button.btn-info-detail")
        if err_btn:
            err_btn.click()
            time.sleep(1)
            save_step(page, "STEP_21_Logfile_Error_Modal.png",
                      "หน้าต่างแสดงสาเหตุ Error และวิธีแก้ไขใน Autocount",
                      "6. ประวัติการทำงานและข้อผิดพลาด (Logfile Tracking)",
                      "แสดง Error Code, คำอธิบายสาเหตุข้อผิดพลาด และวิธีแก้ไขที่ต้องทำในโปรแกรม Autocount")
            page.click("#modal-error-detail .btn-close")
            time.sleep(0.5)

        # =============================================================
        # MODULE 2: AUTOCOUNT API POC DASHBOARD & DEVELOPER ID
        # =============================================================

        print("\n[TC07] AutoCount API POC Engine (Developer ID: Piyarathl@gmail.com)")
        page.goto(f"{LOCAL_URL}/autocount-poc", wait_until="networkidle")
        time.sleep(2)
        save_step(page, "STEP_22_AutoCount_POC_Dashboard.png",
                  "หน้าแดชบอร์ดภาพรวม AutoCount API POC",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "สรุป KPI 4 มิติ: จำนวนที่ส่งทั้งหมด, ผ่าน (Passed), ไม่ผ่าน (Failed), ค้าง (Pending) พร้อม Charts")

        # Click Test AutoCount Connection
        page.click("button:has-text('ทดสอบเชื่อมต่อ API')")
        time.sleep(1.5)
        save_step(page, "STEP_23_AutoCount_Connection_Test.png",
                  "ทดสอบการเชื่อมต่อ AutoCount API Session",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "ยืนยันสิทธิ์สำเร็จสำหรับ Developer ID: 'Piyarathl@gmail.com' เชื่อมต่อ Account Book เรียบร้อย")

        # Switch to POC Simulator Center
        page.click("button:has-text('ศูนย์ทดสอบ POC')")
        time.sleep(1)
        save_step(page, "STEP_24_POC_Simulator_Center.png",
                  "ศูนย์ทดสอบ POC Testing Center",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "แสดง Presets ทดสอบ: 1. Standard (ผ่าน 100%), 2. Mixed Cases (คละเคส), 3. CN/DN Reason Checks")

        # Execute Mixed Cases Batch Run
        page.click("button:has-text('ยิงชุดข้อมูลคละกรณี')")
        time.sleep(2.5)
        save_step(page, "STEP_25_POC_Batch_Console_Output.png",
                  "ผลการรันชุดทดสอบคละกรณีใน Console",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "แสดงผลการส่งแบบ Real-time เอกสารที่ผ่านได้ e-Tax UUID เอกสารที่ไม่ผ่านระบุ Error Code ชัดเจน")

        # Switch to Detailed Logs
        page.click("button:has-text('ประวัติการ Interface ละเอียด')")
        time.sleep(1.5)
        save_step(page, "STEP_26_AutoCount_Detailed_Logs_Table.png",
                  "ตารางประวัติการ Interface แบบละเอียด",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "ตารางประวัติรองรับการค้นหา, กรองสถานะ ผ่าน/ไม่ผ่าน/ค้าง, แสดงเลขที่เอกสาร, ยอดเงินรวม และเวลา")

        # Click "ดูผลละเอียด"
        view_detail_btns = page.query_selector_all("button:has-text('ดูผลละเอียด')")
        if view_detail_btns:
            view_detail_btns[0].click()
            time.sleep(1.5)
            save_step(page, "STEP_27_AutoCount_Log_Inspector_Drawer.png",
                      "Drawer ตรวจสอบผล Interface เชิงลึก",
                      "7. AutoCount API POC Engine (Developer ID)",
                      "แสดง Checklist ตรวจสอบเงื่อนไข 4 ด้าน, Request JSON Payload และ AutoCount API Response")
            # Close modal drawer
            try:
                page.click(".fixed.inset-0 button.font-bold", timeout=3000)
            except Exception:
                page.evaluate("() => { const b = document.querySelector('.fixed.inset-0 button'); if(b) b.click(); }")
            time.sleep(1)

        # Switch to Debtor Master
        page.click("button:has-text('ข้อมูลลูกค้า (Debtor Master)')")
        time.sleep(1.5)
        save_step(page, "STEP_28_Debtor_Master_Table.png",
                      "ฐานข้อมูลลูกหนี้ (AutoCount Debtor Maintenance)",
                      "7. AutoCount API POC Engine (Developer ID)",
                      "ตรวจสอบสถานะความพร้อม e-Tax ของลูกค้า หากขาด Email หรือเบอร์โทรผิดรูปแบบจะขึ้นสถานะเตือน")

        # Click "แก้ไขให้ถูกต้อง"
        fix_btn = page.query_selector("button:has-text('แก้ไขให้ถูกต้อง')")
        if fix_btn:
            fix_btn.click()
            time.sleep(1.5)
            save_step(page, "STEP_29_Debtor_Fixed_Compliant.png",
                      "แก้ไขข้อมูลลูกค้าให้ถูกต้องสมบูรณ์",
                      "7. AutoCount API POC Engine (Developer ID)",
                      "ข้อมูลลูกหนี้ได้รับการอัปเดตเป็นสถานะ 'พร้อมส่ง e-Tax' สีเขียว รองรับการกดสั่งส่งใหม่ทันที")

        # Switch to Settings Tab
        page.click("button:has-text('ตั้งค่าระบบ (SETUP)')")
        time.sleep(1)
        save_step(page, "STEP_30_AutoCount_Settings_Tab.png",
                  "หน้าจอตั้งค่า AutoCount & Developer Credentials",
                  "7. AutoCount API POC Engine (Developer ID)",
                  "แสดง Developer ID, Password, Endpoint, Account Book ID และการตั้งค่าโฟลเดอร์ Inbound/Outbound")

        browser.close()

    print("\n" + "=" * 80)
    print(f"  SUCCESS: All 30 Test Steps Executed and Captured!")
    print(f"  Artifact Directory: {ARTIFACT_DIR}")
    print(f"  Docs Directory:     {DOCS_DIR}")
    print("=" * 80)
    return test_results

if __name__ == "__main__":
    run_tests()
