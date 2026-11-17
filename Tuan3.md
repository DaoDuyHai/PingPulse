# 🚀 TUẦN 3: INDEX, EXPLAIN VÀ PHÂN TRANG (~13 GIỜ)

> **Mục tiêu tối thượng của tuần:**
> Bước vào thế giới tối ưu hóa Database ở quy mô dữ liệu lớn ($500.000$ dòng):
> 1. Hiểu cặn kẽ bản chất của **B-Tree Index** và **Composite Index** (Index nhiều cột).
> 2. Làm chủ công cụ soi hiệu năng quyền lực nhất của Database: **`EXPLAIN ANALYZE`**.
> 3. Chứng minh truy vấn nhanh lên gấp hàng chục/hàng trăm lần (chuyển từ `Seq Scan` sang `Index Scan`) và lưu số liệu vào `REPORT.md` làm bằng chứng cho CV.
> 4. Hiểu bản chất và phân biệt được 2 cơ chế phân trang: **Offset Pagination** và **Cursor Pagination**.
> 5. Xây dựng 2 API hiệu năng cao: Lấy lịch sử check có phân trang (`/api/monitors/:id/checks`) và Thống kê Uptime/Latency (`/api/monitors/:id/stats`).

---

## 📋 DANH SÁCH CÔNG VIỆC CẦN LÀM (TASKS)

- [x] **Task 3.1:** Sinh $500.000$ dòng dữ liệu giả lập vào bảng `checks` bằng câu lệnh SQL `generate_series` (2 giờ). ✅ ĐÃ HOÀN THÀNH (13.52 giây - 500.000 dòng)
- [x] **Task 3.2:** Tự viết 4 câu truy vấn SQL phân tích nghiệp vụ (Uptime 7d, Latency theo giờ, 10 lỗi gần nhất, Top 5 chậm nhất) (4 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 3.3:** Chạy `EXPLAIN ANALYZE` trước và sau khi đánh Composite Index `(monitor_id, checked_at DESC)` (3 giờ). ✅ ĐÃ HOÀN THÀNH (Đo đạc 5 đợt x 10 lần: câu 3 tăng tốc gấp 125 lần!)
- [x] **Task 3.4:** Xây dựng API `GET /api/monitors/:id/checks` có phân trang Cursor pagination kết hợp Index scan (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 3.5:** Xây dựng API `GET /api/monitors/:id/stats` trả về Uptime $\%$ và Latency trung bình qua SQL Aggregate tận dụng Composite Index (1 giờ). ✅ ĐÃ HOÀN THÀNH

---

## 🧠 3 CÂU HỎI LÝ THUYẾT CỐT LÕI (CẦN TỰ TRẢ LỜI ĐƯỢC)

### ❓ Câu hỏi 1: B-Tree Index là gì? Tại sao thứ tự cột trong Composite Index `(monitor_id, checked_at DESC)` lại tối quan trọng?
* **Khái niệm:** Index giống như **Mục lục của một cuốn sách**. Không có mục lục, muốn tìm một trang bạn phải lật từ trang 1 đến trang cuối (**Sequential Scan**). Có mục lục, bạn nhảy thẳng tới đúng trang cần tìm (**Index Scan**).
* **Composite Index:** Khi đánh index trên 2 cột `(A, B)`, Database sẽ sắp xếp theo cột `A` trước, sau đó trong cùng một giá trị `A` mới sắp xếp theo `B`. 
* 👉 Nếu truy vấn `WHERE monitor_id = 7 ORDER BY checked_at DESC`, index này phát huy sức mạnh tuyệt đối vì dữ liệu đã được gom theo monitor và xếp sẵn theo thời gian!

### ❓ Câu hỏi 2: Khi nào KHÔNG NÊN đánh Index?
* Index không phải cây đũa thần miễn phí. Mỗi lần `INSERT`, `UPDATE`, `DELETE`, Database vừa phải ghi dữ liệu thật, vừa phải **tính toán cập nhật lại cây Index** $\rightarrow$ Làm chậm tốc độ ghi.
* Bảng nào ghi liên tục mà rất ít khi đọc, hoặc các bảng quá nhỏ (vài chục dòng) thì không cần đánh index.

### ❓ Câu hỏi 3: Cursor Pagination khác gì Offset Pagination? Vì sao Offset chậm ở trang sâu?
* **Offset Pagination (`OFFSET 100000 LIMIT 20`):** Database phải quét qua và đọc đủ $100.000$ dòng đầu tiên, rồi vứt chúng đi để lấy 20 dòng tiếp theo $\rightarrow$ Trang càng sâu càng rùa bò.
* **Cursor Pagination (`WHERE id < last_seen_id LIMIT 20`):** Nhảy thẳng tới vị trí dòng cuối cùng của trang trước nhờ Index $\rightarrow$ Tốc độ ở trang 1 cũng nhanh y hệt trang thứ $10.000$!

---

## 🗺️ BẢN ĐỒ CÁC ROUTE API CỦA TUẦN 3

| Phương thức | Đường dẫn API | Chức năng | Yêu cầu kỹ thuật |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/monitors/:id/checks` | Lấy danh sách lần check có phân trang | Hỗ trợ Cursor pagination (`cursor`, `take`) |
| `GET` | `/api/monitors/:id/stats` | Thống kê Uptime $\%$ và Latency trung bình | Dùng SQL Aggregate / Prisma tính toán nhanh |

---

## 🎯 TIÊU CHÍ NGHIỆM THU (DONE DEFINITION)
1. Bảng `checks` có ít nhất **$500.000$ dòng dữ liệu**.
2. File `REPORT.md` hoàn thành với bảng so sánh:
   * Thời gian chạy câu lệnh khi chưa có Index vs đã có Index.
   * Kế hoạch thực thi chuyển đổi từ `Seq Scan` sang `Index Scan` / `Bitmap Index Scan`.
3. API phân trang hoạt động mượt mà, phản hồi dưới 10ms kể cả khi truy vấn trong $500.000$ dòng.
