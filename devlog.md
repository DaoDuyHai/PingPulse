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

---

## 📅 2026-11-03 (Sprint 1 - Ngày 2: Ticket [PP-2] - Hàm `groupBy`)

### 🎯 Đã hoàn thành
- [x] Hoàn thành hàm tiện ích generic [src/utils/groupBy.ts](file:///d:/PingPulse/src/utils/groupBy.ts).
- [x] Cải tiến khởi tạo đối tượng bằng `Object.create(null)` thay vì `{}` theo chuẩn của `Object.groupBy()` (ECMAScript 2024) để ngăn chặn lỗ hổng **Prototype Pollution**.
- [x] Viết bộ kiểm thử đầu tiên với dữ liệu thực tế của PingPulse (gom nhóm Monitor theo `status`, gom log kiểm tra theo `statusCode`, theo `region`).

### 🚧 Vướng mắc & Bài học
- **Node.js ESM imports:** Nhận thức rõ lý do tại sao trong file TypeScript lại phải `import ... from '../utils/groupBy.js'`. Vì TypeScript không tự viết lại chuỗi import khi transpile, và đích đến cuối cùng chạy trên Node.js luôn là mã JavaScript.
- Khi dùng `Object.create(null)`, đối tượng trả về không có prototype thông thường, cần lưu ý khi assert trong test.

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

---

## 📅 2026-11-06 (Sprint 1 - Ngày 5: Ticket [PP-5] - Hàm `omit`)

### 🎯 Đã hoàn thành
- [x] Hoàn thành hàm tiện ích [src/utils/omit.ts](file:///d:/PingPulse/src/utils/omit.ts) (ngược lại với `pick`, chuyên dùng để lọc bỏ các trường nhạy cảm như `secretToken`, `internalIp`, `debugStackTrace`).
- [x] Áp dụng tư duy bất biến (Immutability): sao chép nông `{ ...obj }` trước khi `delete` để không làm thay đổi object gốc.
- [x] Ràng buộc chặt chẽ với TypeScript Generics: `<T extends object, K extends keyof T>` và kiểu trả về `Omit<T, K>`.
- [x] Viết bộ kiểm thử 5 ca trong [src/tests/omit.test.ts](file:///d:/PingPulse/src/tests/omit.test.ts) kiểm tra: loại bỏ nhiều key nhạy cảm, bỏ 1 key, mảng key rỗng, bỏ toàn bộ keys, và tính bất biến (`Object.freeze`).
- [x] Cán mốc **21/21 tests pass** trên Vitest, hoàn thành **4 / 10** hàm tiện ích cốt lõi.

### 🚧 Vướng mắc & Bài học
- **Vòng đời Git (Staging vs Commit):** Sau khi `git add .`, file mới chỉ nằm ở khu vực chuẩn bị (Staging Area). Nếu `git push` ngay mà quên `git commit` thì Git chỉ đẩy nhánh trống (`Total 0`) mà chưa có code mới lên GitHub. Cần `git commit` đóng gói trước rồi mới `git push`.

---

## 🚀 Kế hoạch tiếp theo (Ngày mai)
- [ ] Hoàn thành ticket **[PP-6]**: Viết hàm tiện ích số 5 (hàm bất đồng bộ `sleep` / `delay` hoặc cơ chế `retry` khi ping website thất bại).
- [ ] Viết test suite Vitest đi kèm (mục tiêu cán mốc 5/10 hàm tiện ích).
