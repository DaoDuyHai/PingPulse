# 📊 BÁO CÁO TỐI ƯU HÓA DATABASE & BENCHMARK INDEX - PINGPULSE

> **Dự án:** PingPulse (Backend Uptime & Performance Monitoring)  
> **Quy mô dữ liệu:** $500.000$ dòng lịch sử kiểm tra (`checks`) cho $100$ monitors  
> **Môi trường đo đạc:** PostgreSQL 16 (Docker Container), Buffer Pool tiêu chuẩn  
> **Mục tiêu:** Đo lường tác động của **Composite Index `(monitor_id, checked_at DESC)`** đối với hiệu năng truy vấn, chuyển đổi từ `Seq Scan` sang `Index Scan` / `Bitmap Index Scan`.

---

## 1. TỔNG HỢP KẾT QUẢ BENCHMARK TRUY VẤN (EXPLAIN ANALYZE)

Đo đạc trung bình trên $5$ đợt chạy $\times$ $10$ lần lặp lại (loại bỏ nhiễu cold cache):

| Truy vấn | Mục đích nghiệp vụ | Trước khi có Index (Seq Scan) | Sau khi có Composite Index | Tốc độ tăng | Kế hoạch thực thi thay đổi |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Q1** | **Uptime % 7 ngày qua** của 1 monitor | `23.4 ms` | **`4.6 ms`** | **5.1x** | `Seq Scan` (500k rows) $\rightarrow$ `Bitmap Index Scan` |
| **Q2** | **Độ trễ trung bình theo giờ** (24h qua) | `21.5 ms` | **`1.3 ms`** | **16.5x** | `Seq Scan` $\rightarrow$ `Bitmap Index Scan` |
| **Q3** | **10 lần lỗi gần nhất** của 1 monitor | `17.6 ms` | **`0.14 ms`** | **125.7x** | `Seq Scan + Sort` $\rightarrow$ `Index Scan` + **Early Exit** |
| **Q4** | **Top 5 monitor chậm nhất** toàn hệ thống | `34.1 ms` | `33.8 ms` | ~1.0x (Không đổi) | `Seq Scan` (Do vi phạm Leftmost Prefix Rule) |

---

## 2. PHÂN TÍCH CHI TIẾT CÁC PHÁT HIỆN KỸ THUẬT

### A. Vì sao Query 3 tăng tốc tới 125 lần (`0.14 ms`)?
- **Trước Index:** PostgreSQL phải duyệt qua toàn bộ $500.000$ dòng trong bảng (`Seq Scan`), lọc các dòng của monitor đó, gom vào bộ nhớ để sắp xếp (`Sort Method: top-N heapsort`), rồi mới lấy ra 10 dòng.
- **Sau Index:** Nhờ Composite Index `(monitor_id, checked_at DESC)`:
  1. Cột `monitor_id` đứng đầu giúp cây B-Tree nhảy thẳng tới cụm bản ghi của monitor đó (**Equality Rule**).
  2. Cột `checked_at DESC` đứng sau giúp dữ liệu trong cụm **đã được xếp sẵn từ mới nhất về cũ nhất** (**Sort Rule**).
  3. Kết hợp với `LIMIT 10`, Postgres chỉ cần đọc đúng **10 bản ghi đầu tiên ở lá cây** rồi **dừng ngay lập tức (Early Exit)**. Không tốn bất kỳ tài nguyên sắp xếp hay đọc dữ liệu thừa nào.

### B. Vì sao Query 4 không thay đổi tốc độ?
- Câu lệnh: Tìm 5 monitor có độ trễ cao nhất toàn hệ thống trong 24 giờ qua (`WHERE checked_at > NOW() - INTERVAL '24 hours'`).
- **Quy tắc tiền tố bên trái (Leftmost Prefix Rule):** Index được đánh theo thứ tự `(monitor_id, checked_at DESC)`. Khi câu lệnh chỉ lọc theo `checked_at` mà không có điều kiện `monitor_id = ...`, Postgres không thể dùng phần sau của Index để tìm kiếm trực tiếp, buộc phải quay về `Seq Scan`.
- **Bài học kiến trúc:** Muốn tối ưu câu này cần tạo thêm một Index riêng trên `(checked_at DESC)` hoặc reshape câu query.

---

## 3. BENCHMARK CÁC CHIẾN LƯỢC TRUY VẤN MONITOR LIST (LATERAL JOIN vs ORM)

Bài toán: Lấy danh sách 100 monitors kèm theo lần check gần nhất của từng monitor.

| Phương án kiến trúc | Thời gian phản hồi (500k rows) | Đánh giá & Rủi ro |
| :--- | :---: | :--- |
| **N+1 Tuần tự (Sequential)** | `166 ms` (có index) / `2,152 ms` (không index) | 101 câu query, overhead mạng lớn |
| **N+1 Song song (`Promise.all`)** | `87 ms` (có index) / `428 ms` (không index) | Rủi ro cạn kiệt Connection Pool (`max_connections`) |
| **Prisma Engine `include: { take: 1 }`** | `~3.100 ms` | Rust Engine kéo dữ liệu qua Socket `IN (...)` gây nghẽn RAM |
| **SQL `DISTINCT ON`** | `939 ms` | Hash/Merge join quét toàn bộ bảng |
| **SQL `LEFT JOIN LATERAL (...) LIMIT 1`** | **`3.0 ms`** | **Tối ưu cực đại:** 1 câu SQL duy nhất, lặp 100 lần Index Seek |

---

## 4. BẢNG SO SÁNH 2 KỸ THUẬT PHÂN TRANG (PAGINATION)

| Tiêu chí so sánh | Offset Pagination (`getMonitors`) | Cursor Pagination (`getMonitorChecks`) |
| :--- | :--- | :--- |
| **API áp dụng** | `GET /api/monitors?page=1&limit=10` | `GET /api/monitors/:id/checks?cursor=...&limit=20` |
| **Cơ chế truy vấn** | `LIMIT :limit OFFSET :offset` | `WHERE id < :cursor ORDER BY id DESC LIMIT :limit` |
| **Độ phức tạp (Complexity)** | $O(N)$ – Càng sang trang sâu càng phải quét và bỏ qua $K$ dòng | $O(1)$ – Luôn nhảy thẳng qua B-Tree Index Seek |
| **Tốc độ ở trang sâu (Page 1.000+)**| Rất chậm (vài chục đến hàng trăm ms) | **Siêu tốc (~0.1ms)** |
| **Trải nghiệm giao diện** | Phù hợp thanh số trang `[1] [2] [3]...` | Phù hợp cuộn vô tận (Infinite Scroll) / Nút "Xem thêm" |
| **Rủi ro chèn dữ liệu** | Có thể bị đọc trùng hoặc sót dòng khi có bản ghi mới | **Không bao giờ bị trùng hoặc sót dữ liệu** |

---

## 5. KẾT LUẬN & ỨNG DỤNG CHO CV

1. **Hiểu bản chất Index:** Biết rõ cách cây B-Tree phân tầng ($O(\log N)$) và áp dụng quy tắc ESR (Equality, Sort, Range).
2. **Kỹ năng đo đạc chuyên sâu:** Sử dụng thành thạo `EXPLAIN (ANALYZE, BUFFERS)` để soi cặn kẽ `Shared Hit Blocks`, `Rows Removed by Filter`, `Sort Method`.
3. **Lựa chọn công nghệ thông minh:** Dùng Prisma ORM cho CRUD an toàn, kết hợp linh hoạt Raw SQL (`LATERAL JOIN`, Aggregate) tại các điểm nóng hiệu năng để đạt tốc độ mili-giây.
