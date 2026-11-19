# ⚡ TUẦN 5: REDIS - BỘ NHỚ SIÊU TỐC, CACHING & RATE LIMIT (~12 GIỜ)

> **Mục tiêu tối thượng của tuần:**
> 1. Hiểu bản chất **In-Memory Database**: Tại sao **Redis** lại có tốc độ đọc/ghi kinh hoàng (**dưới 0.5 mili-giây**), nhanh hơn cả SSD xịn nhất?
> 2. Làm chủ các câu lệnh cốt lõi của Redis qua `redis-cli`: `SET`, `GET`, `EXPIRE`, `TTL`, `INCR`.
> 3. Nắm vững mô hình thiết kế **Cache-Aside Pattern**: Cơ chế đệm dữ liệu đọc nhiều, tối ưu truy vấn trang trạng thái công khai (`/status/:slug`).
> 4. Hiểu và giải quyết bài toán **Đồng bộ dữ liệu (Cache Invalidation)**: Khi trạng thái monitor thay đổi thì xóa cache thế nào để người dùng không đọc phải dữ liệu cũ (Stale Data)?
> 5. Xây dựng Middleware **Rate Limiting** chặn spam request (60 req/phút/IP) bằng thuật toán bộ đếm nguyên tử `INCR` + `EXPIRE` (trả về mã HTTP `429 Too Many Requests`).
> 6. Đo lường hiệu năng bằng công cụ bắn tải **`autocannon`**, ghi nhận con số cải thiện thực tế (req/s, p95 latency) vào báo cáo.

---

## 📋 DANH SÁCH CÔNG VIỆC CẦN LÀM (TASKS)

- [x] **Task 5.1:** Thêm Redis vào `docker-compose.yml`, khởi động container và thực hành 5 lệnh nền tảng trong `redis-cli`: `SET`, `GET`, `EXPIRE`, `TTL`, `INCR` (2 giờ).
- [x] **Task 5.2:** Thêm cột `slug` vào model `monitors` (`schema.prisma`), chạy Migration. Viết API công khai `GET /api/status/:slug` áp dụng **Cache-Aside Pattern** với TTL = 30 giây (4 giờ).
- [x] **Task 5.3:** Cài đặt cơ chế **Xóa cache chủ động (Cache Invalidation)**: Khi monitor đổi trạng thái (trong `checkNowMonitor` hoặc cập nhật thông tin), tự động xóa key Redis tương ứng (1 giờ).
- [x] **Task 5.4:** Viết Middleware **Rate Limiting** dùng Redis `INCR` + `EXPIRE` chặn mỗi IP tối đa 60 request/phút, trả về `429 Too Many Requests` kèm header `Retry-After` (3 giờ).
- [x] **Task 5.5:** Dùng công cụ bắn tải `autocannon` so sánh hiệu năng của API `/api/status/:slug` khi **Chưa có Cache** vs **Đã có Cache** (req/s, p95 latency), lập báo cáo `REPORT_WEEK5.md` (2 giờ).

---

## 🧠 3 CÂU HỎI LÝ THUYẾT CỐT LÕI (CẦN TỰ TRẢ LỜI ĐƯỢC)

### ❓ Câu hỏi 1: Redis là gì? Tại sao Redis lại nhanh hơn PostgreSQL hàng chục đến hàng trăm lần?
* **Bản chất của Redis:** Redis là cơ sở dữ liệu **Lưu hoàn toàn trên RAM (In-Memory Data Store)** dưới dạng Key-Value.
* **Vì sao Redis siêu nhanh (dưới 0.5ms)?**
  1. **RAM vs Ổ cứng (Disk):** 
     * PostgreSQL dù tối ưu đến mấy thì đích đến cuối cùng vẫn phải ghi xuống đĩa cứng (SSD/HDD) để không mất dữ liệu khi cúp điện. Tốc độ đọc ghi của SSD tính bằng **Micro-giây ($\mu s$)**.
     * Redis lưu trực tiếp trên thanh RAM của máy tính. Tốc độ truy xuất của RAM tính bằng **Nano-giây ($ns$)** — nhanh hơn SSD gấp **hàng nghìn lần**!
  2. **Kiến trúc Single-Threaded Event Loop (Đơn luồng):**
     * Đa luồng (Multi-threading) thường bị nghẽn do tranh chấp tài nguyên (Lock contention, Context switching).
     * Redis xử lý các lệnh theo dạng đơn luồng tuần tự qua Event Loop cực kỳ tinh gọn, không bao giờ tốn thời gian chờ đợi khóa dữ liệu.
  3. **Cấu trúc dữ liệu tối ưu ở tầng C:**
     * Redis được viết bằng ngôn ngữ C, các cấu trúc dữ liệu (`String`, `Hash`, `List`, `Set`) được tối ưu hóa bộ nhớ đến từng byte.

---

### ❓ Câu hỏi 2: Mô hình Cache-Aside là gì? Vì sao bắt buộc phải có TTL (Time-To-Live)? Cache Invalidation là gì?
* **Mô hình Cache-Aside (Lazy Loading):**
  1. Ứng dụng nhận request $\rightarrow$ Hỏi Redis trước: *"Có dữ liệu cho key này không?"*.
  2. **Cache Hit (Trúng thưởng):** Redis có dữ liệu $\rightarrow$ Trả về ngay lập tức cho client (tốn `0.5ms`, không đụng tới Postgres).
  3. **Cache Miss (Trượt):** Redis chưa có $\rightarrow$ Truy vấn vào PostgreSQL (tốn `20ms`) $\rightarrow$ Lưu kết quả vừa tìm được vào Redis kèm hạn sử dụng (TTL) $\rightarrow$ Trả về cho client.
* **Vì sao bắt buộc phải có TTL (Time-To-Live)?**
  * **Chống tràn RAM (OOM - Out of Memory):** RAM rất đắt và hữu hạn (8GB - 16GB). Nếu không đặt thời gian hết hạn (`TTL`), dữ liệu sẽ nằm vĩnh viễn trên RAM đến khi máy chủ sập vì cạn bộ nhớ.
  * **Tự động làm mới dữ liệu:** Giúp dữ liệu rác hoặc dữ liệu lỗi thời tự động bị hủy sau một khoảng thời gian (ví dụ 30 giây).
* **Cache Invalidation (Xóa cache chủ động):**
  * *"Chỉ có 2 điều khó nhất trong ngành khoa học máy tính: Đặt tên biến và Xóa Cache (Cache Invalidation)"* — Martin Fowler.
  * Nếu trang web vừa bị sập lúc 15:00:00, nhưng Redis vẫn còn hạn cache cũ báo web "Đang sống" đến 15:00:30 $\rightarrow$ Khách hàng vào xem sẽ thấy thông tin sai lệch (**Dữ liệu cũ - Stale Data**).
  * Do đó, khi trạng thái thay đổi, hệ thống phải **chủ động gọi lệnh `redis.del(key)`** để xóa ngay dữ liệu cũ, buộc lượt truy cập tiếp theo phải lấy dữ liệu mới nhất từ DB!

---

### ❓ Câu hỏi 3: Rate Limiting bằng `INCR` + `EXPIRE` (Cửa sổ cố định) hoạt động thế nào? Điểm yếu "Dồn request ở ranh giới" là gì?
* **Cách hoạt động (Fixed Window Counter):**
  1. Với mỗi request từ IP `1.2.3.4`, tạo key: `rl:1.2.3.4`.
  2. Dùng lệnh `INCR` (tăng biến đếm lên 1 một cách nguyên tử - Atomic).
  3. Nếu đây là request đầu tiên (`count === 1`), đặt thời gian hết hạn: `EXPIRE key 60` (sống trong 60 giây).
  4. Nếu `count > 60` $\rightarrow$ Chặn lại ngay lập tức, trả về mã **`429 Too Many Requests`**.
* **Điểm yếu "Dồn request ở ranh giới hai cửa sổ" (Boundary Burst Spike):**
  * Giả sử giới hạn là **60 request / phút** (từ giây 0 đến giây 60):
    * Kẻ tấn công im lặng từ giây 0 đến giây 58.
    * Vào **giây 59**: Bắn dồn dập **60 request** $\rightarrow$ Hợp lệ (vẫn trong cửa sổ phút thứ 1).
    * Bước sang **giây 60 (bắt đầu phút thứ 2)**: Key cũ hết hạn, cửa sổ mới mở ra, kẻ tấn công bắn tiếp **60 request** $\rightarrow$ Vẫn hợp lệ!
  * **Hậu quả:** Trong khoảng thời gian chỉ vỏn vẹn **2 giây** (từ giây 59 đến giây 61), máy chủ phải hứng chịu **120 request** (gấp đôi giới hạn cho phép)!
  *(Sau này các hệ thống lớn dùng thuật toán nâng cao như Sliding Window Log hoặc Token Bucket để khắc phục, nhưng Fixed Window là nền tảng cốt lõi phải hiểu trước).*

---

## 🏗️ CẤU TRÚC KIẾN TRÚC TUẦN 5

```mermaid
flowchart TD
    Client["Client (Người dùng / Bot)"] --> RateLimit["1. Middleware Rate Limit
    (Redis INCR key <= 60 req/min)"]
    RateLimit -->|Vượt quá 60 req| Block["Trả về HTTP 429 Too Many Requests"]
    RateLimit -->|Hợp lệ| CacheCheck{"2. Cache-Aside:
    Redis có key 'status:slug' không?"}
    
    CacheCheck -->|Cache HIT (Có)| FastReturn["Trả về ngay lập tức (0.5ms)"]
    CacheCheck -->|Cache MISS (Không)| QueryDB["Truy vấn PostgreSQL (20ms)"]
    
    QueryDB --> SaveCache["Lưu vào Redis (TTL 30s)"]
    SaveCache --> ReturnData["Trả dữ liệu cho Client"]
    
    Event["Sự kiện: Monitor đổi trạng thái (UP/DOWN)"] --> Invalidate["Cache Invalidation:
    redis.del('status:slug')"]
```

---

## 🎯 TIÊU CHÍ NGHIỆM THU (DONE DEFINITION)

1. Khởi chạy thành công Redis qua `docker-compose.yml`, dùng `redis-cli` thực hiện trơn tru các lệnh: `SET`, `GET`, `EXPIRE`, `TTL`, `INCR`.
2. API `GET /api/status/:slug` hoạt động không cần đăng nhập:
   - Lần 1: Cache Miss (lấy từ PostgreSQL, lưu vào Redis).
   - Lần 2: Cache Hit (lấy trực tiếp từ Redis trong < 1ms).
3. Đổi trạng thái monitor bằng nút "Check Now" $\rightarrow$ Cache của slug đó bị xóa tức thì, lần gọi status kế tiếp lấy dữ liệu mới ngay lập tức.
4. Gửi request thứ 61 trong vòng 1 phút từ cùng 1 IP $\rightarrow$ Bị chặn đứng với mã HTTP `429 Too Many Requests`.
5. Chạy benchmark bằng `autocannon` tạo ra 2 con số so sánh rõ rệt giữa Không Cache vs Có Cache (req/s tăng vọt, p95 latency giảm sâu).
