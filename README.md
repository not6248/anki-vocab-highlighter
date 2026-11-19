<div align="center">

# Keyword Highlighter

**ไฮไลต์คำที่กำลังเรียน ตรงบนหน้าที่คุณอ่าน**

ส่วนขยาย Chrome สำหรับคนเรียนภาษา นักอ่าน และสาย Anki<br />
ปรับสีได้ตามใจ แยกโหมดอัตโนมัติกับ manual และมี dark mode ในตัว

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-1e2430?style=flat-square)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-ffe14d?style=flat-square&labelColor=1e2430)](https://www.google.com/chrome/)
[![Anki-Connect](https://img.shields.io/badge/Anki--Connect-supported-2255cc?style=flat-square)](https://foosoft.net/projects/anki-connect/)
[![License](https://img.shields.io/badge/License-ISC-5b6478?style=flat-square)](LICENSE)

<img src="docs/popup-light.png" width="320" alt="หน้าตา popup แท็บไฮไลต์ โหมดสว่าง" />

</div>

---

## ทำอะไรได้บ้าง

- **ไฮไลต์ทุกเว็บ** — ใส่คำครั้งเดียว ใช้ได้ทุกแท็บที่เปิด
- **จับรูปผันอัตโนมัติ** — `cry` โดนทั้ง `cries`, `cried`, `crying`; `go` โดน `went`; `leaf` โดน `leaves`
- **จับทั้งคำแบบ Unicode** — `tall` ไม่ไปโดนใน `Installation` หรือ `taller` (ปิดได้ถ้าอยากจับ substring เช่นภาษาไทย)
- **คำยาวชนะคำสั้น** — `error code` ถูกจับก่อน `error`
- **Sync จาก Anki** — ดึงคำจาก deck ที่เลือกผ่าน Anki-Connect
- **Light / Dark / ตามระบบ** — จำธีมที่เลือกไว้
- **โหมด manual** — หยุด Observer ทั้งหมด กดปุ่มเองเมื่อพร้อม เลือกข้อความได้ไม่หลุด
- **ปุ่มลัดตั้งเองได้** — กด `Alt + Shift + H` เพื่อ highlight ทันที หรือเปลี่ยนเป็นปุ่มที่ถนัด

<div align="center">
<table>
<tr>
<td align="center"><img src="docs/popup-dark.png" width="300" alt="โหมดมืด แท็บระบบและ Anki" /></td>
<td align="center"><img src="docs/popup-style.png" width="300" alt="แท็บปรับแต่งการจับคู่และสี" /></td>
</tr>
<tr>
<td align="center"><sub>โหมดมืด พร้อมสวิตช์ auto/manual</sub></td>
<td align="center"><sub>แท็บปรับแต่ง: การจับคู่และลักษณะแถบสี</sub></td>
</tr>
</table>
</div>

## ติดตั้ง

1. เปิด `chrome://extensions`
2. เปิด **Developer mode** ที่มุมขวาบน
3. กด **Load unpacked** แล้วเลือกโฟลเดอร์ `chrome-highlight-extension`
4. ปักหมุดไอคอนส่วนขยายไว้บน toolbar เพื่อเปิด popup ได้เร็ว

## เริ่มใช้ใน 30 วินาที

1. กดไอคอนส่วนขยาย
2. พิมพ์คำที่อยากไฮไลต์ในช่องแรก คั่นด้วย comma หรือขึ้นบรรทัดใหม่
   ```
   highlight, error code, run, leaf
   ```
3. กด **บันทึก & Highlight**
4. เปิดเว็บอะไรก็ได้ที่ไม่มีคำเหล่านี้ แล้วดูผล

> [!TIP]
> ถ้าอยากได้คำจาก Anki ไปที่แท็บ **ระบบ & Anki** กรอก URL แล้วกด **Sync Anki** คำจะถูก merge เข้า list ให้อัตโนมัติ

## สามแท็บ ตั้งค่าอย่างไรให้เจอ

| แท็บ | ใช้อะไร |
| --- | --- |
| **ไฮไลต์** | คำที่ต้องการ, เปิด/ปิด, สีพื้นหลัง, ปุ่มบันทึก และปุ่มสั่ง highlight |
| **ปรับแต่ง** | ตัวเล็ก/ใหญ่, จับทั้งคำ, รวมรูปผัน, สีตัวอักษร, ตัวหนา, ขีดเส้นใต้ |
| **ระบบ & Anki** | โหมดอัตโนมัติ/manual, ธีม, การเชื่อมต่อ Anki |

ตัวเลือกที่เปลี่ยนบ่อยอยู่แท็บแรก ที่เหลือย้ายไปแท็บขั้นสูงเพื่อให้หน้าแรกโล่ง

## อัตโนมัติ หรือ manual

| | โหมดอัตโนมัติ (ค่าเริ่มต้น) | โหมด manual |
| --- | --- | --- |
| Highlight ตอนเปิดหน้า | ทำทันที | รอจนกดปุ่ม |
| เนื้อหาโหลดเพิ่ม (infinite scroll / SPA) | เฝ้า DOM ให้อัตโนมัติ | ไม่เฝ้า DOM |
| เปลี่ยนสี/คำใน popup | เห็นผลทันที | เก็บค่าไว้ รอกดปุ่ม |
| ขณะลากเลือกข้อความ | เลื่อน highlight ออกไปก่อน | ไม่แตะ DOM เลย |

**ทำไมต้องมี manual** — ตอนครอบข้อความด้วย extension อื่นหรือตอนลาก selection การ replace text node ของ Observer จะทำให้ selection หาย โหมด manual ตัด MutationObserver ทิ้งทั้งหมด จึงเลือกและครอบข้อความได้นิ่งๆ

เมื่ออยู่ในโหมด manual ใช้ปุ่ม **Highlight ตอนนี้** บนแท็บแรก (ปุ่มนี้จะบันทึกค่าล่าสุดให้ก่อนเสมอ)

## ปุ่มลัด

ค่าเริ่มต้นคือ **`Alt + Shift + H`** ใช้ได้ทันทีบนหน้าเว็บ โดยไม่ต้องเปิด popup

เปลี่ยนปุ่มได้ที่แท็บ **ไฮไลต์** → กด **เปลี่ยน** ข้างปุ่มลัด แล้วกดชุดปุ่มที่ต้องการ

- ต้องมี `Ctrl`, `Alt` หรือ `Meta` (Shift ใส่หรือไม่ก็ได้)
- `Backspace` ล้างปุ่มลัด, `Esc` ยกเลิก
- ปุ่มจะทำงานเมื่อโฟกัสอยู่บนหน้าเว็บ และใช้ค่าล่าสุดที่บันทึกไว้

## Sync Anki

1. เปิด Anki ค้างไว้
2. ติดตั้ง add-on **Anki-Connect** (code `2055492159`) แล้ว restart Anki
3. ในแท็บ **ระบบ & Anki** ตั้งค่า:
   - **URL** — `http://127.0.0.1:8765`
   - **API key** — ใส่ถ้าเปิดใช้ใน Anki-Connect
   - **Deck** — เช่น `Default` (เว้นว่าง = ทุก deck)
   - **Field** — เช่น `Word` (เว้นว่าง = เดาฟิลด์คำ, `*` = ทุกฟิลด์)
   - **โหมด** — `ทุกคำ` หรือ `เคยเรียนแล้ว` (`-is:new`)
4. กด **Sync Anki** แล้วรอข้อความยืนยัน

ส่วนขยายจะลอง `POST /api/v1` (JSON-RPC 2.0) ก่อน แล้ว fallback ไป `POST /` แบบ API v6

## การจับคู่คำ

```
tall        → tall, taller, tallest        (ไม่โดน Installation)
cry         → cry, cries, cried, crying
leaf        → leaf, leaves
run         → run, runs, ran, running
error code  → จับทั้งวลีก่อนคำเดี่ยว
```

- **ตัวเล็ก/ใหญ่** — ไม่สนโดยค่าเริ่มต้น
- **จับทั้งคำ** — ใช้ Unicode boundary รองรับภาษาไทยและตัวเลข
- **คำที่ build regex ไม่ได้** — ข้ามอย่างปลอดภัย ไม่ทำให้ทั้งหน้าพัง
- ไม่แตะ `input`, `textarea`, `select`, `script`, `style` และ contenteditable

## โครงสร้างโปรเจกต์

```
chrome-highlight-extension/
├── manifest.json        # MV3, permissions: storage + <all_urls>
├── popup.html           # UI 3 แท็บ + ธีม light/dark
├── popup.js             # โหลด/บันทึกค่า, สลับแท็บ, sync Anki
├── content.js           # เดิน text node, highlight, observer, manual mode
├── content.css          # สไตล์ของ span.ce-highlight
├── shortcut.js          # parse/เทียบปุ่มลัดที่ผู้ใช้ตั้งเอง
├── highlight.js         # parse keywords, ขยายรูปผัน, สร้าง trie regex
├── anki.js              # Anki-Connect client + storage helper
├── test-*.mjs           # unit + browser tests
├── scripts/screenshot.mjs
└── docs/                # ภาพประกอบ README
```

## พัฒนาและทดสอบ

```bash
npm install        # ครั้งแรกเท่านั้น
npm test           # unit + browser test (auto-start test server)
npm run shots      # สร้างภาพ popup ใหม่ลง docs/
```

- `npm test` ใช้ Playwright Chromium จาก `PLAYWRIGHT_BROWSERS_PATH`
- เปลี่ยน browser ได้ด้วย `CHROME=/path/to/chrome npm run shots`
- ทดสอบกับหน้าอื่นได้ด้วย `TEST_URL=http://... npm run test:highlight`

## ความเป็นส่วนตัว

- คำและตั้งค่าอยู่ใน `chrome.storage` ของเบราว์เซอร์คุณเท่านั้น
- keywords เก็บใน `storage.local` เพราะอาจใหญ่กว่า quota ของ `storage.sync`
- ไม่มี analytics ไม่มี server ภายนอก
- Anki-Connect คุยกับ `127.0.0.1` ตามที่คุณตั้งไว้เท่านั้น

## แก้ปัญหาที่เจอบ่อย

| อาการ | ลองทำ |
| --- | --- |
| ไม่ highlight บนหน้าเว็บ | เช็คว่าเปิดใช้งานอยู่ และหน้าเว็บโหลดก่อน extension ติดตั้งหรือไม่ (refresh หน้า) |
| Selection หายขณะครอบข้อความ | เปิดโหมด manual ในแท็บ **ระบบ & Anki** |
| Sync ไม่ติด | เปิด Anki, เช็ค Anki-Connect, approve popup ใน Anki, ใส่ origin ใน `webCorsOriginList` |
| คำภาษาไทยไม่โดน | ปิด **จับทั้งคำเท่านั้น** เพื่อจับแบบ substring |
| เปลี่ยนสีแล้วไม่เห็นผล | โหมด manual ต้องกด **Highlight ตอนนี้** |
| ปุ่มลัดไม่ทำงาน | เช็คว่าโฟกัสอยู่บนหน้าเว็บ ไม่ใช่ในช่อง address bar และปุ่มไม่ชนกับ shortcut ของ Chrome |

## License

ISC — ดูรายละเอียดใน [LICENSE](LICENSE)
