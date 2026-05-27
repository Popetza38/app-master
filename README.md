# ระบบบริหารจัดการวัสดุสิ้นเปลืองและครุภัณฑ์

ระบบจัดการวัสดุสิ้นเปลืองและทะเบียนครุภัณฑ์ รองรับ Workflow การเบิก-รับ อนุมัติ รายงาน และ QR Code  
**Frontend**: GitHub Pages (Static HTML/CSS/JS)  
**Backend**: Google Apps Script + Google Sheets

---

## โครงสร้างไฟล์

| ไฟล์ | บทบาท |
|------|-------|
| `index.html` | หน้าเว็บหลัก (login + app shell + sidebar) |
| `app.js` | Frontend logic ทั้งหมด (routing, UI, API calls) |
| `api.js` | ตัวเรียก Google Apps Script API |
| `mock-api.js` | Fallback offline (localStorage) กรณี GAS ไม่ตอบสนอง |
| `styles.css` | CSS เพิ่มเติม (custom components) |
| `sw.js` | Service Worker สำหรับ cache offline |
| `code.gs` | Google Apps Script Backend (deploy แยกต่างหาก) |

---

## วิธีติดตั้ง (Step by Step)

### ขั้นที่ 1 — ติดตั้ง Google Apps Script (Backend)

1. ใน Google Sheets → เมนู **ส่วนขยาย** → **Apps Script**
2. ลบโค้ดเดิมทิ้งทั้งหมด
3. คัดลอกเนื้อหาจากไฟล์ `code.gs` ในโปรเจคนี้ → วางลงใน Apps Script Editor
4. กด **บันทึก** (💾)
5. คลิกเมนู **Deploy** → **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. กด **Deploy** → คัดลอก **Web app URL** ที่ได้  
   ตัวอย่าง: `https://script.google.com/macros/s/XXXXXXXXXX/exec`

> ⚠️ ทุกครั้งที่แก้ไข `code.gs` ต้อง Deploy ใหม่ (New version) จึงจะมีผล

---

### ขั้นที่ 2 — ตั้งค่า URL ใน Frontend

1. เปิดไฟล์ `api.js`
2. แก้ไขบรรทัด:
   ```js
   var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXXXX/exec';
   ```
   เปลี่ยน `XXXXXXXXXX` เป็น Web app URL ที่ได้จากขั้นที่ 1

---

### ขั้นที่ 3 — Deploy Frontend บน GitHub Pages

1. สร้าง Repository ใหม่บน [GitHub](https://github.com) (หรือใช้ที่มีอยู่)
2. Push ไฟล์ทั้งหมด (**ยกเว้น** `code.gs` ไม่จำเป็นต้อง push แต่ไม่มีผลเสีย):
   ```bash
   git init
   git add .
   git commit -m "Initial deploy"
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
3. ไปที่ GitHub Repository → **Settings** → **Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` / Folder: `/ (root)` → กด **Save**
6. รอ 1-2 นาที → URL จะแสดงเป็น:  
   `https://<username>.github.io/<repo-name>/`

---

### ขั้นที่ 4 — เข้าใช้งานครั้งแรก

เปิด URL จาก GitHub Pages แล้วเข้าสู่ระบบด้วยบัญชีเริ่มต้น:

| บัญชี | รหัสผ่าน | สิทธิ์ |
|-------|---------|--------|
| `admin` | `123456` | ผู้ดูแลระบบ (เข้าถึงทุกเมนู) |
| `staff` | `123456` | เจ้าหน้าที่คลัง |
| `employee` | `123456` | พนักงาน (เบิกวัสดุ) |

> ⚠️ **ควรเปลี่ยนรหัสผ่านทันทีหลังเข้าครั้งแรก** ผ่านเมนู โปรไฟล์ → เปลี่ยนรหัสผ่าน

---

### ขั้นที่ 5 — ตั้งค่าระบบ (แนะนำทำก่อนใช้งาน)

เข้าเมนู **ตั้งค่า** แล้วกรอกข้อมูลต่อไปนี้:

| รายการ | คำอธิบาย |
|--------|---------|
| ชื่อระบบ | ชื่อที่แสดงบน header และ QR |
| โลโก้ | รูปโลโก้องค์กร |
| ชื่อองค์กร | แสดงในทะเบียนคุมสินทรัพย์ |
| Telegram Bot Token | สำหรับแจ้งเตือนการเบิก (ถ้ามี) |
| Telegram Chat ID | ID กลุ่ม/ช่องที่ต้องการรับแจ้งเตือน |
| จำนวนขั้นต่ำ | เกณฑ์แจ้งเตือนสต็อกต่ำ (default: 5) |

---

## การตั้งค่า Telegram แจ้งเตือน (ไม่บังคับ)

1. สร้าง Bot ผ่าน [@BotFather](https://t.me/BotFather) → ได้ **Bot Token**
2. เพิ่ม Bot เข้ากลุ่ม LINE หรือ Telegram
3. หา **Chat ID** โดยเปิด `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. กรอก Token และ Chat ID ในหน้า **ตั้งค่า** → กด **ทดสอบ** เพื่อยืนยัน

---

## ฟีเจอร์ทั้งหมด

### วัสดุสิ้นเปลือง
- [x] Dashboard ภาพรวม + กราฟสถิติ
- [x] จัดการรายการวัสดุ (CRUD + รูปภาพ)
- [x] สต็อกคงเหลือ (Card / Table view)
- [x] รับวัสดุเข้าคลัง
- [x] เบิกวัสดุ + Workflow อนุมัติ
- [x] QR Code สติ๊กเกอร์ (พิมพ์ได้)
- [x] QR Scanner ด้วยกล้อง
- [x] รายงานรายเดือน + ตรวจสอบพัสดุประจำปี
- [x] Export Excel

### ครุภัณฑ์
- [x] ทะเบียนครุภัณฑ์ (CRUD)
- [x] ตารางค่าเสื่อมราคาอัตโนมัติ
- [x] ประวัติการซ่อมบำรุง
- [x] สถานะครุภัณฑ์ (ใช้งาน/ชำรุด/จำหน่าย)
- [x] พิมพ์ทะเบียนคุมสินทรัพย์รายตัว + QR
- [x] หน้าสาธารณะดูรายละเอียดจาก QR Scan

### ระบบ
- [x] Login / Logout / ลืมรหัสผ่าน
- [x] จัดการผู้ใช้งาน 3 ระดับ
- [x] ค้นหาเร็ว (วัสดุ + ครุภัณฑ์)
- [x] แจ้งเตือน Telegram
- [x] Service Worker (Offline cache)
- [x] คู่มือการใช้งานในระบบ

---

## ไลบรารีภายนอก (CDN — ไม่ต้องติดตั้งเพิ่ม)

| ไลบรารี | หน้าที่ |
|--------|--------|
| Tailwind CSS | UI Framework |
| Chart.js | กราฟสถิติ |
| SweetAlert2 | Popup/Dialog |
| QRCode.js | สร้าง QR Code |
| html5-qrcode | สแกน QR ด้วยกล้อง |
| SheetJS (xlsx) | Export Excel |
| Flaticon Uicons | ไอคอน |
| Google Fonts (Sarabun) | ฟอนต์ภาษาไทย |

---

## ข้อควรระวัง

- **HTTPS เท่านั้น**: QR Scanner และ Service Worker ต้องใช้ผ่าน HTTPS (GitHub Pages รองรับอยู่แล้ว)
- **CORS**: GAS Web App ต้องตั้ง "Anyone" จึงจะเรียกจาก GitHub Pages ได้
- **Re-deploy GAS**: ทุกครั้งที่แก้ `code.gs` ต้อง Deploy → New version ใน Apps Script
- **Cache**: หลังอัปเดตไฟล์บน GitHub ให้ hard refresh (`Ctrl+Shift+R`) เพื่อล้าง cache

---

## License

MIT
