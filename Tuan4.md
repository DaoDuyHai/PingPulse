# 🧪 TUẦN 4: TEST THẬT VÀ LOGIC SỰ CỐ (~13 GIỜ)

> **Mục tiêu tối thượng của tuần:**
> 1. Làm chủ kỹ năng viết **Unit Test chuyên nghiệp** bằng **Vitest**.
> 2. Hiểu bản chất **Mocking**: Tại sao khi test không được gọi mạng thật ra ngoài Internet? Giả lập các kịch bản web sập, web timeout, web lỗi 500 bằng `vi.fn()` / `vi.stubGlobal`.
> 3. Nắm vững tư duy **Hàm thuần (Pure Function)**: Tách logic nghiệp vụ ra khỏi Database và I/O mạng để test siêu nhanh, không phụ thuộc môi trường.
> 4. Xây dựng **Cỗ máy trạng thái sự cố (Incident State Machine)**: Chống báo động giả (Alert Fatigue) — Đúng 3 lần check lỗi liên tiếp mới Mở sự cố (`open`), đúng 2 lần OK liên tiếp mới Đóng sự cố (`close`).
> 5. Thiết kế bảng `incidents` và làm chủ **Database Transaction (`prisma.$transaction`)** đảm bảo tính toàn vẹn **ACID**, thử nghiệm **Rollback** khi có lỗi giữa chừng.
> 6. Viết **Integration Test** tự động với `supertest` kiểm thử luồng chạy thực tế từ Đăng ký $\rightarrow$ Đăng nhập $\rightarrow$ Tạo monitor $\rightarrow$ Check now.

---

## 📋 DANH SÁCH CÔNG VIỆC CẦN LÀM (TASKS)

- [x] **Task 4.1:** Viết 3 Unit Test cho hàm `checkUrl` với hàm `fetch` bị giả lập (Mocking: web 200 UP, web 500 DOWN, web timeout/ném ngoại lệ) (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 4.2:** Viết hàm thuần `decideIncident(recent: Check[], hasOpenIncident: boolean)` xử lý nghiệp vụ mở/đóng sự cố (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 4.3:** Viết 8 - 10 Unit Tests bao phủ toàn bộ các trường hợp biên (Edge Cases): ít hơn 3 check, đang có sự cố, lỗi xen kẽ OK, mảng rỗng (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 4.4:** Thêm bảng `incidents` vào `schema.prisma`, chạy Migration. Mở/đóng sự cố trong Transaction (`prisma.$transaction`) và thử nghiệm cơ chế Rollback (2 giờ). ✅ ĐÃ HOÀN THÀNH
- [ ] **Task 4.5:** Viết 1 bài Integration Test bằng `supertest` kiểm thử luồng API hoàn chỉnh: Đăng ký $\rightarrow$ Đăng nhập $\rightarrow$ Tạo monitor $\rightarrow$ Check now (2 giờ).

---

## 🧠 3 CÂU HỎI LÝ THUYẾT CỐT LÕI (CẦN TỰ TRẢ LỜI ĐƯỢC)

### ❓ Câu hỏi 1: Mock là gì? Vì sao khi viết Test ta không được gọi `fetch` thật ra ngoài Internet?
* **Khái niệm Mock:** Mock là kỹ thuật **"đóng thế"** một đối tượng hoặc hàm thật bằng một đối tượng giả lập mà ta hoàn toàn kiểm soát được hành vi và kết quả trả về.
* **Vì sao không gọi `fetch` thật?**
  1. **Tốc độ:** Gọi ra Internet thật mất 100ms - 2000ms mỗi test. Nếu dự án có 500 test, bạn sẽ mất vài phút chỉ để chạy test! Dùng mock, 500 test chạy xong trong **dưới 1 giây**.
  2. **Tính ổn định (Flaky test):** Nếu bạn test bằng cách gọi `fetch('https://google.com')`, lỡ đứt cáp quang hoặc mạng Wifi công ty chập chờn thì test bị đỏ (Fail), dù code của bạn không hề có lỗi!
  3. **Khả năng tái hiện kịch bản khó:** Làm sao bạn bắt máy chủ của Google cố tình trả về mã lỗi 500 hoặc giả lập đứt kết nối sau đúng 5 giây để test? Dùng mock, ta có thể giả lập lỗi chỉ bằng 1 dòng code!

---

### ❓ Câu hỏi 2: Hàm thuần (Pure Function) là gì? Vì sao nó là "chân ái" của Unit Test?
* **Định nghĩa Hàm thuần:** Là hàm thỏa mãn 2 điều kiện bất di bất dịch:
  1. **Cùng đầu vào $\rightarrow$ Luôn ra cùng đầu ra (Deterministic):** Cứ đưa `1 + 1` thì luôn ra `2`, không phụ thuộc ngày giờ, thời tiết hay dữ liệu trong DB.
  2. **Không có tác dụng phụ (No Side Effects):** Không ghi vào Database, không gọi API mạng, không sửa biến toàn cục, không in ra màn hình.
* **Vì sao dễ test?** 
  * Muốn test hàm thuần, bạn **chỉ việc truyền tham số vào và so sánh kết quả trả về** (`expect(decideIncident(recent, false)).toBe("open")`).
  * Không cần bật Postgres, không cần mock mạng, không cần dọn dẹp Database sau khi test xong!

---

### ❓ Câu hỏi 3: Transaction và tính chất ACID trong Database là gì? Ví dụ trong PingPulse?
* **Transaction (Giao dịch):** Là cơ chế gom nhiều câu lệnh SQL thành **1 khối duy nhất**. Nguyên tắc cốt lõi: **"Được ăn cả, ngã về không" (All-or-Nothing)**.
  * Nếu tất cả các lệnh đều thành công $\rightarrow$ Ghi nhận vào DB (**Commit**).
  * Nếu có dù chỉ 1 lệnh bị lỗi giữa chừng $\rightarrow$ Tự động hủy bỏ và khôi phục lại trạng thái ban đầu như chưa có chuyện gì xảy ra (**Rollback**).
* **Ví dụ thực tế trong PingPulse (Task 4.4):**
  * Khi phát hiện 3 lần lỗi liên tiếp, hệ thống phải làm 2 việc:
    1. Ghi 1 bản ghi mới vào bảng `incidents` (đánh dấu bắt đầu sự cố).
    2. Cập nhật `monitors.status = 'down'`.
  * Nếu không dùng Transaction: Lỡ ghi xong bảng `incidents` mà server bị mất điện $\rightarrow$ Bảng `monitors` vẫn báo trạng thái `'up'` $\rightarrow$ **Dữ liệu bị mâu thuẫn, lệch lạc nghiêm trọng!**
  * Dùng `prisma.$transaction([ ... ])`: Đảm bảo cả 2 thao tác cùng thành công, hoặc cùng thất bại.

---

## 🗄️ CẤU TRÚC BẢNG MỚI TUẦN 4: `incidents`

```prisma
model incidents {
  id          Int       @id @default(autoincrement())
  monitor_id  Int
  started_at  DateTime  @default(now()) @db.Timestamptz(6)
  resolved_at DateTime? @db.Timestamptz(6)
  cause       String?
  monitors    monitors  @relation(fields: [monitor_id], references: [id], onDelete: Cascade)

  @@index([monitor_id, started_at(sort: Desc)], name: "idx_incidents_monitor_time")
}
```

---

## 🎯 TIÊU CHÍ NGHIỆM THU (DONE DEFINITION)

1. Viết ít nhất **3 test cho `checkUrl`** với `fetch` bị mock (test thành công 200, test lỗi HTTP 500, test timeout/network error).
2. Viết ít nhất **8 test cho `decideIncident`** bao quát mọi kịch bản và trường hợp biên (tất cả xanh rờn).
3. Cố tình làm sai logic trong `decideIncident` $\rightarrow$ Thấy test đỏ (FAIL) $\rightarrow$ Sửa lại thấy test xanh (PASS).
4. Thực hành **Rollback** thành công: Cố tình throw error giữa chừng trong `$transaction`, chứng minh dữ liệu không bị ghi nửa vời.
5. 1 bài Integration Test bằng `supertest` kiểm thử trơn tru toàn bộ luồng Auth + CRUD Monitor + Check.
