# PingPulse Lite: Lộ trình Backend Node.js 8 tuần cho intern/fresher
*Bản làm lại: ít viết hạ tầng, nhiều kiến thức mới, ai cũng làm được*

---

## 1. Tổng quan

| Hạng mục | Nội dung |
| :--- | :--- |
| **Điểm xuất phát** | Biết JavaScript/TypeScript cơ bản, Express, CRUD, JWT, Docker, deploy. Chưa có: SQL/PostgreSQL, Redis, queue, test thật, bảo mật SSRF. |
| **Mục tiêu** | Có một dự án có chiều sâu để nộp CV intern/fresher trước Tết 2027. 8 tuần từ 10/11/2026 là hết khoảng đầu tháng 1/2027, còn dư gần 4 tuần. |
| **Dự án** | **PingPulse Lite**: người dùng đăng nhập, thêm URL cần theo dõi, hệ thống tự kiểm tra theo lịch, ghi lịch sử, tự mở sự cố và gửi email khi website sập, có trang status công khai. |
| **Stack** | TypeScript + Express, PostgreSQL + Prisma, Redis, BullMQ, Vitest, Docker, GitHub Actions. |
| **Thời gian** | Khoảng 12-15 giờ/tuần. Nếu chỉ có $8-10$ giờ/tuần, kéo dài thành 12-16 tuần (mỗi tuần làm trong 1.5-2 tuần), đừng cắt chất lượng. |

### Vì sao bản này khác bản cũ?
Bản cũ bắt người mới viết sẵn những thứ mà người có kinh nghiệm mới thấy cần: lớp lỗi riêng, kiểu `Result` kiểu Rust, discriminated union, phân loại từng mã lỗi mạng. Những thứ đó là tối ưu về sau, không phải điều kiện để học backend. Bản này đảo ngược: viết cách đơn giản nhất cho chạy được, dồn sức vào công nghệ mới.

| Bản cũ bắt làm | Bản này |
| :--- | :--- |
| Class `AppError`, hàm `handleError`, `Result<T, E>`, discriminated union | Dùng `try/catch` thường. Lỗi chỉ cần lưu `error.message` dạng chữ. |
| Phân loại 5 loại lỗi mạng (DNS, TLS, refused, timeout...) | Chỉ cần biết lên hay xuống, kèm một dòng lỗi gốc để đọc. |
| Zod, generics, utility types, 10 hàm tiện ích trước khi có gì chạy | Chỉ cần kiểu cho tham số và dữ liệu. Muốn học nâng cao thì làm ở phần "Để sau". |
| Ticket, PR, retro, post-mortem, ADR, sự kiện giả lập mỗi tuần | 3 thói quen nhẹ (xem mục 3). |
| 1 triệu dòng, partition, multi-region, NestJS, refresh token rotation | $500.000$ dòng, chỉ làm index. Phần còn lại để sau. |
| 6 level trong 13 tuần | 8 tuần, mỗi tuần đúng 1 khái niệm mới lớn. |

### Nguyên tắc
* **Mỗi thứ sáu có một thứ chạy được.** Bản xấu mà chạy tốt hơn bản đẹp mà dở dang.
* **Tự gõ phần mới, để AI hỗ trợ phần đã biết.** Phần mới (SQL, Redis, BullMQ) tự gõ rồi nhờ AI review, nhờ người khác viết hộ là mất đúng thứ mình cần học.
* **Đo được thì ghi lại.** Mỗi tuần có 1-2 con số trước/sau. Đó là nguyên liệu cho CV.
* **Kẹt hơn 30 phút thì hỏi.** Gửi: mục tiêu, đã thử gì, lỗi nguyên văn, code tối thiểu.

---

## 2. Sản phẩm và kiến trúc

```text
Người dùng -> API (Express) -> PostgreSQL (users, monitors, checks, incidents)
                        \-> đọc/ghi cache -> Redis (cache trang status, rate limit)
                        \-> tạo lịch -> Hàng đợi BullMQ -> Worker (process riêng)
                                                            |
                                                            +--> gọi checkUrl, lưu kết quả (checks)
                                                            +--> mở/đóng sự cố (incidents)
                                                            +--> hàng đợi alerts -> gọi email
```

### Chức năng cuối cùng:
* Đăng ký, đăng nhập (JWT). Mỗi user tối đa 5 monitor.
* CRUD monitor: tên, URL, chu kỳ kiểm tra (giây).
* Nút "Check now" và kiểm tra tự động theo lịch.
* Lịch sử check có phân trang, thống kê uptime $\%$ và thời gian phản hồi.
* Sự cố: 3 lần lỗi liên tiếp thì mở, 2 lần thành công liên tiếp thì đóng. Gửi email lúc mở và đóng.
* Trang `GET /status/:slug` công khai, có cache Redis và giới hạn request.
* Chặn người dùng nhập URL trỏ về mạng nội bộ (SSRF cơ bản).

---

## 3. Ba thói quen làm việc (đủ dùng)

| Thói quen | Làm thế nào | Tốn thời gian |
| :--- | :--- | :--- |
| **1. Một việc, một nhánh, một PR** | Mỗi ticket tạo nhánh `feat/ten-viec`, commit rõ ràng (`feat: add check now endpoint`), mở Pull Request vào `main`, tự đọc lại diff rồi merge. Không code thẳng vào `main`. | 5 phút/ticket |
| **2. Devlog 3 dòng** | File `devlog.md`: hôm nay làm gì, vướng gì, mai làm gì. Sau 8 tuần bạn có nhật ký để kể lúc phỏng vấn. | 3 phút/ngày |
| **3. Chạy thử và ghi số liệu vào thứ sáu** | Chạy lại thứ vừa làm, chụp màn hình hoặc quay 1 phút, ghi con số (trước/sau) vào `README.md`. | 30 phút/tuần |

* **Xong một ticket nghĩa là:** chạy được; có thử vài trường hợp xấu (rỗng, sai định dạng, không đăng nhập); đã merge PR; `README.md` ghi thêm nếu cách chạy thay đổi. Từ tuần 4 trở đi thêm: có test cho logic mới.
* **Cách dùng AI cho đúng:** Nhờ giải thích khái niệm, nhờ review PR của mình, nhờ gợi ý hướng khi kẹt. Không nhờ viết cả phần mới rồi dán vào, vì đó là lý do code trở nên "khó hiểu như của người khác". 
* **Quy tắc thử:** Nếu bạn không giải thích được một đoạn code, hãy xóa đi và gõ lại theo cách của mình.

---

## 4. Bản đồ 8 tuần

| Tuần | Khái niệm mới | Cuối tuần có gì chạy được | Số giờ |
| :---: | :--- | :--- | :---: |
| **1** | PostgreSQL, SQL | Database 3 bảng, hàm `checkUrl`, truy vấn `JOIN`/`GROUP BY` bằng tay | 15 |
| **2** | Prisma, migration | API: đăng nhập, CRUD monitor, "Check now" lưu lịch sử | 15 |
| **3** | Index, EXPLAIN, phân trang | $500.000$ dòng, `REPORT.md` có số liệu trước/sau index | 13 |
| **4** | Test thật (Vitest), transaction | Logic mở/đóng sự cố + 8-10 test xanh | 13 |
| **5** | Redis, cache, rate limit | Trang status có cache, số liệu autocannon trước/sau | 12 |
| **6** | BullMQ (hàng đợi) | Hệ thống tự kiểm tra theo lịch bằng worker riêng | 14 |
| **7** | Retry, idempotency | Tự gửi email cảnh báo, không gửi trùng khi retry | 12 |
| **8** | SSRF, CI/CD, deploy | Link chạy thật, CI xanh, `README.md`, video demo, CV | 15 |

---

## 5. Chi tiết từng tuần

### TUẦN 1. PostgreSQL và SQL (~15 giờ)
* **Khái niệm mới:** SQL và cách tổ chức dữ liệu dạng bảng (bạn đang quen MongoDB).
* **Mục tiêu:** Có database 3 bảng chạy bằng Docker, tự viết được `JOIN` và `GROUP BY`, có hàm kiểm tra một URL.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **1.1** | Chạy Postgres bằng Docker, kết nối bằng `psql` hoặc DBeaver | 1 |
| **1.2** | SQLBolt (hết phần JOIN, aggregate) + pgexercises 15 bài đầu. Làm tay, không copy đáp án | 6 |
| **1.3** | Viết `schema.sql`: `users`, `monitors`, `checks`, có khóa ngoại và `NOT NULL` | 3 |
| **1.4** | Viết hàm `checkUrl` (mẫu bên dưới, gõ lại bằng tay) và chạy thử 3 URL: `google.com`, một tên miền không tồn tại, `httpstat.us/500` | 2 |
| **1.5** | `INSERT` tay vài dòng, viết 3 truy vấn: số check mỗi monitor, uptime $\%$, `JOIN` monitors + checks | 3 |
| | **Tổng** | **15** |

#### SQL & TypeScript Code mẫu Tuần 1:
```sql
-- Chạy Postgres
docker run --name pg -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monitors (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    interval_sec INT NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checks (
    id BIGSERIAL PRIMARY KEY,
    monitor_id INT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    is_up BOOLEAN NOT NULL,
    status_code INT,
    latency_ms INT,
    error TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

```typescript
// Hàm checkUrl bản đơn giản
export async function checkUrl(url: string, timeoutMs = 5000) {
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return {
      isUp: res.status < 400,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
      error: null,
    };
  } catch (err) {
    return {
      isUp: false,
      status: null,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

* **Làm xong khi:**
  * Giải thích được `INNER JOIN` và `LEFT JOIN` khác nhau thế nào bằng ví dụ monitors/checks.
  * Viết được truy vấn uptime $\%$ của một monitor trong 7 ngày mà không cần xem mẫu.
  * Chạy `checkUrl` ra 3 kết quả khác nhau cho 3 URL thử, đọc hiểu từng nhánh.
* **Tự hỏi mình:**
  * Khóa chính và khóa ngoại để làm gì? `ON DELETE CASCADE` nghĩa là gì?
  * Khi nào nên dùng PostgreSQL, khi nào MongoDB phù hợp hơn?

---

### TUẦN 2. Prisma và API (~15 giờ)
* **Khái niệm mới:** ORM và migration: mô tả bảng bằng file schema, Prisma sinh ra SQL và code truy vấn có kiểu.
* **Mục tiêu:** API chạy được: đăng nhập, CRUD monitor, "Check now" lưu lịch sử vào Postgres.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **2.1** | Cài Prisma, chuyển `schema.sql` thành `schema.prisma`, chạy migrate | 3 |
| **2.2** | Đăng ký/đăng nhập: hash mật khẩu, JWT. Dùng lại code cũ của bạn | 3 |
| **2.3** | CRUD monitor (chỉ thấy monitor của chính mình), giới hạn 5 monitor/user | 4 |
| **2.4** | `POST /monitors/:id/check`: gọi `checkUrl`, lưu vào `checks`, cập nhật `monitors.status` | 3 |
| **2.5** | Bật query log của Prisma, tìm và sửa 1 chỗ N+1 (danh sách monitor kèm check mới nhất) | 2 |
| | **Tổng** | **15** |

#### TypeScript Code mẫu Tuần 2 (Sửa N+1):
```typescript
// Chậm: lặp qua từng monitor rồi hỏi DB tiếp cho mỗi cái (1 + N truy vấn)
// Nhanh: nhờ Prisma lấy kèm trong một lần truy vấn
const monitors = await prisma.monitor.findMany({
  where: { userId },
  include: { checks: { orderBy: { checkedAt: "desc" }, take: 1 } },
});
```

* **Làm xong khi:**
  * Gọi được toàn bộ API bằng Postman hoặc file `.http`: đăng ký, đăng nhập, tạo monitor, check now.
  * Xem log query, chứng minh danh sách monitor chỉ còn số truy vấn cố định.
  * User A không xem/xóa được monitor của user B.
* **Tự hỏi mình:**
  * Migration là gì, vì sao không sửa bảng thẳng trong DB?
  * $N+1$ là gì? Cách tránh?

---

### TUẦN 3. Index, EXPLAIN và phân trang (~13 giờ)
* **Khái niệm mới:** Index và cách đọc kế hoạch truy vấn (`EXPLAIN ANALYZE`). Đây là câu hỏi phỏng vấn gần như chắc chắn gặp.
* **Mục tiêu:** Bảng $500.000$ dòng, đo được truy vấn nhanh lên bao nhiêu lần nhờ index.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **3.1** | Sinh $500.000$ dòng `checks` bằng `generate_series` | 2 |
| **3.2** | Viết 4 truy vấn: uptime $\%$ 7 ngày, latency trung bình theo giờ, 10 lần lỗi gần nhất, top 5 monitor chậm | 4 |
| **3.3** | Chạy `EXPLAIN ANALYZE` trước và sau khi thêm index, ghi vào `REPORT.md` | 3 |
| **3.4** | `GET /monitors/:id/checks` có phân trang. Thử offset ở trang rất sâu rồi so với cursor | 3 |
| **3.5** | `GET /monitors/:id/stats` trả uptime $\%$ và latency trung bình | 1 |
| | **Tổng** | **13** |

#### SQL Code mẫu Tuần 3:
```sql
-- 100 monitor x 5000 mục thời gian = 500.000 dòng dữ liệu giả lập
INSERT INTO checks (monitor_id, is_up, latency_ms, checked_at)
SELECT 
    m.id,
    random() > 0.02,
    (50 + random() * 400)::int,
    now() - (g || ' minute')::interval
FROM generate_series(1, 5000) AS g
CROSS JOIN monitors m;

-- Đo trước, tạo index, rồi đo lại
EXPLAIN ANALYZE
SELECT count(*) FILTER (WHERE is_up) * 100.0 / count(*) AS uptime_pct
FROM checks
WHERE monitor_id = 7 AND checked_at > now() - interval '7 days';

CREATE INDEX idx_checks_monitor_time ON checks (monitor_id, checked_at DESC);
```

* **Làm xong khi:**
  * `REPORT.md` có bảng: truy vấn nào, thời gian trước, thời gian sau, kế hoạch `Seq Scan` chuyển sang `Index Scan`.
  * Cursor pagination chạy đúng: trang đầu, trang sau, trang cuối.
* **Tự hỏi mình:**
  * Vì sao thứ tự cột trong `(monitor_id, checked_at)` quan trọng?
  * Khi nào không nên đánh index? (gợi ý: bảng ghi nhiều, đọc ít).
  * Cursor khác offset ở đâu, vì sao offset chậm ở trang sâu?

---

### TUẦN 4. Test thật và logic sự cố (~13 giờ)
* **Khái niệm mới:** Unit test bằng Vitest và hàm thuần (pure function) dễ test; transaction trong database.
* **Mục tiêu:** Logic "khi nào mở/đóng sự cố" chạy đúng, có 8-10 test xanh.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **4.1** | Cài Vitest, viết 3 test cho `checkUrl` với fetch bị giả lập (mock) | 3 |
| **4.2** | Viết hàm thuần `decideIncident`: 3 lần lỗi liên tiếp thì mở, 2 lần OK liên tiếp thì đóng | 3 |
| **4.3** | 8-10 test cho hàm đó, có cả trường hợp biên: ít hơn 3 check, đang có sự cố, xen kẽ lỗi/OK | 3 |
| **4.4** | Thêm bảng `incidents`. Mở/đóng sự cố trong transaction (ghi incident + cập nhật `monitors.status`) | 2 |
| **4.5** | 1 integration test bằng supertest: đăng nhập, tạo monitor, check now | 2 |
| | **Tổng** | **13** |

#### TypeScript Code mẫu Tuần 4:
```typescript
type Check = { isUp: boolean };

// recent: các check gần nhất, mới nhất nằm đầu mảng
export function decideIncident(recent: Check[], hasOpenIncident: boolean) {
  const last3 = recent.slice(0, 3);
  const last2 = recent.slice(0, 2);
  
  if (!hasOpenIncident && last3.length === 3 && last3.every((c) => !c.isUp)) return "open";
  if (hasOpenIncident && last2.length === 2 && last2.every((c) => c.isUp)) return "close";
  return "none";
}
```

```typescript
import { describe, it, expect } from "vitest";
import { decideIncident } from "./incident.js";

describe("decideIncident", () => {
  it("mở sự cố khi 3 check gần nhất đều lỗi", () => {
    const recent = [{ isUp: false }, { isUp: false }, { isUp: false }];
    expect(decideIncident(recent, false)).toBe("open");
  });

  it("không làm gì khi mới có 2 lỗi", () => {
    const recent = [{ isUp: false }, { isUp: false }];
    expect(decideIncident(recent, false)).toBe("none");
  });
});
```

* **Làm xong khi:**
  * Chạy `npx vitest` xanh với ít nhất 8 test cho `decideIncident`.
  * Cố tình làm sai hàm, thấy test đỏ, sửa lại thấy xanh.
  * Thử rollback: cho lỗi giữa chừng trong transaction, xác nhận dữ liệu không bị ghi nửa vời.
* **Tự hỏi mình:**
  * Vì sao test cần mock fetch? Vì sao hàm thuần dễ test hơn hàm gọi database?
  * Transaction và ACID là gì? Ví dụ trong dự án này?

---

### TUẦN 5. Redis: cache và rate limit (~12 giờ)
* **Khái niệm mới:** Redis như bộ nhớ nhanh: cache-aside, TTL, đếm bằng `INCR`.
* **Mục tiêu:** Trang status công khai nhanh hơn rõ rệt nhờ cache, có chống spam request.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **5.1** | Redis bằng Docker, thực hành redis-cli: `SET`, `GET`, `EXPIRE`, `TTL`, `INCR` | 2 |
| **5.2** | `GET /status/:slug` công khai (thêm cột slug cho monitor), cache-aside TTL 30 giây | 4 |
| **5.3** | Xóa cache khi trạng thái monitor đổi (invalidate) | 1 |
| **5.4** | Rate limit mỗi IP 60 request/phút bằng `INCR` + `EXPIRE` | 3 |
| **5.5** | Đo bằng autocannon trước/sau cache, ghi số liệu (req/s, p95) vào `README.md` | 2 |
| | **Tổng** | **12** |

#### TypeScript Code mẫu Tuần 5:
```typescript
// Cache-aside: có trong cache thì trả luôn, không thì hỏi DB rồi lưu lại 30 giây
const key = `status:${slug}`;
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);

const data = await getStatusFromDb(slug);
await redis.set(key, JSON.stringify(data), "EX", 30);
return data;

// Rate limit cố định theo cửa sổ 60 giây
const rKey = `rl:${ip}`;
const n = await redis.incr(rKey);
if (n === 1) await redis.expire(rKey, 60);
if (n > 60) return res.status(429).json({ message: "Too many requests" });
```

* **Làm xong khi:**
  * Có 2 con số: req/s hoặc p95 của `/status/:slug` khi chưa có cache và khi có cache.
  * Gọi liên tục hơn 60 lần/phút thì nhận mã 429.
* **Tự hỏi mình:**
  * Cache-aside là gì? Vì sao cần TTL? Khi dữ liệu đổi thì làm gì với cache?
  * Rate limit cố định theo cửa sổ có nhược điểm gì? (gợi ý: dồn request ở ranh giới hai cửa sổ).

---

### TUẦN 6. BullMQ: hàng đợi và worker (~14 giờ)
* **Khái niệm mới:** Hàng đợi công việc: API chỉ đặt việc, worker (process khác) mới làm việc.
* **Mục tiêu:** PingPulse tự kiểm tra theo lịch mà không cần bấm nút.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **6.1** | Học khái niệm producer / queue / worker, chạy ví dụ hello world của BullMQ | 2 |
| **6.2** | Worker nhận job, gọi `checkUrl` cho 1 monitor, lưu vào `checks` | 4 |
| **6.3** | Mỗi monitor một job lặp theo interval. Tạo/sửa/xóa monitor thì cập nhật lịch | 4 |
| **6.4** | Tách worker thành process riêng (`src/worker.ts`), thêm vào docker-compose, concurrency 5 | 2 |
| **6.5** | Sau mỗi check gọi `decideIncident` (từ tuần 4) để mở/đóng sự cố | 2 |
| | **Tổng** | **14** |

#### TypeScript Code mẫu Tuần 6:
```typescript
import { Queue, Worker } from "bullmq";

const connection = { host: "localhost", port: 6379 };
const queue = new Queue("checks", { connection });

// API: tạo lịch cho một monitor (chạy lặp mỗi interval_sec giây)
await queue.upsertJobScheduler(
  `monitor-${m.id}`,
  { every: m.intervalSec * 1000 },
  { name: "check", data: { monitorId: m.id } }
);

// Worker: chạy process riêng
new Worker("checks", async (job) => {
  const m = await prisma.monitor.findUnique({ where: { id: job.data.monitorId } });
  if (!m) return;
  const r = await checkUrl(m.url);
  await prisma.check.create({
    data: {
      monitorId: m.id,
      isUp: r.isUp,
      statusCode: r.status,
      latencyMs: r.latencyMs,
      error: r.error,
    },
  });
}, { connection, concurrency: 5 });
```
*(Lưu ý: Tên hàm tạo job lặp đã đổi giữa các phiên bản BullMQ. Hãy đọc docs.bullmq.io đúng với phiên bản bạn cài).*

* **Làm xong khi:**
  * Tạo 1 monitor, để yên: bảng `checks` tự có thêm dòng mỗi chu kỳ.
  * Tắt website mẫu, sau đúng 3 chu kỳ thì thấy sự cố được mở trong DB.
  * Tắt worker thì không có check mới, bật lại thì chạy tiếp.
* **Tự hỏi mình:**
  * Vì sao không gọi `checkUrl` thẳng trong API mà phải qua hàng đợi?
  * Concurrency 5 nghĩa là gì? Nếu có $1000$ monitor thì chuyện gì xảy ra?

---

### TUẦN 7. Retry, idempotency và cảnh báo (~12 giờ)
* **Khái niệm mới:** Việc có thể chạy lại (retry) thì phải an toàn khi chạy lại (idempotent), nếu không sẽ gửi email trùng.
* **Mục tiêu:** Sập thì nhận email, hết sập nhận email, có lỗi gửi mail thì tự thử lại mà không gửi trùng.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **7.1** | Queue "alerts" + worker gửi email bằng Nodemailer (dùng Mailtrap hoặc SMTP thử nghiệm) | 3 |
| **7.2** | Bật `attempts = 3`, backoff mũ. Cố tình làm gửi mail lỗi để quan sát retry | 2 |
| **7.3** | Idempotency: `jobId` cố định theo sự cố + cờ `alert_sent` trong DB | 3 |
| **7.4** | Dựng website mẫu 10 dòng, tắt/bật để kiểm tra cả vòng: sập $\rightarrow$ mail, lên $\rightarrow$ mail | 2 |
| **7.5** | Gắn bull-board hoặc đọc job thất bại bằng log, cách chạy lại job lỗi | 2 |
| | **Tổng** | **12** |

#### TypeScript Code mẫu Tuần 7:
```typescript
await alertQueue.add(
  "send",
  { incidentId, type: "open" },
  {
    jobId: `alert-${incidentId}-open`, // Cùng jobId thì không tạo thêm job thứ hai
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 }, // chờ 2s, 4s, 8s...
  }
);
// Trong worker: kiểm tra cờ alert_sent trước khi gửi, gửi xong thì đặt cờ.
```

* **Làm xong khi:**
  * Quay được video 1 phút: tắt website mẫu, nhận email sập; bật lại, nhận email hồi phục.
  * Cho SMTP lỗi 2 lần rồi đúng ở lần 3: chỉ nhận đúng 1 email.
* **Tự hỏi mình:**
  * Vì sao retry có thể gửi trùng? (gợi ý: mail gửi xong nhưng worker chết trước khi báo hoàn thành).
  * Backoff mũ để làm gì? Vì sao không retry liên tục ngay lập tức?

---

### TUẦN 8. SSRF, CI/CD, deploy và hoàn thiện (~15 giờ)
* **Khái niệm mới:** SSRF: người dùng nhập URL để server gọi giúp, nên phải chặn gọi vào mạng nội bộ.
* **Mục tiêu:** Có link chạy thật, CI xanh, `README.md` và video demo, CV hoàn chỉnh.

| Mã | Việc cần làm | Giờ |
| :---: | :--- | :---: |
| **8.1** | Chặn URL trỏ tới `127.0.0.1`, `10.x`, `192.168.x`, `172.16-31.x`, `169.254.169.254`, `localhost` | 4 |
| **8.2** | 6-8 test cho phần chặn SSRF | 1 |
| **8.3** | GitHub Actions: lint + test (có service Postgres, Redis). Badge trong README | 2 |
| **8.4** | Deploy lên Render/Railway/VPS, biến môi trường, `.env.example` | 3 |
| **8.5** | README: chạy bằng 3 lệnh, sơ đồ kiến trúc, số liệu trước/sau, ảnh/GIF | 2 |
| **8.6** | Video demo 2 phút + CV 1 trang | 3 |
| | **Tổng** | **15** |

#### TypeScript Code mẫu Tuần 8:
```typescript
import { lookup } from "node:dns/promises";

function isPrivateIp(ip: string): boolean {
  return /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip) ||
    /^172\.(1[6-9]|2[0-3]|3[01])\./.test(ip) ||
    ip === "::1" || /^(fc|fd|fe80)/i.test(ip);
}

export async function assertPublicUrl(url: string) {
  const { hostname, protocol } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") throw new Error("Chỉ cho phép http/https");
  
  const { address } = await lookup(hostname); // Phân giải tên miền ra IP thật
  if (isPrivateIp(address)) throw new Error("Không cho phép địa chỉ nội bộ");
}
```

* **Làm xong khi:**
  * Gọi PingPulse với `http://127.0.0.1` và `http://169.254.169.254` đều bị từ chối.
  * `README.md` đủ để người lạ chạy dự án chỉ với 3 lệnh.
  * Link demo mở được từ điện thoại; CI xanh; video 2 phút xong.
* **Tự hỏi mình:**
  * SSRF là gì và ứng dụng của bạn bị tấn công thế nào nếu không chặn?
  * Vì sao phải đổi tên miền ra IP rồi mới kiểm tra, không chỉ so chuỗi?

---

## 6. CV và phỏng vấn

### Mẫu mô tả dự án trong CV 1 trang (điền số liệu thật của bạn vào A, B, X):
* Xây hệ thống giám sát uptime (Node.js, TypeScript, PostgreSQL, Redis, BullMQ): tự kiểm tra website theo lịch, mở sự cố sau 3 lần lỗi liên tiếp và gửi email cảnh báo.
* Tối ưu truy vấn thống kê trên bảng $500.000$ dòng bằng composite index: giảm từ A ms xuống B ms.
* Cache trang status bằng Redis: tăng từ A lên B req/s (autocannon).
* Chống SSRF, rate limit; dùng retry + idempotency để không gửi trùng cảnh báo. CI/CD bằng GitHub Actions, deploy bằng Docker.

### Câu hỏi phỏng vấn bạn sẽ trả lời được từ chính dự án:
| Câu hỏi phỏng vấn | Lấy câu trả lời từ |
| :--- | :--- |
| `INNER JOIN` vs `LEFT JOIN`? Index hoạt động ra sao? Vì sao thứ tự cột composite quan trọng? | Tuần 1, 3 |
| $N+1$ là gì? Cursor vs offset? PostgreSQL hay MongoDB? | Tuần 2, 3 |
| Transaction, ACID là gì? | Tuần 4 |
| Vì sao phải mock khi test? Hàm thuần là gì? | Tuần 4 |
| Cache-aside là gì? Khi dữ liệu đổi thì xử lý cache thế nào? Rate limit làm thế nào? | Tuần 5 |
| Khi nào cần message queue? Nếu có $100.000$ monitor thì nghẽn ở đâu? | Tuần 6 |
| Retry có thể gây gửi trùng không? Idempotent là gì? Làm sao tránh gửi cảnh báo trùng? | Tuần 7 |
| SSRF là gì, bạn chặn thế nào, còn hạn chế gì? 401 vs 403? JWT hoạt động ra sao? | Tuần 2, 8 |
| Event loop của Node.js hoạt động thế nào? `async/await` khác `Promise` ra sao? | Đọc thêm riêng |

* **Mẹo:** Tập trả lời thành tiếng, mỗi câu 1 phút, dùng ví dụ trong PingPulse. Nhờ AI đóng vai nhà tuyển dụng hỏi dồn "vì sao" để luyện.

---

## 7. Nếu bị trễ tiến độ
Thứ tự cắt giảm (từ cắt trước đến cắt sau):
1. Cắt bull-board, bài so sánh offset/cursor, rate limit.
2. Cắt tuần 7 xuống còn: gửi email qua queue + retry (bỏ idempotency kỹ).
3. Cắt tuần 5 xuống còn: chỉ cache trang status.
4. **Không cắt:** test cho `decideIncident`, deploy, `README.md` có số liệu, đo trước/sau, quay video.

*Nếu hụt giờ:* Nhân đôi thời gian mỗi tuần, đừng bỏ qua khái niệm mới. Học chậm mà hiểu tốt hơn nhanh mà mơ hồ.

---

## 8. Để sau (làm khi đã có thời gian hoặc đã đi làm)
Những bản cũ bắt làm ngay từ đầu thực ra là bước dọn dẹp code về sau. Bạn sẽ hiểu chúng nhanh hơn nhiều khi đã có code thật chạy và thấy chỗ nào đang lặp, chỗ nào đang rối.

| Chủ đề | Khi nào học | Lý do để đến lúc đó |
| :--- | :--- | :--- |
| Lớp `AppError`, hàm xử lý lỗi tập trung | Khi thấy mình viết cùng đoạn `try/catch` + trả mã HTTP ở 5 chỗ | Lúc đó bạn thấy vấn đề thật, lớp lỗi là lời giải. |
| `Result<T, E>`, discriminated union, generics | Khi muốn học TypeScript nâng cao hoặc code đã nhiều | Tối ưu độ an toàn kiểu, không cần để chạy được. |
| Zod (validate dữ liệu vào) | Sau tuần 2, khi API đã có vài endpoint | Thay các đoạn `if` kiểm tra thủ công. |
| Phân loại chi tiết lỗi mạng (DNS, TLS, refused) | Khi muốn hiển thị lý do sập cho người dùng | Hiện chỉ cần lưu `error.message`. |
| NestJS | Khi tìm việc và JD yêu cầu | Làm lại 1-2 module của PingPulse sang NestJS, so sánh với Express. |
| Refresh token rotation, role admin | Khi muốn học sâu về bảo mật | Chỉ cần JWT đơn giản cho CV intern. |
| Partition, rollup, load test k6 | Khi muốn dữ liệu 20 triệu dòng | Nội dung Junior, làm sau khi có việc. |
| Nginx, multi-region, Sentry, system design | Sau khi đi thực tập/làm | Cần bối cảnh thật mới học hiệu quả. |

---

## 9. Tài nguyên

| Chủ đề | Nguồn gợi ý |
| :--- | :--- |
| **SQL** | SQLBolt, `pgexercises.com`, `use-the-index-luke.com`, tài liệu PostgreSQL |
| **Prisma / Redis / BullMQ** | `prisma.io/docs`, `redis.io` (Redis University miễn phí), `docs.bullmq.io` |
| **Test** | `vitest.dev`, hướng dẫn supertest |
| **Bảo mật** | OWASP Top 10, mục SSRF tại `owasp.org` |
| **Load test** | autocannon (npm) |

> **Nhắc cuối:** Đây là dự án để học và để khoe, không phải cuộc thi. Một dự án 8 tuần mà bạn giải thích được từng dòng thắng một dự án hoành tráng mà bạn không dám mở code. Nộp CV sớm (từ tuần 6-8), đừng đợi làm xong mọi thứ.