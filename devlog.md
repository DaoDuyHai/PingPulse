# 📓 SỔ TAY KIẾN THỨC BACKEND - PINGPULSE
> *Tài liệu cô đọng để đọc lại mỗi ngày – Nắm chắc tư duy kiến trúc và bản chất công nghệ.*

---

## 🧭 PHẦN 1: TƯ DUY LẬP TRÌNH & TYPESCRIPT NÂNG CAO

### 1. Tính bất biến (Immutability) & Lập trình phòng thủ
* **Không biến đổi dữ liệu gốc:** Tránh dùng `splice`, `push` trực tiếp trên mảng gốc; ưu tiên tạo mảng/object mới (`{ ...obj }`, `slice`).
* **Lọc trường nhạy cảm (`pick` / `omit`):** Luôn loại bỏ các thông tin mật (`password`, `token`, `internalKey`) trước khi trả dữ liệu về phía client.
* **Chống Prototype Pollution (`groupBy`):** Khi tạo object gom nhóm dạng từ điển, dùng `Object.create(null)` thay vì `{}` để không kế thừa `__proto__`, triệt tiêu lỗ hổng bảo mật ghi đè prototype.

### 2. Xử lý kiểu dữ liệu nghiêm ngặt (Strict TypeScript)
* **Tuyệt đối không dùng `any`:** `any` làm mất toàn bộ giá trị của TypeScript. Hãy dùng `unknown` khi chưa rõ kiểu, sau đó dùng Type Guard (`typeof`, `instanceof`) để ép kiểu an toàn.
* **Discriminated Union (`Result<T, E>`):** Thay vì quăng lỗi (`throw error`) làm sập luồng, gói kết quả vào `{ ok: true, data }` hoặc `{ ok: false, error }`. TypeScript sẽ tự ép người dùng phải kiểm tra `if (res.ok)` mới cho lấy dữ liệu.
* **Kiểm soát tải với `chunk`:** Chia mảng lớn thành các mẻ nhỏ (batching) để chạy tuần tự hoặc giới hạn song song, bảo vệ tài nguyên mạng và RAM.
* **Chống bão tác vụ (`debounce` & `retry`):** 
  * `debounce`: Trì hoãn việc gọi hàm cho đến khi người dùng ngừng thao tác (gõ phím, click liên tục).
  * `retry`: Tự động thử lại hàm bất đồng bộ khi mạng chập chờn kèm khoảng chờ (`sleep`).

---

## 🗄️ PHẦN 2: DATABASE, POSTGRESQL & PRISMA ORM

### 1. Bản chất của một "Connection" (Kết nối mạng)
* Một kết nối DB là một đường ống mạng TCP Socket thực thụ. Mở kết nối tốn rất nhiều tài nguyên (bắt tay 3 bước, SSL, xác thực mật khẩu, Postgres tốn 5-10MB RAM/tiến trình con).
* **Connection Pool (Bể kết nối):** Giống đội xe taxi đậu sẵn. Khởi động server thì mở sẵn 5-10 kết nối, có query thì lấy ra dùng, xong việc trả lại bể. Không mở/đóng liên tục.

### 2. Singleton Pattern (`db.ts`) – Chống nghẽn kết nối
* Mỗi lần gọi `new PrismaClient()` là tạo ra **1 Bể kết nối mới**.
* Nếu gọi `new` ở khắp nơi $\rightarrow$ sinh ra hàng chục Bể $\rightarrow$ vượt quá giới hạn cứng của Postgres (`max_connections ~ 100`) $\rightarrow$ Sập database (`P2024` / `FATAL: remaining connection slots`).
* **Singleton:** Khởi tạo duy nhất 1 lần ở `db.ts`. Cơ chế Module Cache của Node.js đảm bảo mọi nơi `import { prisma }` đều dùng chung 1 đối tượng duy nhất, an toàn tuyệt đối.

### 3. Cơ chế Hàng đợi (Queue) & Connection Timeout
* Khi có 100 query ùa vào mà bể chỉ có 10 kết nối:
  * 10 query đầu chiếm 10 kết nối.
  * 90 query còn lại đứng xếp hàng trong **Hàng đợi (Waiting Queue)**.
  * Do mỗi query DB có index chạy cực nhanh (1 - 3 mili-giây), 10 kết nối có thể phục vụ 3.000 - 5.000 query/giây. 90 người chờ chỉ mất tích tắc là xong.
* **Connection Timeout (Chiếc phanh khẩn cấp):** Nếu query bị kẹt quá 10 giây (do không index / deadlock), hệ thống tự ngắt và báo lỗi khách đó, thà hy sinh 1 khách còn hơn để sập toàn bộ Database.

### 4. Database Migration vs Sửa tay
* **Migration là Git cho Database:** Lưu lịch sử mọi thay đổi cấu trúc bảng dưới dạng file SQL có mốc thời gian.
* **Tuyệt đối không sửa tay trên Production:** Sửa tay trên máy mình thì Production không có cột mới $\rightarrow$ Sập web. Dùng migration để mọi môi trường đồng bộ 100%.

### 5. Triệt tiêu lỗi hiệu năng N+1 Query
* **Lỗi N+1:** Lấy 100 website (1 query), sau đó dùng vòng lặp chạy 100 lần để lấy lần check mới nhất của từng web (thêm 100 query). Tổng cộng $1 + 100 = 101$ query làm nghẽn DB.
* **Cách khắc phục:** Dùng `JOIN` hoặc `LATERAL JOIN` để Database tự xử lý và trả về đúng 1 lần truy vấn duy nhất.

### 6. Bản chất Index & Cây B-Tree (Cơ chế phân tầng & Khối nhớ 8KB)
* **Không có Index:** Database phải cày cuốc quét từ dòng đầu đến dòng cuối (**`Seq Scan`**), vứt bỏ hàng trăm nghìn dòng rác (`Rows Removed`).
* **Đơn vị khối nhớ 8KB (Page):** PostgreSQL đọc/ghi đĩa theo từng khối 8KB. Một khối 8KB chứa được ~300 đến 500 con trỏ (gọi là **Hệ số phân nhánh - Fan-out**).
* **Cấp số nhân của cây B-Tree:** 
  * Tầng 1 (Gốc): ~300 con trỏ.
  * Tầng 2 (Nhánh): $300 \times 300 = 90.000$ bản ghi.
  * Tầng 3 (Lá): $300^3 = 27.000.000$ (**27 triệu bản ghi!**).
  * 👉 Dù bảng có 100.000 hay 10 triệu dòng, cây B-Tree vẫn chỉ cao **3 tầng**. Bất kỳ lượt tìm kiếm nào cũng chỉ tốn tối đa **3 nhịp đọc** ($O(\log N)$).
* **Buffer Cache (RAM):** Tầng 1 và 2 rất nhẹ nên Postgres găm luôn vào RAM. Thực tế 3 nhịp tìm kiếm chỉ gồm 2 nhịp đọc RAM + 1 nhịp đọc SSD $\rightarrow$ Truy vấn hoàn thành trong **`0.1 ms`**!
* **Cơ chế tách trang (Page Split):** Khi một khối 8KB bị đầy, Postgres tự động chẻ đôi thành 2 khối 4KB và đẩy 1 con trỏ lên tầng trên, giữ cây luôn cân bằng tuyệt đối.
* **Đặc quyền của Khóa chính (`@id`) & `@unique`:** Mọi cột khóa chính hoặc unique đều được Database **tự động tạo sẵn một B-Tree Index ngầm** (ví dụ: `checks_pkey`, `users_email_key`).
* **Đặc tính sắp xếp (`DESC`):** Giúp ngắt sớm câu lệnh (**Early Exit**). Khi tìm `LIMIT 10`, Postgres chỉ cần bốc 10 bản ghi đầu tiên ở lá cây rồi **dừng ngay lập tức**, không quét phần còn lại (tăng tốc gấp **125 lần**).

### 7. Công thức vàng thiết kế Index (Quy tắc ESR)
> **"Query có trước, Index theo sau."** Nhìn vào câu SQL hay chạy nhất để bóc tách:
1. **Cột dùng dấu `=` (Equality):** Luôn đặt **ĐỨNG ĐẦU TIÊN** trong Index (ví dụ: `monitor_id`).
2. **Cột dùng để `ORDER BY` hoặc so sánh khoảng (`>`, `<`):** Đặt **ĐỨNG THỨ HAI** (ví dụ: `checked_at DESC`).
* 👉 Ví dụ: `CREATE INDEX idx_checks_monitor_time ON checks (monitor_id, checked_at DESC);`
* **Quy tắc Trái sang Phải (Leftmost Prefix):** Index `(A, B)` chỉ phát huy tác dụng khi câu lệnh có điều kiện lọc theo cột `A`. Nếu câu lệnh chỉ lọc theo cột `B` mà không có `A`, Index sẽ bị vô hiệu hóa!

### 8. Nghệ thuật đánh đổi (Trade-off) của Index
* **Index giúp ĐỌC nhanh hơn, nhưng làm GHI (INSERT) chậm đi:** Mỗi lần ghi dữ liệu mới, Postgres phải cập nhật lại toàn bộ các cây Index trên đĩa.
* **Nguyên tắc:** Chỉ đánh Index cho các câu truy vấn chạy liên tục trên giao diện chính của khách hàng; không đánh index bừa bãi cho các báo cáo nội bộ thỉnh thoảng mới chạy.

### 9. Bản chất bài toán Top-N per Group & Sức mạnh của `LATERAL JOIN`
* **Bài toán:** Lấy đúng 1 check mới nhất cho mỗi monitor trong danh sách (ít "cha", nhiều "con").
* **Vì sao `LATERAL JOIN` tối ưu ở quy mô này?** 
  * Nó thực hiện đúng bản chất: Với mỗi monitor (100 cha), nhảy vào cây Index bốc đúng 1 dòng mới nhất trên đỉnh (100 lần tra index siêu nhanh), hoàn toàn không phải quét 500.000 dòng.
* **Tư duy tỉnh táo về số liệu:** Các con số đo đạc phụ thuộc vào phần cứng, bộ nhớ đệm (Cache) và quy mô dữ liệu. Không nhớ số liệu như hằng số tuyệt đối, điều cốt lõi là hiểu: **Cách viết query quyết định việc Database có tận dụng được Index hay không**.

### 10. Phân vai chuẩn mực: Khi nào dùng Prisma vs SQL thuần?
* **CRUD hàng ngày (Thêm, sửa, xóa đơn giản):** Dùng **PRISMA** (Code nhanh, Type-safe an toàn, không sợ gõ sai tên cột).
* **Báo cáo, Thống kê, Dữ liệu lớn (`LATERAL JOIN`, `generate_series`, `date_trunc`, `COUNT(*) FILTER`):** Dùng **SQL THUẦN** (Tối ưu từng mili-giây, không bị ORM cản trở, tránh kéo hàng vạn dòng về RAM server).

### 11. Phân vai công cụ: Prisma Migration vs DBeaver / pgAdmin
* **Đụng đến CẤU TRÚC (Schema: tạo bảng, thêm cột, tạo Index):** Bắt buộc làm qua **PRISMA** (`schema.prisma` $\rightarrow$ `prisma migrate dev`) để lưu lịch sử Git cho Production.
* **Thử nghiệm, đo hiệu năng, viết câu query:** Cứ **DBeaver / pgAdmin** mà thử nghiệm trực tiếp (nhanh, trực quan, không làm bẩn code dự án).

---

## 📄 PHẦN 3: CHIẾN LƯỢC PHÂN TRANG (PAGINATION) Ở QUY MÔ LỚN

### 1. Offset Pagination (`LIMIT :limit OFFSET :offset`)
* **Bản chất:** Hình tượng "Lật từng trang sách". Muốn xem trang thứ 1.000 (`OFFSET 20000 LIMIT 20`), Database buộc phải duyệt qua 20.000 dòng đầu rồi vứt đi, sau đó mới lấy 20 dòng tiếp theo.
* **Nhược điểm:** Càng sang trang sâu càng chậm ($O(N)$). Dễ bị **nhảy dòng / trùng lặp** khi có bản ghi mới chèn vào đầu bảng trong lúc người dùng đang lật trang.
* **Ứng dụng:** Thích hợp cho các bảng nhỏ (ví dụ bảng `monitors` của 1 user $\le 50$ dòng), cần thanh số trang `[1] [2] [3]...` để nhảy cóc.

### 2. Cursor Pagination (`WHERE id < :cursor ORDER BY id DESC LIMIT :limit`)
* **Bản chất:** Hình tượng "Chiếc thẻ kẹp sách (Bookmark)". Khi đọc xong trang trước, lưu lại `id` của bản ghi cuối cùng (`cursor`). Lần sau chỉ cần bảo DB: *"Lấy cho tôi 20 dòng ngay sau chiếc bookmark này"*.
* **Ưu điểm vượt trội:**
  * Nhờ B-Tree Index trên `id`, Database nhảy thẳng (Index Seek) tới vị trí bookmark.
  * Tốc độ ở trang 1 hay trang 10.000 đều như nhau (**$O(1)$ ~ 0.1ms**).
  * Không bao giờ bị trùng hoặc sót dữ liệu dù có hàng triệu dòng mới được chèn vào đầu bảng.
* **Kỹ thuật lấy dư 1 dòng (`take: limit + 1`):**
  * Client xin 20 dòng $\rightarrow$ Query lấy 21 dòng.
  * Nếu kết quả $> 20$: Chắc chắn **còn trang sau** (`hasNextPage = true`), lấy `id` của dòng 20 làm `nextCursor`, cắt bỏ dòng 21.
  * Triệt tiêu hoàn toàn nhu cầu chạy câu lệnh `COUNT(*)` đắt đỏ trên bảng 500.000 dòng.
* **Ứng dụng:** Bắt buộc cho bảng dữ liệu khổng lồ (bảng `checks`, News Feed, Tin nhắn, Logs) với trải nghiệm Infinite Scroll / Nút "Xem thêm".

---

## 🏛️ PHẦN 4: THIẾT KẾ RESTFUL RESOURCE & BẢO MẬT BACKEND

### 1. Nguyên tắc tách biệt Resource Cha - Con (Monitors & Checks)
* **Không nhét lịch sử checks vào API Detail:** Bảng checks có thể lên tới 50.000 dòng/monitor. Nếu kéo toàn bộ checks vào `getDetailMonitor`, server sẽ bị cạn kiệt RAM và truyền thừa dữ liệu mỗi khi người dùng bấm "Xem thêm".
* **Bộ ba API chuẩn mực:**
  1. `GET /api/monitors/:id`: Trả về thông tin cấu hình Monitor (Tên, URL, tần suất, trạng thái). Gọi 1 lần khi vào trang.
  2. `GET /api/monitors/:id/stats`: Trả về Uptime % và Latency trung bình (24h & 7d). Tính toán bằng Raw SQL Aggregate siêu tốc trong 1-2ms nhờ Composite Index.
  3. `GET /api/monitors/:id/checks`: Danh sách lịch sử checks có phân trang Cursor. Mỗi lần bấm "Xem thêm" chỉ gọi duy nhất endpoint này.

### 2. Xác thực (Authentication) & Phân quyền (Authorization)
* **Lấy danh sách (`getMonitors`):** Tự động lọc bằng `WHERE user_id = ${userId}` (lấy từ JWT token). Người dùng không thể thấy tài nguyên của người khác.
* **Thao tác theo ID (`getDetail`, `checks`, `delete`):** Bắt buộc chạy hàm `findOwnedMonitor` để chặn trường hợp User A cố tình gõ ID của User B (ném lỗi `403 Forbidden`).
* **Bảo vệ nhiều lớp (Defense in Depth):**
  * **Network Isolation:** Cổng Database (5432) chỉ mở cho mạng nội bộ (Private Subnet), không bao giờ mở ra Internet.
  * **Parameterized Queries:** Prisma ORM và Tagged Template (`prisma.$queryRaw`) tự động biến dữ liệu đầu vào thành tham số thuần túy, triệt tiêu hoàn toàn lỗ hổng **SQL Injection**.

### 3. Luật nghiệp vụ: Backend API vs Database Constraints
* Giới hạn "Tối đa 5 monitor" được chặn ở tầng Ứng dụng (API Express).
* Khi Seed dữ liệu kiểm thử tải lớn, câu lệnh SQL đi thẳng vào Database (Bypass API) nên có thể nạp 100 monitors mà không bị chặn.
* Nếu muốn chặn cứng cả ở tầng Database: Dùng **PostgreSQL Trigger** (`BEFORE INSERT`).

### 4. Bản chất Băm mật khẩu (Bcrypt Hashing)
* **Băm (Hashing) vs Mã hóa (Encryption):**
  * Mã hóa là 2 chiều (có chìa khóa là giải mã ngược lại được).
  * Băm là **hàm toán học 1 chiều (One-way function)**: Giống máy xay sinh tố, thành ly sinh tố rồi thì không thể biến ngược lại thành quả hoa quả ban đầu.
* **Cơ chế so khớp (`bcrypt.compare`):** Khi đăng nhập, server không dịch ngược hash trong DB, mà lấy mật khẩu người dùng vừa gõ đem đi băm tiếp, rồi so sánh xem 2 chuỗi hash có giống nhau không.
* **Muối (Salt) & Cost Factor:** Trộn chuỗi ngẫu nhiên để chống bảng tra Rainbow Table, và làm chậm CPU (~100ms) để chống tấn công dò mật khẩu (Brute-force).

### 5. Production Hardening: Helmet & High-Performance Logging (Pino)
* **Helmet:** Tự động tiêm 11 HTTP Security Headers chuẩn OWASP, loại bỏ header `X-Powered-By: Express` để che giấu công nghệ máy chủ, ngăn chặn clickjacking và MIME-sniffing.
* **Pino vs Morgan/Winston:**
  * Morgan xuất text thô $\rightarrow$ Khó cho các công cụ giám sát log tự động (ELK / Loki / Datadog) truy vấn.
  * Pino ghi log dạng **Structured JSON**, xử lý bất đồng bộ siêu tốc (nhanh gấp 5 lần Morgan/Winston, không block Event Loop như `console.log`).
  * Trong môi trường Dev: Kết hợp `pino-pretty` để format log có màu sắc và thời gian rõ ràng; khi lên Production: Tự động xuất JSON chuẩn để giám sát.

### 6. Kiến trúc Xử lý Lỗi (Error Handling) & Cơ chế phễu ngầm của Express 5
* **Bản chất của `throw`:** Lệnh dừng khẩn cấp! Ngay khi chạm vào `throw`, mọi dòng code phía sau lập tức bị hủy bỏ, ném một "quả cầu lỗi" ra ngoài để tìm khối hứng lỗi.
* **Hành trình quả bóng lỗi trong PingPulse (Cực kỳ trực quan):**
  1. Hàm `createHttpError(400, 'Ten monitor khong hop le')` sẽ **tạo ra 1 con lỗi custom** (đối tượng `HttpError`) mang theo sẵn mã `statusCode = 400` và câu `message`.
  2. Lệnh `throw` sẽ **ném thẳng con lỗi custom đó đi**.
  3. Express 5 tự động bọc ngầm các hàm `async` bằng `Promise.resolve(fn).catch(next)` để chụp lấy con lỗi vừa bị ném mà ta không cần gõ `try/catch` hay `next(err)` bằng tay.
  4. Quả bóng lỗi nhảy cóc qua toàn bộ các route khác, và **chính con lỗi custom đó biến thành tham số `err` (tham số đầu tiên)** trong bộ 4 tham số: `(err, req, res, next)` của `errorMiddleware.ts`.
  5. Trong `errorHandler`, ta chỉ cần kiểm tra: `if (err instanceof HttpError)` là bốc ngay được `err.statusCode` (400) và `err.message` để đóng gói JSON trả về cho client!
* **Cơ chế đếm tham số độc nhất của Express:**
  * Middleware thường: Có **3 tham số** `(req, res, next)`.
  * Middleware bắt lỗi: Bắt buộc có đủ **4 tham số** `(err, req, res, next)`. Express thấy có `throw` là tự động bỏ qua mọi hàm 3 tham số, tìm đến đúng hàm 4 tham số ở đáy server để xử lý.
* **Quy tắc vàng: Khi nào cần `try/catch` trong Express 5?**
  * **Trong Controller / API:** Không cần `try/catch`, cứ `throw` cho Express 5 tự lo đưa về `errorHandler`.
  * **Trong Utility / Con robot độc lập (`checkUrl.ts`):** Bắt buộc phải có `try/catch`! Vì việc "website khách hàng bị sập" là **kết quả đo đạc nghiệp vụ** (`isUp: false`), không phải lỗi hệ thống của PingPulse; nếu không `try/catch` thì con robot sẽ nổ tung và không ghi được kết quả vào DB.

---

## 🧪 PHẦN 5: KIỂM THỬ TỰ ĐỘNG (UNIT TESTING) & NGHỆ THUẬT MOCKING

### 1. Bản chất của Mocking (Diễn viên đóng thế)
* **Vì sao không gọi mạng thật (Google / link chết)?**
  * **Không thể test lỗi 500:** Không có website nào trên đời luôn luôn bị lỗi máy chủ 500 suốt 24/7 để bạn test mỗi ngày. Chỉ có Mock mới ép nó trả về mã 500 được trong 1 mili-giây.
  * **Timeout thực tế quá lâu:** Gõ link không tồn tại, máy tính tốn 3 - 5 giây để dò DNS rồi mới chịu báo lỗi. 100 bài test sẽ tốn 5 phút (Dùng mock: xong trong **0.3 giây**).
  * **Tránh bị chặn IP (Rate Limit / CAPTCHA):** Chạy test tự động nhiều lần trên GitHub Actions sẽ bị Google xem là bot spam và chặn IP.
  * **Chạy Offline 100%:** Ngồi trên máy bay, tàu xe hay mất mạng wifi vẫn chạy test xanh mướt.
* **Nguyên lý của Unit Test với Mock:**
  * Mock chỉ "đóng thế" hàm I/O mạng (`fetch()`).
  * **Toàn bộ não và logic tính toán bên trong hàm của bạn VẪN CHẠY THẬT 100%:** Phép tính độ trễ `performance.now() - start`, logic so sánh `res.status < 400`, và khối `try/catch` bắt lỗi.
* **Lỗi HTTP 500 vs Lỗi Đứt cáp/Timeout:**
  * Khi web bị lỗi **500**: Máy chủ vẫn phản hồi kịp $\rightarrow$ `fetch` vẫn thành công trong `try` $\rightarrow$ **`latencyMs` vẫn là kiểu `number` ($\ge 0$)**!
  * Khi bị **đứt mạng / timeout**: Không có ai phản hồi $\rightarrow$ Rơi xuống khối `catch` $\rightarrow$ **`latencyMs` lúc này mới bằng `null`**!

### 2. Lập trình phòng thủ: Type Guard trong `catch (err)`
* **Tại sao viết `err instanceof Error ? err.message : String(err)`?**
  * Trong JavaScript, bạn có thể `throw` bất cứ thứ gì: chuỗi `throw "Lỗi rồi"`, con số `throw 500`, hoặc object trần.
  * 99% lỗi chuẩn là `instanceof Error` (có sẵn `.message` và `.stack`).
  * 1% ai đó ném chuỗi thô $\rightarrow$ Biến `err` không hề có `.message`! `String(err)` giúp ép kiểu an toàn ra chuỗi mà không bao giờ bị văng lỗi `undefined`.
  * Thỏa mãn chuẩn kiểu dữ liệu `unknown` của TypeScript trong khối `catch`.

---

## 🌐 PHẦN 6: MỞ RỘNG KIẾN TRÚC HỆ THỐNG LỚN (SYSTEM DESIGN)

Khi lượng người dùng lên tới hàng trăm nghìn hoặc hàng triệu:
1. **Caching với Redis:** Lưu dữ liệu đọc nhiều (80% lượt xem) trên RAM. Trả lời ngay lập tức mà không cần chạm vào Database.
2. **Read Replicas (Nhân bản DB):** Tách thành 1 máy chủ Master chuyên Ghi (Insert/Update) và 3-5 máy chủ Slaves chuyên Đọc (Select).
3. **PgBouncer (Bến xe trung tâm):** Đứng giữa Backend và Postgres, gom hàng nghìn kết nối từ backend thành vài chục kết nối tinh gọn tới DB.

---

## 💻 PHẦN 7: FRONTEND INTEGRATION & HYDRATION

1. **Next.js App Router (SSR vs Client Component):**
   * Mặc định component chạy trên Server để tối ưu SEO và tải trang nhanh.
   * Những trang cần tương tác người dùng (`useState`, `useEffect`, `localStorage`) phải khai báo `'use client'`.
2. **Lỗi Cascading Renders:**
   * Không gọi `setState` đồng bộ ngay đầu `useEffect`.
   * Gói vào hàm `async fetchData()` để cập nhật state sau khi dữ liệu mạng đã sẵn sàng, kèm cờ `isMounted` để tránh rò rỉ bộ nhớ khi người dùng chuyển trang nhanh.
3. **URL State vs In-Page State:**
   * Dùng `useState` cho Modal/Popup và phân trang nội bộ để chuyển cảnh tức thì không giật URL.
   * Dùng URL Query Params (`?page=2`) khi cần chia sẻ đường dẫn trực tiếp (Sharable Link).

---

## 🛡️ PHẦN 8: KIẾN TRÚC SỰ CỐ, DATABASE TRANSACTION (ACID) & INTEGRATION TESTING

### 1. Hàm thuần (Pure Function) & Cỗ máy trạng thái sự cố (State Machine)
* **Tách Não khỏi Chân Tay:**
  * Logic nghiệp vụ phán quyết sự cố (`decideIncident.ts`) được tách hoàn toàn độc lập khỏi Database và Express.
  * **Hàm thuần (Pure Function):** Cùng đầu vào $\rightarrow$ Luôn ra cùng đầu ra, không gây tác dụng phụ (no side-effects). Nhờ vậy, Unit Test chạy siêu tốc trong **vài mili-giây**, không phụ thuộc mạng hay Postgres.
* **Chống báo động giả (Alert Fatigue) bằng State Machine:**
  * Không bao giờ báo sập chỉ vì 1 lần ping thất bại (có thể do mạng chập chờn tạm thời).
  * Chỉ quan tâm tới **Thời điểm chuyển trạng thái (State Transition)**:
    1. Đang bình thường $\rightarrow$ **3 lần lỗi liên tiếp**: Chính thức mở sự cố (`action = 'open'`).
    2. Đang có sự cố $\rightarrow$ **2 lần OK liên tiếp**: Đóng sự cố, phục hồi (`action = 'close'`).
    3. Mọi tình huống khác (đang sập vẫn sập, đang sống vẫn sống, hoặc lỗi xen kẽ): Không làm phiền ai cả (`action = 'none'`).

### 2. Thiết kế Database cho Vòng đời Sự cố (`resolved_at: null`)
* **1 mũi tên trúng 2 đích:** Thay vì tạo cột `is_open: boolean`, dùng cột `resolved_at: DateTime?`.
  * `null`: Sự cố **đang mở** (chưa giải quyết).
  * Có ngày giờ: Sự cố **đã đóng**.
  * Tính được chính xác thời gian gián đoạn dịch vụ: $\text{Downtime} = \text{resolved\_at} - \text{started\_at}$.
* **Quy luật bất biến (Invariant):**
  * Tại một thời điểm, một monitor chỉ có tối đa 1 sự cố đang mở.
  * Do đó, **sự cố đang mở (nếu có) BẮT BUỘC LUÔN LÀ SỰ CỐ MỚI NHẤT!**
  * Chỉ cần bốc sự cố mới nhất (`started_at DESC LIMIT 1`), nếu nó đã đóng thì chắc chắn toàn bộ quá khứ đều đã đóng.

### 3. Phân biệt `ORDER BY` vs `INDEX` trong Database
* **`ORDER BY` là MỆNH LỆNH (YÊU CẦU):** Nói cho Database biết bạn muốn lấy dữ liệu theo thứ tự nào. Nếu không có `ORDER BY`, Database có quyền bốc ra bất kỳ dòng nào ngẫu nhiên.
* **`INDEX` là CÔNG CỤ (ĐƯỜNG TẮT):** Giúp Database thực thi mệnh lệnh `ORDER BY` trong **`0.01 ms`** mà không phải còng lưng quét toàn bộ bảng rồi mang lên RAM sort thủ công.
* **Composite Index `[monitor_id, started_at(sort: Desc)]`:**
  * Cột 1 (`monitor_id`): Phục vụ mệnh đề `WHERE` (gom nhóm các sự cố của cùng một monitor vào một cành B-Tree).
  * Cột 2 (`started_at DESC`): Phục vụ mệnh đề `ORDER BY` (trong nội bộ từng monitor, các sự cố đã được xếp sẵn từ mới nhất đến cũ nhất).

### 4. Database Transaction & Tính nguyên tử (ACID - Atomicity)
* **Nguyên tắc "Được ăn cả, ngã về không" (All-or-Nothing):**
  * Khi mở sự cố, hệ thống phải vừa ghi vào bảng `incidents`, vừa đổi `monitors.status = 'down'`.
  * Nếu không dùng Transaction: Lỗi giữa chừng sẽ làm dữ liệu bị lệch pha (bảng này ghi rồi, bảng kia chưa ghi).
  * Bọc trong `prisma.$transaction(async (tx) => { ... })`: Đảm bảo tất cả cùng thành công (**Commit**), hoặc nếu có lỗi dù ở dòng cuối cùng thì Database cũng tự động thu hồi lại sạch sẽ (**Rollback**).
* **Kiểm chứng thực tế:** Cố tình `throw new Error()` ngay sau khi tạo check $\rightarrow$ PostgreSQL kích hoạt lệnh `ROLLBACK` $\rightarrow$ Số lượng bản ghi trong DB giữ nguyên, không có dữ liệu rác nào bị ghi dở dang.

### 5. Kim tự tháp kiểm thử & Integration Testing với Supertest
* **3 Tầng kiểm thử chuẩn:**
  1. **Unit Test (70%):** Tháo rời từng con ốc vít (hàm logic) ra test độc lập, chạy offline trong vài mili-giây.
  2. **Integration Test (20%):** Ráp Router + Controller + Middleware + Database thật lại với nhau, kiểm tra sự ăn khớp giữa các bộ phận.
  3. **E2E Test (10%):** Bật trình duyệt thật (Playwright/Cypress) đóng vai người dùng click chuột từ đầu đến cuối.
* **Sức mạnh của `supertest`:**
  * Nhúng trực tiếp instance `app` của Express vào bộ nhớ RAM.
  * Bắn HTTP request mô phỏng người dùng thật (Đăng ký $\rightarrow$ Đăng nhập lấy JWT $\rightarrow$ Tạo Monitor $\rightarrow$ Check Now) mà không cần bật server mở port mạng thật.
  * Tự động dọn dẹp Database sau khi test (`afterAll`) để các lần chạy test luôn độc lập và lặp lại được 100%.

---

## ⚡ PHẦN 9: REDIS - IN-MEMORY DATABASE, CACHE-ASIDE PATTERN & TỐI ƯU HIỆU NĂNG HỆ THỐNG

### 1. Bản chất In-Memory: Vì sao Redis nhanh hơn PostgreSQL hàng trăm lần?
* **RAM (Nano-giây) vs Ổ cứng SSD (Micro-giây):**
  * PostgreSQL là cơ sở dữ liệu bền vững (Persistent RDBMS), dữ liệu phải ghi xuống ổ đĩa vật lý để không mất khi mất điện. Tốc độ đọc ghi của SSD tính bằng Micro-giây ($\mu s$).
  * Redis lưu toàn bộ dữ liệu trên thanh **RAM (In-Memory)**. Tốc độ truy xuất của RAM tính bằng Nano-giây ($ns$), nhanh hơn SSD gấp hàng nghìn lần (đáp ứng < 0.5ms).
* **Kiến trúc Single-Threaded Event Loop (Đơn luồng):**
  * Không tốn chi phí tranh chấp khóa (Lock Contention) hay chuyển ngữ cảnh luồng (Context Switching) như các hệ thống đa luồng phức tạp.
  * Được viết bằng ngôn ngữ C thuần túy, thao tác bộ nhớ trực tiếp đến từng byte.
* **5 Câu lệnh nền tảng của Redis:**
  * `SET key value`: Lưu cặp khóa - giá trị.
  * `GET key`: Lấy giá trị của khóa.
  * `EXPIRE key seconds`: Thiết lập thời gian sống (TTL).
  * `TTL key`: Kiểm tra số giây còn lại trước khi khóa tự hủy (`-1`: vĩnh viễn, `-2`: không tồn tại).
  * `INCR key`: Tăng biến đếm nguyên tử (Atomic increment), nền tảng của Rate Limiting.

### 2. Tư duy Lưu trữ Key-Value & Xử lý kiểu dữ liệu trong Redis
* **Quy ước đặt tên Key:**
  * Sử dụng dấu hai chấm `:` để phân cấp namespace rõ ràng: `status:<slug>`, `rl:<ip>`, `user:<id>:tokens`.
* **Value trong Redis là Binary-safe String:**
  * Kiểu nguyên thủy (số, chuỗi ngắn): Có thể lưu chuỗi trần.
  * Kiểu đối tượng phức tạp (JSON Object/Array): Cần `JSON.stringify()` khi lưu và `JSON.parse()` khi đọc ra.
* **Bẫy `BigInt` khi tuần tự hóa JSON (Serialization Trap):**
  * Prisma trả về các cột khóa chính dạng `BigInt` (ví dụ `checks.id`).
  * Hàm `JSON.stringify()` mặc định của JavaScript sẽ ném lỗi runtime: `TypeError: Do not know how to serialize a BigInt`.
  * **Giải pháp:** Viết bước sanitize chuyển đổi `BigInt` thành `String` hoặc `Number` trước khi đẩy vào Redis và trả về Client.

### 3. Mô hình Cache-Aside Pattern (Lazy Loading) cho Public Status Page
* **Nguyên lý hoạt động:**
  1. Client gửi request `GET /api/status/:slug`.
  2. Server kiểm tra Redis với key `status:${slug}`.
  3. **Cache Hit (Trúng thưởng):** Tìm thấy trong Redis $\rightarrow$ Trả về ngay lập tức với `source: 'cache'` (thời gian xử lý < 0.5ms, giải phóng 100% tải cho DB).
  4. **Cache Miss (Trượt):** Chưa có trong Redis $\rightarrow$ Truy vấn PostgreSQL $\rightarrow$ Ghi đè vào Redis kèm hạn sử dụng `EX 30` $\rightarrow$ Trả về cho Client với `source: 'db'`.
* **Tuyệt kỹ tận dụng 3 tầng Index lồng nhau:**
  * Câu truy vấn `findUnique({ where: { slug } })` ăn ngay **Unique Index** của cột `slug`.
  * Câu truy vấn lồng `checks` (`take: 10, orderBy: { checked_at: 'desc' }`) ăn trọn **Composite Index `[monitor_id, checked_at DESC]`**.
  * Câu truy vấn lồng `incidents` (`take: 5, orderBy: { started_at: 'desc' }`) ăn trọn **Composite Index `[monitor_id, started_at DESC]`**.

### 4. Tại sao lại là TTL = 30 giây? (Con số "Vàng" cho Status Page)
1. **Khớp với tần suất kiểm tra (Monitor Interval):** Các worker thường ping website mỗi 30s - 60s/lần. Trạng thái trong DB không thay đổi nhanh hơn 30s nên cache ngắn hơn sẽ lãng phí tài nguyên DB.
2. **Tấm khiên đỡ "Bão F5" khi sập mạng (Thundering Herd):** Khi website sập, hàng chục nghìn người dùng hoảng loạn bấm F5 liên tục. Nhờ TTL 30s, PostgreSQL chỉ phải gánh đúng 1 câu truy vấn, 9.999 request còn lại do Redis phục vụ từ RAM.
3. **Phao cứu sinh chống tràn RAM:** Sau 30s không ai truy cập, Redis tự động giải phóng bộ nhớ, không bao giờ để rác tồn đọng làm sập máy chủ vì cạn RAM (OOM - Out of Memory).

### 5. Hiện tượng Dữ liệu lỗi thời (Stale Data) & Bài toán Cache Invalidation
* **Điểm yếu của Cache thuần TTL:**
  * Nếu giây 0 nạp cache báo "UP", đến giây 5 web bị sập ("DOWN").
  * Từ giây 6 đến 29, nếu khách hàng vào xem thì Redis vẫn tuồn dữ liệu cũ báo "UP" $\rightarrow$ Đây là hiện tượng **Stale Data** (Dữ liệu bị thiu)!
* **Giải pháp: Cache Invalidation (Xóa cache chủ động):**
  * Không ngồi chờ hết 30s một cách thụ động.
  * Hễ có hành động làm biến động dữ liệu trong DB (Admin bấm `Check Now`, hoặc Sửa thông tin, Xóa monitor), server lập tức bắn phát súng tiêu diệt cache:
    `await redis.del('status:' + monitor.slug);`
  * Ngay giây kế tiếp người dùng truy cập, Redis bắt buộc phải lấy dữ liệu mới nhất từ PostgreSQL $\rightarrow$ **Độ trễ bằng 0 giây, dữ liệu luôn tươi mới 100%!**

### 6. Khởi động hệ thống an toàn: Eager Connection vs Lazy Connection
* Prisma mặc định sử dụng cơ chế **Lazy Connection** (chỉ mở socket kết nối khi có câu truy vấn đầu tiên phát sinh). Điều này khiến lập trình viên khó phát hiện nếu DB bị chết cổng từ lúc bật server.
* **Nâng cấp Startup Health Check:**
  * Bổ sung `await prisma.$connect()` và `await redis.ping()` ngay trước khi `app.listen()`.
  * Nếu PostgreSQL (port 5433) hoặc Redis (port 6379) chưa sẵn sàng $\rightarrow$ Server chủ động từ chối khởi động và báo lỗi tức thì, tránh lỗi âm thầm khi đang chạy production.

### 7. Kỹ thuật Rate Limiting nâng cao với Redis Lua Script
* **Vì sao không gọi 3 lệnh riêng lẻ (`INCR` $\rightarrow$ `EXPIRE` $\rightarrow$ `TTL`)?**
  * Tốn 3 lần độ trễ mạng (3 Round-trips) giữa Node.js và Redis.
  * Nguy cơ Race Condition: Nếu máy chủ Node.js bị crash ngay sau lệnh `INCR` trước khi kịp gọi `EXPIRE`, key đó sẽ tồn tại vĩnh viễn trên RAM, người dùng bị chặn vĩnh viễn!
* **Giải pháp: Gom toàn bộ vào Lua Script nguyên tử (Atomic Execution):**
  * Lua script được Redis biên dịch và chạy tuần tự trong Event Loop, đảm bảo `INCR` và `EXPIRE` xảy ra đồng thời trong 1 lần gọi mạng duy nhất (`redis.eval(...)`).
* **Chuẩn hóa Header theo chuẩn thế giới (IETF / GitHub / Stripe):**
  * `X-RateLimit-Limit`: Giới hạn tối đa (60).
  * `X-RateLimit-Remaining`: Số lượt còn lại trước khi bị chặn.
  * `X-RateLimit-Reset`: Số giây đếm lùi đến khi cửa sổ được làm mới.
  * `Retry-After`: Trả về khi bị mã HTTP `429 Too Many Requests`, thông báo cho client biết chính xác phải chờ bao nhiêu giây.
* **Chiến lược Phao cứu sinh (Fail-Open):**
  * Nếu Redis gặp sự cố, middleware bắt lỗi trong `catch`, ghi log cảnh báo và gọi `next()` cho request đi tiếp, không bao giờ làm chết toàn bộ ứng dụng (500 Error).

### 8. Thực nghiệm đo lường hiệu năng bằng Autocannon (Con số "Vàng" cho CV)
* Dưới tải 30 kết nối dồn dập trong 5 giây:
  * **Thông lượng (Throughput):** Tăng từ **1,185 req/s** lên **3,365 req/s** (bứt phá gấp **~2.84x lần**).
  * **Độ trễ trung bình:** Giảm từ **24.85 ms** xuống **8.42 ms** (nhanh hơn gấp ~3 lần).
  * **Độ trễ p99:** Giảm từ **38.00 ms** xuống **17.00 ms** (giảm hơn 55% độ trễ cho nhóm người dùng trải nghiệm tệ nhất).
  * **Tỷ lệ thành công (2xx):** Đạt **100%** (16,820 request), không rớt một kết nối nào.
* Toàn bộ kết quả và phân tích chi tiết được lưu trữ tại file [REPORT_WEEK5.md](REPORT_WEEK5.md).

---

## ⚡ PHẦN 8: BULLMQ, HÀNG ĐỢI BẤT ĐỒNG BỘ & TIẾN TRÌNH WORKER ĐỘC LẬP

### 1. Vì sao hệ thống Uptime Monitoring bắt buộc phải dùng Hàng Đợi (Queue)?
* **Nghẽn luồng xử lý (Blocking API):** Hàm `checkUrl` thực hiện request ra Internet tới website của người dùng, có thể mất từ 500ms đến 10 giây nếu trang web bị treo/sập. Nếu gọi trực tiếp trong API request của Express, Event Loop bị kẹt, người dùng tạo monitor phải chờ đợi mòn mỏi.
* **Nguyên lý Tách rời (Decoupling):**
  * **API Process (Producer):** Chỉ làm việc nhẹ: Kiểm tra dữ liệu hợp lệ $\rightarrow$ Ghi DB $\rightarrow$ Đẩy job vào Redis $\rightarrow$ Trả về ngay `201 Created` trong **< 10ms**.
  * **Worker Process (Consumer):** Một tiến trình Node.js hoàn toàn độc lập, thong thả bốc job từ Redis ra để ping mạng và ghi DB. Nếu website khách bị sập, chỉ có Worker chờ, toàn bộ hệ thống API phục vụ người dùng vẫn chạy nhanh như chớp.
* **Khả năng chịu lỗi (Fault Tolerance) & Thử lại (Retry):** Nếu máy chủ Worker bị ngắt đột ngột, job vẫn nằm an toàn trên Redis và được tự động bàn giao cho Worker khác xử lý khi khởi động lại, không bao giờ bị mất tác vụ.

### 2. Cấu hình Redis Connection cho BullMQ (`maxRetriesPerRequest: null`)
* **Hiện tượng:** Nếu không cấu hình, thư viện BullMQ sẽ ném lỗi crash ứng dụng ngay khi khởi động.
* **Bản chất kỹ thuật:** Worker của BullMQ sử dụng các **Lệnh chặn (Blocking Commands)** của Redis như `BLMOVE` hoặc `BRPOPLPUSH` để lắng nghe job mới. Khi hàng đợi rỗng, kết nối này sẽ chủ động "treo" (chờ đợi) trên Redis socket cho đến khi có job mới xuất hiện mà không cần polling liên tục.
* Do tính chất chờ đợi chủ động này, Redis client bắt buộc phải đặt `maxRetriesPerRequest: null` để ioredis không hiểu nhầm lệnh treo là một lỗi mạng và ngắt kết nối.

### 3. Vòng đời Lịch trình Công việc (Job Scheduler vs Repeatable Jobs)
* **Scheduler ID vs Job ID:**
  * `schedulerId` (ví dụ `scheduler-monitor-10`): Là chiếc "đồng hồ sinh học" định kỳ trong Redis, quy định tần suất chạy (`every: interval_sec * 1000`).
  * `job.id` (ví dụ `repeat:scheduler-monitor-10:1795...`): Là từng công việc độc lập được sinh ra sau mỗi tích tắc của chiếc đồng hồ đó.
* **Đồng bộ vòng đời để triệt tiêu "Job Bóng Ma" (Ghost Jobs):**
  * Khi Tạo mới: Gọi `monitorQueue.upsertJobScheduler(...)` để khởi tạo lịch ping.
  * Khi Đổi `interval_sec`: Gọi `upsertJobScheduler(...)` đè lên ID cũ để cập nhật chu kỳ mới ngay tức thì.
  * Khi Xóa Monitor: Bắt buộc gọi `monitorQueue.removeJobScheduler(...)` để xóa chiếc đồng hồ trong Redis. Nếu quên bước này, Worker sẽ mãi mãi ping vào một monitor không còn tồn tại trong Database!

### 4. Tiến trình Worker độc lập & Tham số `concurrency: 5`
* **Tiến trình độc lập (`src/worker.ts`):** 
  * Chạy trên một Core CPU riêng biệt với tiến trình API (`src/index.ts`).
  * Không mở cổng HTTP (tiết kiệm tài nguyên và miễn nhiễm với các cuộc tấn công dò cổng mạng).
* **`concurrency: 5` là gì?**
  * Cho phép 1 tiến trình Worker xử lý đồng thời tối đa **5 jobs** cùng lúc.
  * Vì việc kiểm tra website (`checkUrl`) chủ yếu tiêu tốn thời gian chờ I/O mạng (Network I/O Wait) chứ không ngốn CPU, Event Loop của Node.js xử lý mượt mà hàng chục I/O song song mà không nghẽn.
* **Cơ chế bốc tải khi có 1.000 monitor cùng lúc:**
  * 1.000 job xếp hàng trật tự trong Redis.
  * Worker bốc trước 5 job ra ping. Cứ 1 job hoàn thành (~200ms), Worker lập tức bốc tiếp job thứ 6 vào bù chỗ.
  * Hệ thống không bao giờ bị cạn kiệt cổng mạng (Socket exhaustion), không tràn RAM và không làm nghẽn PostgreSQL.
* **Tắt máy an toàn (Graceful Shutdown):**
  * Lắng nghe tín hiệu `SIGINT` (Ctrl + C) và `SIGTERM` (Docker Stop).
  * Gọi `await worker.close()` để Worker ngừng nhận job mới, đợi các job đang ping dở hoàn tất rồi mới giải phóng tài nguyên và thoát tiến trình.

### 5. Khép kín vòng đời giám sát: Worker + Pure Function + Transaction + Cache Invalidation
* Sau mỗi lần Worker ping website tự động:
  1. Đọc 2 check gần nhất và sự cố gần nhất (`Promise.all` tối ưu I/O).
  2. Gọi hàm thuần khiết `decideIncident` (từ Tuần 4) để phán quyết mở/đóng sự cố.
  3. Gói gọn tạo check + cập nhật status + mở/đóng incident trong **PostgreSQL Transaction (`prisma.$transaction`)** đảm bảo tính toàn vẹn dữ liệu (ACID).
  4. Nếu monitor có trang Public Status Page (`slug`), tự động gọi `redis.del('status:' + slug)` để xóa dữ liệu cũ, giúp người xem Status Page luôn thấy trạng thái mới nhất ngay lập tức.

