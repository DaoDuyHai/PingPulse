# 🚀 TUẦN 2: PRISMA VÀ EXPRESS API (~15 GIỜ)

> **Mục tiêu tối thượng của tuần:** 
> Xây dựng hoàn chỉnh một hệ thống Backend API chuẩn chỉ:
> 1. Có Đăng ký / Đăng nhập bảo mật (JWT + Hash mật khẩu).
> 2. Quản lý danh sách website (CRUD Monitor - Mỗi user chỉ thấy web của mình, tối đa 5 web).
> 3. Bấm "Check Now" (`POST /monitors/:id/check`) -> gọi con robot `checkUrl`, lưu kết quả vào Postgres và cập nhật trạng thái.
> 4. Hiểu bản chất và triệt tiêu lỗi hiệu năng kinh điển **N+1 Query**.

---

## 📋 DANH SÁCH CÔNG VIỆC CẦN LÀM (TASKS)

- [x] **Task 2.1:** Cài đặt Prisma ORM, chuyển đổi bảng SQL thành `schema.prisma`, chạy lệnh Migration (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [x] **Task 2.2:** Xây dựng hệ thống Đăng ký / Đăng nhập: Băm mật khẩu (bcrypt), cấp phát Token (JWT), Middleware xác thực (3 giờ). ✅ ĐÃ HOÀN THÀNH
- [ ] **Task 2.3:** Xây dựng bộ API CRUD Monitor: Thêm, sửa, xóa, xem danh sách (chỉ xem được web của mình, chặn nếu vượt quá 5 web/user) (4 giờ).
- [ ] **Task 2.4:** API `POST /monitors/:id/check`: Kích hoạt con robot `checkUrl`, ghi lịch sử vào bảng `checks`, cập nhật trạng thái `monitors.status` (3 giờ).
- [ ] **Task 2.5:** Bật Query Log của Prisma, phát hiện và sửa tận gốc lỗi hiệu năng **N+1 Query** (2 giờ).

---

## 🧠 2 CÂU HỎI LÝ THUYẾT CỐT LÕI (CẦN TỰ TRẢ LỜI ĐƯỢC)

### ❓ Câu hỏi 1: Migration là gì? Vì sao không nên sửa bảng trực tiếp bằng tay trong DB?
* **Khái niệm:** Migration giống như **"Git dành cho Database"**. Mỗi lần bạn thêm cột, sửa bảng, Prisma sẽ lưu lại một file nhật ký (migration file) ghi rõ ngày giờ và nội dung thay đổi.
* **Vì sao không sửa tay bằng pgAdmin?**
  1. Nếu bạn sửa tay trên máy bạn: Khi đồng nghiệp tải code về, hoặc khi đưa code lên máy chủ thật (Production), database bên đó **sẽ không có cột mới** -> Web lập tức lăn đùng ra lỗi!
  2. Dùng Migration: Đồng nghiệp chỉ cần gõ `npx prisma migrate deploy` là database của họ tự động nâng cấp cấu trúc y hệt máy bạn mà không cần ai phải bấm chuột sửa tay!

### ❓ Câu hỏi 2: Lỗi N+1 Query là gì? Cách phòng tránh?
* **Bản chất lỗi N+1:**
  * Giả sử bạn có **N = 100 website**.
  * Thay vì lấy 100 website kèm lần check mới nhất trong **1 câu lệnh duy nhất**.
  * Bạn lại viết: Lấy 100 website (1 câu query), sau đó dùng vòng lặp `for` chạy 100 lần, mỗi lần lại thò tay vào DB hỏi kết quả check mới nhất (thêm N câu query nữa).
  * 👉 **Tổng cộng:** $1 + 100 = 101$ câu query đập liên tiếp vào database! Database nghẽn thở ngay lập tức!
* **Cách khắc phục:**
  * Dùng tính năng `include` (hoặc `JOIN` trong SQL) để Database gom cả Website lẫn Lần check mới nhất **trong đúng 1 lần truy vấn duy nhất**!

---

## 🗺️ BẢN ĐỒ CÁC ROUTE API SẼ XÂY DỰNG

| Phương thức | Đường dẫn API | Chức năng | Yêu cầu bảo mật |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Công khai |
| `POST` | `/api/auth/login` | Đăng nhập -> Nhận JWT Token | Công khai |
| `GET` | `/api/monitors` | Lấy danh sách website kèm lần check mới nhất | Cần Token (Chỉ lấy của mình) |
| `POST` | `/api/monitors` | Thêm website mới cần theo dõi | Cần Token (Tối đa 5 website) |
| `GET` | `/api/monitors/:id` | Xem chi tiết 1 website | Cần Token (Đúng chủ sở hữu) |
| `PUT` | `/api/monitors/:id` | Sửa tên, URL, chu kỳ | Cần Token (Đúng chủ sở hữu) |
| `DELETE` | `/api/monitors/:id` | Xóa website theo dõi | Cần Token (Đúng chủ sở hữu) |
| `POST` | `/api/monitors/:id/check` | **"Check Now"** -> Gõ cửa URL, ghi lịch sử | Cần Token (Đúng chủ sở hữu) |

---

## 🎯 TIÊU CHÍ NGHIỆM THU (DONE DEFINITION)
1. Dùng file test HTTP (hoặc Postman) gọi trơn tru từ đầu đến cuối: Đăng ký -> Đăng nhập -> Tạo monitor -> Bấm Check -> Xem lịch sử.
2. User A không bao giờ xem, sửa hoặc xóa được Monitor của User B (Test phân quyền).
3. Người dùng thứ 6 không thể tạo thêm website nếu đã có 5 website (Test giới hạn nghiệp vụ).
4. Nhìn log terminal của Prisma chứng minh truy vấn danh sách chỉ tốn số lượng query cố định, không bị lặp N+1.
