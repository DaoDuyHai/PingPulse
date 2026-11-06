# 📓 Devlog - PingPulse

Nhật ký phát triển dự án **PingPulse** (Hệ thống giám sát Uptime & Performance).

---

## 📅 2026-11-02 (Sprint 1 - Ngày 1: Khởi tạo Repo & Setup Môi trường)

### 🎯 Đã hoàn thành
- [x] Khởi tạo Git repository và cấu trúc thư mục ban đầu cho dự án backend.
- [x] Cấu hình TypeScript với chế độ nghiêm ngặt cao nhất (**Strict Mode**, `nodenext`, `target: esnext`).
- [x] Thiết lập bộ công cụ chuẩn hóa mã nguồn: **ESLint** và **Prettier** (`.prettierrc`, `.eslintrc.json`, `eslint-config-prettier`).
- [x] Tạo các tài liệu dự án ban đầu: [CONTRIBUTING.md](file:///d:/PingPulse/CONTRIBUTING.md), `.gitignore` chuẩn.

### 🚧 Vướng mắc & Bài học
- **Lỗi encoding UTF-16 LE trên PowerShell:** Khi dùng lệnh `echo "..." > src/index.ts`, PowerShell 5.1 mặc định xuất file mã hóa UTF-16 LE có BOM. `esbuild` / `tsx` chỉ đọc UTF-8 nên báo lỗi `Unexpected ""`.
  - *Cách khắc phục:* Chuyển đổi mã hóa file về **UTF-8** (hoặc dùng `Set-Content -Encoding utf8`).
- Hiểu rõ bản chất cờ `--noEmit` trong `npx tsc --noEmit`: Dùng để kiểm tra lỗi kiểu dữ liệu (Type-checking) thuần túy mà không sinh ra file `.js` rác trong repo.
- **Thời gian:** Ước lượng 2.5 giờ | Thực tế: 3 giờ.

---

## 📅 2026-11-03 (Sprint 1 - Ngày 2: Ticket [PP-2] - Hàm `groupBy`)

### 🎯 Đã hoàn thành
- [x] Hoàn thành hàm tiện ích generic [src/utils/groupBy.ts](file:///d:/PingPulse/src/utils/groupBy.ts).
- [x] Cải tiến khởi tạo đối tượng bằng `Object.create(null)` thay vì `{}` theo chuẩn của `Object.groupBy()` (ECMAScript 2024) để ngăn chặn lỗ hổng **Prototype Pollution**.
- [x] Viết bộ kiểm thử đầu tiên với dữ liệu thực tế của PingPulse (gom nhóm Monitor theo `status`, gom log kiểm tra theo `statusCode`, theo `region`).

### 🚧 Vướng mắc & Bài học
- **Node.js ESM imports:** Nhận thức rõ lý do tại sao trong file TypeScript lại phải `import ... from '../utils/groupBy.js'`. Vì TypeScript không tự viết lại chuỗi import khi transpile, và đích đến cuối cùng chạy trên Node.js luôn là mã JavaScript.
- Khi dùng `Object.create(null)`, đối tượng trả về không có prototype thông thường, cần so sánh với `Object.create(null)` trong assertion.
- **Thời gian:** Ước lượng 2 giờ | Thực tế: 2.5 giờ.

---

## 📅 2026-11-04 (Sprint 1 - Ngày 3: Ticket [PP-3] - Hàm `chunk` & Tích hợp `Vitest`)

### 🎯 Đã hoàn thành
- [x] Hoàn thành hàm tiện ích [src/utils/chunk.ts](file:///d:/PingPulse/src/utils/chunk.ts) dùng để băm nhỏ mảng phục vụ kiểm soát concurrency (Batch Processing) khi ping hàng loạt website.
- [x] Tối ưu thuật toán ngắn gọn với `value.slice(i, i + size)` kết hợp bước nhảy `i += size`.
- [x] Bắt ngoại lệ an toàn `if (size <= 0) throw new Error(...)` để tránh lỗi lặp vô tận (Infinite loop).
- [x] Quyết định nâng cấp hạ tầng kiểm thử: Cài đặt và cấu hình **Vitest** thay cho runner mặc định của Node để có trải nghiệm test chuyên nghiệp, hỗ trợ Watch Mode (`npm run test:watch`).
- [x] Chuyển đổi toàn bộ test suite sang cú pháp hiện đại của Vitest (`expect`, `describe`, `it`).

### 🚧 Vướng mắc & Bài học
- Hiểu được ý nghĩa của chỉ thị `// @ts-expect-error`: Tấm thẻ thông hành báo cho TypeScript biết developer đang cố tình truyền dữ liệu sai kiểu để test runtime resilience.
- Kiểm thử thành công 11/11 tests trên cả 2 hàm `groupBy` và `chunk`.
- **Thời gian:** Ước lượng 2 giờ | Thực tế: 2 giờ.

---

## 📅 2026-11-05 (Sprint 1 - Ngày 4: Ticket [PP-4] - Hàm `pick`)

### 🎯 Đã hoàn thành
- [x] Hoàn thành hàm tiện ích [src/utils/pick.ts](file:///d:/PingPulse/src/utils/pick.ts) giúp trích xuất các trường mong muốn và loại bỏ các trường nhạy cảm (`secretToken`, internal keys).
- [x] Sử dụng TypeScript Generic ràng buộc chặt chẽ: `<T extends object, K extends keyof T>` và kiểu trả về `Pick<T, K>`.
- [x] Sử dụng phương thức hiện đại `Object.hasOwn(obj, key)` (chuẩn ES2022) an toàn hơn `hasOwnProperty`.
- [x] Viết trọn bộ 5 test case trong [src/tests/pick.test.ts](file:///d:/PingPulse/src/tests/pick.test.ts) kiểm tra: lọc trường nhạy cảm, nhặt 1 key, mảng key rỗng, bỏ qua thuộc tính kế thừa từ prototype, và tính bất biến (Immutability).
- [x] Đạt mốc **16/16 tests pass** mượt mà trên Vitest, `npx tsc --noEmit` 0 lỗi.

### 🚧 Vướng mắc & Bài học
- Khi hàm chưa có câu lệnh `return result;`, Node.js thực thi sẽ mặc định trả về `undefined`. Cần luôn đảm bảo hàm có return rõ ràng.
- Hiểu rõ sự khác biệt giữa `pick.js` và `pick.ts` trong việc tận dụng hệ thống type checking của TypeScript.
- **Thời gian:** Ước lượng 2 giờ | Thực tế: 2.5 giờ.

---

## 📅 2026-11-06 (Sprint 1 - Ngày 5: Bứt phá hoàn thành trọn bộ 10 Hàm, Result & Error Handling)

### 🎯 Đã hoàn thành
- [x] **Hàm `omit` ([src/utils/omit.ts](file:///d:/PingPulse/src/utils/omit.ts)):** Lọc bỏ các trường nhạy cảm, áp dụng shallow copy `{ ...obj }` đảm bảo Immutability (5 tests).
- [x] **Hàm `sleep` ([src/utils/sleep.ts](file:///d:/PingPulse/src/utils/sleep.ts)):** Tạm dừng luồng code bằng `Promise<void>`, kiểm thử với Vitest Fake Timers (4 tests).
- [x] **Hàm `unique` ([src/utils/unique.ts](file:///d:/PingPulse/src/utils/unique.ts)):** Khử trùng lặp mảng dùng `[...new Set(arr)]` với độ phức tạp tối ưu (7 tests).
- [x] **Hàm `compact` ([src/utils/compact.ts](file:///d:/PingPulse/src/utils/compact.ts)):** Lọc sạch falsy values với Type Guard `item is NonNullable<T>` (7 tests).
- [x] **Hàm `safeJsonParse` ([src/utils/safeJsonParse.ts](file:///d:/PingPulse/src/utils/safeJsonParse.ts)):** Hỗ trợ 2 chế độ:
  - Chế độ Discriminated Union trả về `Result<T, Error>` ([src/types/result.ts](file:///d:/PingPulse/src/types/result.ts)) khi parse không fallback.
  - Chế độ Fallback an toàn chống sập server khi gặp chuỗi lỗi HTML 502 (8 tests).
- [x] **Hàm `retry` ([src/utils/retry.ts](file:///d:/PingPulse/src/utils/retry.ts)):** Tự động thử lại hàm async khi gặp lỗi mạng, tận dụng hàm `sleep` mà không cần gọi `setTimeout` hay `Promise` thủ công (5 tests).
- [x] **Hàm `debounce` ([src/utils/debounce.ts](file:///d:/PingPulse/src/utils/debounce.ts)):** Chống bão thông báo / gõ phím, hỗ trợ phương thức `cancel()`, kiểm tra kiểu nghiêm ngặt bằng `@ts-expect-error` (5 tests).
- [x] **Class `AppError` & Hàm `handleError` ([src/errors/AppError.ts](file:///d:/PingPulse/src/errors/AppError.ts)):** Quản lý lỗi tập trung an toàn, phân loại `AppError` (có `statusCode`) và lỗi hệ thống `unknown` (5 tests).
- [x] **Cán mốc 62 / 62 tests pass** trên 11 test suites của Vitest, `npx tsc --noEmit` hoàn toàn sạch lỗi, **0% sử dụng `any`**.

### 🚧 Vướng mắc & Bài học
- **Vòng đời Git:** Nắm vững quy trình `git add` (đưa vào Staging) $\rightarrow$ `git commit` (tạo gói) $\rightarrow$ `git push` (đẩy lên remote).
- **Discriminated Union (`Result<T, E>`):** Hiểu cách TypeScript tự động thu hẹp kiểu dựa vào cờ `res.ok` (khi `ok === true` truy cập `res.data`, khi `ok === false` truy cập `res.error`).
- **Xử lý bất đồng bộ:** Nhận ra `retry` thực chất chỉ là vòng lặp `for` và `try/catch`, khi đã có `sleep` thì không cần viết lại `Promise` phức tạp.
- **Thời gian:** Ước lượng 4 giờ | Thực tế: 4.5 giờ.

---

## 🏆 RETROSPECTIVE: TỔNG KẾT SPRINT 1 (PingPulse Level 1a - Core Utilities)

### 📊 Thống kê Sprint 1
- **Tổng số hàm tiện ích:** 10/10 hàm (`chunk`, `groupBy`, `pick`, `omit`, `unique`, `compact`, `sleep`, `debounce`, `retry`, `safeJsonParse`).
- **Tổng số bài Unit Test:** 62 tests pass (100% xanh trên Vitest).
- **Chất lượng mã nguồn:** Tuân thủ TypeScript Strict mode, 0 lỗi biên dịch, không sử dụng `any`.
- **Tổng thời gian thực tế vs Ước lượng:**
  - Tổng ước lượng: 12.5 giờ
  - Tổng thực tế: 14.5 giờ (Chênh lệch ~2 giờ do làm quen với Vitest và TypeScript Generic nâng cao, nhưng hoàn toàn xứng đáng).

### 💡 Điểm mạnh đã đạt được
1. Nắm vững tư duy Bất biến (Immutability) và Lập trình phòng thủ (Defensive Programming).
2. Tác phong làm việc chuẩn mực: Mỗi chức năng một nhánh, có unit test đi kèm và nhật ký devlog ghi chép hàng ngày.
3. Vượt qua nỗi sợ `Promise` / `async-await` và làm chủ các kỹ thuật nâng cao như Discriminated Union, Type Guard.

### 🚀 Kế hoạch Sprint 2
- Bắt đầu bước vào tầng **Core Checker Engine** của PingPulse: Xây dựng module ping website thực tế (HTTP/HTTPS, TCP), tính toán latency và tích hợp các hàm utils (`retry`, `timeout`, `chunk`) vào luồng nghiệp vụ.
