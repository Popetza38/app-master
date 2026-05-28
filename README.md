# ระบบวัสดุสิ้นเปลือง (Consumable Items Management)

> **เวอร์ชัน:** 2.0 — Static Frontend พร้อม Mock API และ Background Loading System

---

## สรุปการแก้ไขระบบ (Changelog)

### 1. Login Page — ออกแบบใหม่ทั้งหมด (แบบ app-master-main)

| รายการ | เดิม | ใหม่ |
|--------|------|------|
| Background | Gradient navy เรียบ | Dark glassmorphism + animated particles |
| Layout | Card กลางหน้า | Split layout (Branding ซ้าย / Form ขวา) |
| Role selector | Tabs แนวนอน | Pill buttons |
| Error handling | SweetAlert popup | Inline error ใน card |
| ปุ่ม Login | ปุ่มธรรมดา | Shimmer effect + gradient |
| Animation | ไม่มี | Floating particles, expanding rings, orbiting dots |

**CSS classes ใหม่:** `login-v2-bg`, `login-v2-card`, `login-v2-input`, `login-v2-btn-primary`, `card-border-glow`, `text-gradient-animated`, `glow-text`

---

### 2. Background Loading System

**เดิม:** ทุก page load แสดง overlay spinner บล็อก UI ทั้งหมด

**ใหม่:** 3 ระดับ

| ระดับ | ใช้เมื่อ | ผลลัพธ์ |
|-------|---------|---------|
| **Skeleton** | เปิดหน้าใหม่ | แสดง placeholder ทันที ไม่บล็อก UI |
| **Background indicator** | โหลด API ใน background | Spinner เล็กมุมขวาล่าง |
| **Overlay** | User actions (save/delete) | Spinner กลางจอ (เหมือนเดิม) |

**Functions ใหม่:**
- `showBgLoading(text)` / `hideBgLoading()` — reference counting, ซ่อนอัตโนมัติเมื่อทุก request เสร็จ
- `skeletonTable(rows)` — skeleton สำหรับหน้า list
- `skeletonDashboard()` — skeleton สำหรับ dashboard
- `renderErrorState(message, retryFn)` — error state พร้อมปุ่มลองใหม่

---

### 3. Performance — Cache & Prefetch

**Cache TTL เพิ่มจาก 3 วินาที → 5 นาที**

| Data | Cache | Invalidate เมื่อ |
|------|-------|-----------------|
| Items | 5 นาที | add/edit/delete item, stocktake |
| Receives | 5 นาที | addReceive |
| Withdrawals | 5 นาที | submit/cancel withdrawal |
| Approve | 5 นาที | approve/reject |
| Transactions | 5 นาที | approve (เพราะสร้าง tx ใหม่) |

**Stale-while-revalidate:** เมื่อ tab กลับมา active และข้อมูลเก่ากว่า 5 นาที จะ refresh ใน background โดยไม่บล็อก UI

**Background Prefetch:** หลัง login 500ms จะโหลด items + users พร้อมกัน (parallel) เพื่อให้หน้าต่างๆ เปิดได้ทันที

---

### 4. Mock API — รันได้โดยไม่ต้องมี Google Apps Script

**`api.js`** มี flag `USE_MOCK`:
```js
var USE_MOCK = true;   // ใช้ mock (offline, ทดสอบ)
var USE_MOCK = false;  // ใช้ Google Apps Script จริง
```

Mock latency จำลอง 80ms เพื่อให้ skeleton/loading แสดงผลได้เห็น

**บัญชีทดสอบ:**

| Role | Username | Password |
|------|----------|----------|
| ผู้ดูแลระบบ | `admin` | `123456` |
| เจ้าหน้าที่ | `staff` | `123456` |
| พนักงาน | `employee` | `123456` |

---

### 5. ขนาดไฟล์อัปโหลด

เพิ่มจาก **2 MB → 10 MB** ทุกจุด:
- รูปวัสดุ
- รูปโปรไฟล์
- โลโก้หน่วยงาน
- รูปครุภัณฑ์

---

## วิธีรัน

```bash
cd "C:\Users\popet\OneDrive\เดสก์ท็อป\app-get"
npx serve . -p 3000
```
เปิด browser: `http://localhost:3000`

> ไม่สามารถดับเบิลคลิก index.html ได้โดยตรง เพราะ browser บล็อก `fetch()` บน `file://`

---

## โครงสร้างไฟล์

| ไฟล์ | บทบาท |
|------|-------|
| `index.html` | หน้าเว็บหลัก (login + app shell) |
| `styles.css` | CSS custom รวม login v2 + skeleton + bg-loading |
| `api.js` | API client — route ไป mock หรือ GAS ตาม `USE_MOCK` |
| `mock-api.js` | Mock backend ใช้ localStorage (ทดสอบ offline) |
| `app.js` | Frontend logic ทั้งหมด |

---

## ฟีเจอร์ที่รองรับ

- [x] Login / Logout / Forgot password (UI ใหม่)
- [x] Dashboard สถิติ + กราฟ Chart.js (skeleton loading)
- [x] รายการวัสดุ (CRUD + รูปภาพสูงสุด 10MB)
- [x] สต็อกคงเหลือ (Card / Table view)
- [x] รับวัสดุเข้าคลัง
- [x] เบิกวัสดุ + อนุมัติ (Workflow)
- [x] QR Code สำหรับเบิกวัสดุ (Generate + Print)
- [x] QR Scanner ด้วยกล้อง
- [x] ประวัติเคลื่อนไหว + รายงาน
- [x] ทะเบียนครุภัณฑ์ (CRUD + สถานะ + ซ่อมบำรุง + คณะกรรมการ)
- [x] จัดการผู้ใช้งาน
- [x] โปรไฟล์ + เปลี่ยนรหัสผ่าน
- [x] ตั้งค่าระบบ + โลโก้

---

## ไลบรารีภายนอก (CDN)

- Tailwind CSS
- Chart.js
- SweetAlert2
- QRCode.js
- html5-qrcode
- SheetJS (xlsx)
- Flaticon Uicons

## License

MIT
