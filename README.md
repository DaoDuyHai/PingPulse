# ⚡ PingPulse — Nền tảng Giám sát Uptime & Sự cố Hiệu năng cao (Backend Engine)

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-FF4438?style=for-the-badge&logo=redis&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-84%20Passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**Hệ thống Backend chuyên sâu theo kiến trúc hướng sự kiện (Event-Driven), xử lý tác vụ nền bất đồng bộ qua hàng đợi BullMQ, tối ưu hóa truy vấn PostgreSQL hàng triệu dòng và tăng tốc phản hồi bằng Redis Cache-Aside.**

[Tính năng Nổi bật](#-các-điểm-sáng-về-kiến-trúc) • [Sơ đồ Kiến trúc](#-sơ-đồ-kiến-trúc-hệ-thống) • [Đo lường Hiệu năng](#-kết-quả-đo-lường-hiệu-năng-thực-tế-autocannon) • [Cài đặt & Khởi chạy](#-hướng-dẫn-cài-đặt--khởi-chạy) • [Kiểm thử Tự động](#-kiểm-thử-tự-động-testing)

</div>

---

## 🌟 Giới thiệu Dự án

**PingPulse** là hệ thống giám sát tính khả dụng (Uptime), đo lường độ trễ (Latency) và tự động quản lý vòng đời sự cố (Incidents) của các website và dịch vụ mạng theo chu kỳ thời gian thực.

Khác với các ứng dụng CRUD thông thường (gọi API kiểm tra trực tiếp gây nghẽn luồng mạng), PingPulse được thiết kế chuẩn mực theo mô hình **Producer - Queue - Consumer**:
- **API Server (Producer):** Tiếp nhận yêu cầu, xác thực và đặt lịch công việc vào hàng đợi chỉ trong **< 10ms**.
- **Worker Process (Consumer):** Một tiến trình Node.js hoàn toàn độc lập, bốc việc từ Redis để ping mạng và cập nhật trạng thái mà không làm ảnh hưởng đến luồng phục vụ người dùng.

---

## 🏗️ Sơ đồ Kiến trúc Hệ thống

PingPulse phân tách rõ ràng giữa tiến trình xử lý API và tiến trình chạy ngầm qua 2 Event Loop độc lập:

```mermaid
flowchart TD
    Client["Client / Bảng điều khiển"] -->|"REST API Requests"| API["Express API Server (Cổng 5000)"]
    
    subgraph Ingestion_Layer["1. Tầng Tiếp nhận và Điều phối"]
        API -->|"CRUD Dữ liệu"| DB[("PostgreSQL (Prisma ORM)")]
        API -->|"Đặt lịch ping"| Queue["BullMQ Queue (monitor-checks)"]
        API -->|"Giới hạn tần suất"| RedisCache[("Redis 7 (Bộ nhớ đệm RAM)")]
    end

    subgraph Background_Worker["2. Tiến trình Worker Chạy ngầm (src/worker.ts)"]
        Queue -->|"Bốc job (concurrency: 5)"| Worker["BullMQ Worker Engine"]
        Worker -->|"Ping mạng HTTP"| Target["Website của người dùng"]
        Worker -->|"Phán quyết sự cố"| Brain["decideIncident State Machine"]
        Brain -->|"Ghi dữ liệu (Transaction ACID)"| DB
        Brain -->|"Xóa cache cũ"| RedisCache
    end

    subgraph Public_Status["3. Trang Trạng thái Công khai (Public Status)"]
        Visitor["Người dùng truy cập"] -->|"GET /api/status/:slug"| CacheCheck{"Có Cache trong Redis?"}
        CacheCheck -->|"CÓ"| ReturnCache["Trả JSON từ RAM (2ms)"]
        CacheCheck -->|"KHÔNG"| ReadDB["Truy vấn Postgres và Nạp Cache (TTL 30s)"]
    end
```

---

## 🚀 Các Điểm sáng về Kiến trúc

### 1. Tiến trình Worker Độc lập & Quản lý Lịch trình (BullMQ)
* **Tách rời tiến trình (Decoupling):** API chính (`src/index.ts`) không bao giờ tự ping mạng. Việc ping HTTP ra ngoài Internet được bàn giao cho `src/worker.ts` chạy trên một core CPU độc lập.
* **Lịch trình lặp lại (Job Schedulers):** Sử dụng `upsertJobScheduler` của BullMQ v5 để tạo nhịp ping tự động theo chu kỳ `interval_sec`. Đồng bộ vòng đời (Tạo/Sửa/Xóa monitor) giúp triệt tiêu hoàn toàn **Job bóng ma (Ghost Jobs)**.
* **Kiểm soát tải (`concurrency: 5`):** Mỗi tiến trình Worker xử lý đồng thời tối đa 5 I/O mạng song song, bảo vệ tài nguyên hệ thống không bị tràn RAM, không cạn kiệt socket mạng và không nghẽn connection pool của PostgreSQL.
* **Tắt máy an toàn (Graceful Shutdown):** Bắt các tín hiệu hệ điều hành `SIGINT` và `SIGTERM`, chờ toàn bộ job đang xử lý dở hoàn tất trước khi đóng kết nối DB/Redis.

### 2. Bộ não Phán quyết Sự cố & Giao dịch ACID
* **Hàm thuần khiết (`decideIncident`):** Tách biệt 100% logic nghiệp vụ khỏi Express và Database:
  - **Mở sự cố (DOWN):** Khi có **3 lần kiểm tra lỗi liên tiếp**.
  - **Đóng sự cố (UP):** Khi có **2 lần kiểm tra thành công liên tiếp**.
* **Đảm bảo tính nhất quán (ACID Transaction):** Sử dụng `prisma.$transaction` để ghi nhận đồng thời: thêm dòng check mới + cập nhật trạng thái monitor + tạo/đóng incident. Tuyệt đối không xảy ra hiện tượng dữ liệu bị lệch pha (Partial write).

### 3. Tối ưu Cơ sở Dữ liệu PostgreSQL & Đánh Chỉ mục B-Tree
* **Composite B-Tree Index:** Đánh chỉ mục kép `(monitor_id, checked_at DESC)` dựa trên quy tắc ESR, giúp câu lệnh lọc lịch sử check đạt tốc độ tối đa ($O(\log N)$ ~ 0.1ms).
* **Kỹ thuật `LATERAL JOIN`:** Khắc phục triệt để lỗi hiệu năng **N+1 Query** khi lấy danh sách monitor kèm lần check mới nhất, chỉ tốn 1 câu SQL duy nhất thay vì $1 + N$ câu truy vấn.
* **Phân trang bằng con trỏ (Cursor Pagination):** Thay thế kỹ thuật Offset chậm chạp bằng `WHERE id < :cursor ORDER BY id DESC LIMIT 20`, đảm bảo tốc độ phản hồi ở trang 1 hay trang 10.000 đều như nhau ($O(1)$).

### 4. Bộ nhớ đệm Cache-Aside & Giới hạn Tần suất bằng Lua Script
* **Mô hình Cache-Aside:** Trang trạng thái công khai (`GET /api/status/:slug`) lưu kết quả vào RAM Redis với `TTL = 30s`, che chắn đến 95% lưu lượng đọc vào Database khi có "bão F5".
* **Xóa cache chủ động (Cache Invalidation):** Ngay khi Worker phát hiện website đổi trạng thái hoặc Admin can thiệp, hệ thống lập tức gọi `redis.del('status:' + slug)`. Dữ liệu người xem luôn tươi mới với độ trễ bằng 0.
* **Rate Limiting bằng Lua Script:** Gom các lệnh `INCR`, `EXPIRE`, `TTL` vào một script Lua chạy nguyên tử (Atomic) trong Event Loop của Redis, chống Race Condition và trả về các Header chuẩn quốc tế (`X-RateLimit-*`, `429 Retry-After`).

---

## 📊 Kết quả Đo lường Hiệu năng Thực tế (Autocannon)

Thực nghiệm đo lường tải trên endpoint Public Status Page dưới áp lực **30 kết nối đồng thời trong 5 giây liên tục**:

| Chỉ số đo lường | 🐘 Truy vấn Trực tiếp (Postgres) | ⚡ Có Cache-Aside (Redis RAM) | Mức độ Cải thiện |
| :--- | :---: | :---: | :---: |
| **Thông lượng (Throughput)** | **1,185 req/s** | **3,365 req/s** | 🚀 **Tăng vọt ~2.84x lần** |
| **Tổng số Request xử lý (5s)** | 5,926 requests | **16,820 requests** | **+10,894 requests** |
| **Độ trễ trung bình (Avg Latency)** | 24.85 ms | **8.42 ms** | 🎯 **Nhanh hơn gấp ~3 lần** |
| **Độ trễ 99% người dùng (p99)** | 38.00 ms | **17.00 ms** | ⚡ **Giảm hơn 55% độ trễ** |
| **Tỷ lệ thành công (2xx)** | 100% (0 lỗi) | 100% (0 lỗi) | **Không rớt 1 request nào** |

> *Chi tiết báo cáo và biểu đồ phân tích được lưu tại file [REPORT_WEEK5.md](REPORT_WEEK5.md).*

---

## 📂 Cấu trúc Thư mục Dự án

```text
PingPulse/
├── src/
│   ├── checker/              # Module kiểm tra mạng HTTP (checkUrl)
│   ├── config/               # Cấu hình Database (Prisma), Redis và Pino Logger
│   ├── controllers/          # Bộ điều khiển API (Monitors, Status Page, Users)
│   ├── incident/             # Bộ não phán quyết sự cố thuần khiết (decideIncident)
│   ├── middlewares/          # Middleware xác thực JWT & Giới hạn tần suất (Rate Limiter)
│   ├── queues/               # Định nghĩa hàng đợi công việc BullMQ
│   ├── routes/               # Khai báo các tuyến đường dẫn API
│   ├── tests/                # 84 bài kiểm thử tự động với Vitest
│   ├── utils/                # Hàm tiện ích thuần (pick, omit, chunk, retry)
│   ├── workers/              # Xử lý logic công việc check (checkProcessor)
│   ├── worker.ts             # Tiến trình Worker chạy ngầm độc lập
│   └── index.ts              # Điểm khởi động Server Express API
├── prisma/
│   ├── migrations/           # Lịch sử thay đổi cấu trúc cơ sở dữ liệu
│   └── schema.prisma         # Định nghĩa Schema bảng, quan hệ & Index
├── docker-compose.yml        # Điều phối môi trường Docker (PostgreSQL 16 & Redis 7)
├── package.json              # Khai báo thư viện và kịch bản thực thi
├── tsconfig.json             # Cấu hình trình biên dịch TypeScript nghiêm ngặt
├── vitest.config.ts          # Cấu hình bộ khung kiểm thử Vitest
├── devlog.md                 # Sổ tay kiến thức kiến trúc Backend chuyên sâu (8 phần)
├── REPORT_WEEK5.md           # Báo cáo đo tải hiệu năng chi tiết
└── README.md
```

---

## 🛠️ Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu Tiên quyết
- [Node.js](https://nodejs.org/) (Khuyến nghị phiên bản LTS 20+)
- [Docker](https://www.docker.com/) & Docker Compose
- Quản lý gói `npm`

### 1. Tải mã nguồn & Cài đặt Thư viện
```bash
git clone https://github.com/DaoDuyHai/PingPulse.git
cd PingPulse
npm install
```

### 2. Khởi động Cơ sở hạ tầng (Docker Compose)
Bật các container PostgreSQL 16 và Redis 7 chạy ngầm:
```bash
docker compose up -d
```

### 3. Cấu hình Biến Môi trường
Tạo file `.env` tại thư mục gốc của dự án:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pingpulse_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="chuoi-khoa-bao-mat-jwt-cua-ban"
NODE_ENV="development"
```

### 4. Chạy Migration Cơ sở Dữ liệu
```bash
npx prisma migrate dev
```

### 5. Khởi chạy Ứng dụng
Mở **Terminal 1** để chạy tiến trình **API Server**:
```bash
npm run dev
# Server lắng nghe tại cổng http://localhost:5000
```

Mở **Terminal 2** để chạy tiến trình **Background Worker**:
```bash
npm run worker
# Worker khởi động và lắng nghe hàng đợi với concurrency: 5
```

---

## 🧪 Kiểm thử Tự động (Testing)

Dự án chú trọng tính đúng đắn và độ tin cậy với **84 bài kiểm thử tự động**, tỷ lệ vượt qua **100%**:

```bash
npm test
```

### Phạm vi Bao phủ của Test Suite (17 files / 84 tests):
- **Kiểm thử Đơn vị (Unit Tests):** Bộ não `decideIncident` (mọi trường hợp biên: xen kẽ lỗi/thành công, chưa đủ lần lỗi, đang có sự cố), các hàm tiện ích mảng và đối tượng.
- **Kiểm thử Tích hợp API (Integration Tests):** Luồng người dùng hoàn chỉnh (Đăng ký $\rightarrow$ Đăng nhập $\rightarrow$ Tạo monitor $\rightarrow$ Check ngay $\rightarrow$ Phân trang Cursor).
- **Kiểm thử Cache & Rate Limit:** Xác thực chu kỳ sống của Cache-Aside, cơ chế xóa cache khi đổi dữ liệu, kiểm tra mã HTTP 429 khi vượt ngưỡng tần suất.
- **Kiểm thử Hàng đợi & Worker:** Mô phỏng đẩy job vào Redis thật, Worker bốc job tự động, xử lý trôi chảy khi monitor bị xóa giữa chừng.

---

## 👤 Tác giả

**Đào Duy Hải**  
- **Vị trí:** Backend Developer  
- **Email:** haicoder.journey@gmail.com  
- **GitHub:** [@DaoDuyHai](https://github.com/DaoDuyHai)  
- **Đơn vị:** Học viện Công nghệ Bưu chính Viễn thông (PTIT)
