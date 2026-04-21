# 📊 Claribill: E-commerce Fee Analyzer (Public Version)

## 1. Project Overview
Web Application แบบ Static Site สำหรับวิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซ ออกแบบมาเพื่อรันบน GitHub Pages โดยเฉพาะ ใช้โมเดลธุรกิจแบบ "Bring Your Own Key" เพื่อความปลอดภัยสูงสุดของผู้พัฒนา

## 2. ระบบป้องกันความปลอดภัย (Security Gatekeeper)
* **API Key Auth:** ระบบจะมีหน้าต่าง Modal หรือหน้าแรกที่บังคับให้กรอก Google Gemini API Key ก่อนเข้าถึงฟีเจอร์หลัก
* **Local Persistence:** ใช้ `localStorage` ในการบันทึกคีย์ไว้ในเครื่องผู้ใช้ (Client-side only)
* **Session Management:** เมื่อเปิดแอป ระบบจะเช็กก่อนว่ามีคีย์ในเครื่องไหม
    * ถ้าไม่มี -> แสดงหน้า "Setup API Key"
    * ถ้ามี -> ข้ามไปหน้า "Analyzer Dashboard" ทันที
* **Logout/Reset:** มีปุ่มสำหรับลบหรือเปลี่ยน API Key เพื่อความสะดวกของผู้ใช้

## 3. สถาปัตยกรรม (Revised Tech Stack)
* **Framework:** Next.js (Static Export mode) หรือ Vite (React)
* **Deployment:** GitHub Pages
* **Client-side SDK:** `@google/generative-ai` (เรียกใช้ API โดยตรงจาก Browser)
* **Storage:** Browser LocalStorage

## 4. โครงสร้าง UI (UI Logic)
1. **Auth View:** - ช่องกรอก API Key
   - ลิงก์ไปหน้าขอ API Key ฟรี (เพื่อช่วยผู้ใช้ที่ไม่รู้จะหาจากไหน)
   - ปุ่ม "Save & Start"
2. **Main Dashboard:** - ปุ่มอัปโหลดรูปภาพ
   - ส่วนแสดงผลวิเคราะห์ (Cards & Tables)
   - ปุ่ม "Settings" เพื่อกลับไปแก้ไขหรือลบ API Key

## 5. แผนการรันบน GitHub Pages
* ตั้งค่า `next.config.js` ให้เป็น `output: 'export'`
* ใช้ GitHub Action ในการ Deploy โค้ดโดยอัตโนมัติ