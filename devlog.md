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
