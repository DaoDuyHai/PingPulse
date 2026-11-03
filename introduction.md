# Hướng dẫn toàn diện về TypeScript: Từ cơ bản đến nâng cao

Tài liệu này tổng hợp toàn bộ kiến thức cốt lõi và nâng cao trong TypeScript, từ cú pháp nền tảng, hệ thống kiểu nâng cao, đến các kỹ thuật thực chiến trong dự án thực tế (Express, Zod, Error Handling, Fetch & AbortController, v.v.).

---

## 1. Kiểu cơ bản (Basic Types)

TypeScript cung cấp hệ thống kiểu tĩnh dựa trên các kiểu dữ liệu của JavaScript và bổ sung thêm một số kiểu đặc thù.

### Lý thuyết

- **Primitives:** `string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`.
- **Arrays:** Khai báo mảng bằng `type[]` hoặc `Array<type>`.
- **Tuples:** Mảng có độ dài cố định và kiểu dữ liệu xác định tại từng vị trí index cụ thể.

### Ví dụ

```typescript
// Primitives
let username: string = 'Nguyen Van A';
let age: number = 25;
let isActive: boolean = true;

// Arrays
let numbers: number[] = [1, 2, 3, 4];
let names: Array<string> = ['An', 'Binh', 'Chi'];

// Tuples (Mảng có cấu trúc cố định)
let userRecord: [number, string] = [1, 'Admin'];
```

---

## 2. Interface vs Type Alias

Cả hai đều dùng để định nghĩa hình dạng (shape) của object, tuy nhiên chúng có những đặc thù riêng.

### Lý thuyết

- **`type` (Type Alias):** Dùng để đặt tên cho một kiểu dữ liệu (primitive, union, intersection, object). Có thể dùng toán tử `&` để kết hợp. Không hỗ trợ tính năng tự động gộp (Declaration Merging).
- **`interface`:** Dành riêng cho việc định nghĩa cấu trúc của object hoặc class. Hỗ trợ **Declaration Merging** (tự động gộp các interface trùng tên).

### Ví dụ

```typescript
// Sử dụng type cho union hoặc primitive
type ID = string | number;

type UserType = {
  id: ID;
  name: string;
};

// Sử dụng interface cho object/class
interface IUser {
  id: ID;
  name: string;
}

// Interface hỗ trợ Declaration Merging
interface IUser {
  email?: string; // Tự động gộp thêm trường email vào IUser ở trên
}

const u: IUser = { id: 1, name: 'Hung', email: 'hung@example.com' };
```

---

## 3. Union Types (`|`) và Optional (`?`)

### Lý thuyết

- **Union Types (`|`):** Cho phép một biến có thể nhận một trong nhiều kiểu dữ liệu khác nhau.
- **Optional (`?`):** Dùng trong object hoặc tham số của hàm, biểu thị rằng thuộc tính đó có thể có hoặc không (mang giá trị `undefined`).

### Ví dụ

```typescript
// Union Type
let statusType: 'pending' | 'success' | 'error';
statusType = 'success'; // Hợp lệ

// Optional properties
interface Product {
  id: number;
  name: string;
  description?: string; // Không bắt buộc phải truyền
}

const p1: Product = { id: 1, name: 'Laptop' };
```

---

## 4. `any` vs `unknown`

### Lý thuyết

- **`any`:** Tắt toàn bộ hệ thống kiểm tra kiểu (type-checking) của TypeScript tại vị trí đó. Gây mất an toàn mã nguồn.
- **`unknown`:** Phiên bản an toàn hơn của `any`. Mọi giá trị đều có thể gán vào `unknown`, nhưng **không thể** sử dụng trực tiếp biến `unknown` nếu chưa ép kiểu hoặc kiểm tra kiểu (narrowing).

### Ví dụ

```typescript
let userInputAny: any = 10;
userInputAny.trim(); // Không báo lỗi lúc biên dịch, nhưng SẼ SẬP (runtime error) nếu không phải string

let userInputUnknown: unknown = 'Hello';
// userInputUnknown.trim(); // Lỗi: Object is of type 'unknown'.

// Bắt buộc phải narrowing trước khi dùng:
if (typeof userInputUnknown === 'string') {
  console.log(userInputUnknown.toUpperCase()); // An toàn tuyệt đối
}
```

---

## 5. Enum vs String Union

### Lý thuyết

Cho phép định nghĩa tập hợp các hằng số.

- **Lưu ý thực tế:** Nhiều dự án hiện đại ưu tiên dùng **String Union** (`"ADMIN" | "EDITOR"`) thay vì `enum` truyền thống vì `enum` sinh thêm mã JavaScript lúc biên dịch, trong khi String Union hoàn toàn biến mất sau khi transpile.

### Ví dụ

```typescript
// Cách 1: Enum
enum RoleEnum {
  Admin = 'ADMIN',
  User = 'USER',
}

// Cách 2: String Union (Khuyên dùng trong nhiều dự án hiện đại)
type RoleUnion = 'ADMIN' | 'USER';
const currentRole: RoleUnion = 'ADMIN';
```

---

## 6. Hàm có kiểu (Typed Functions)

### Lý thuyết

Định nghĩa kiểu dữ liệu cho tham số đầu vào và kiểu dữ liệu trả về của hàm. Sử dụng `void` nếu hàm không trả về giá trị.

### Ví dụ

```typescript
function calculateTax(amount: number, rate: number = 0.1): number {
  return amount * rate;
}

const logMessage: (msg: string) => void = (msg) => {
  console.log(`[Log]: ${msg}`);
};
```

---

## 7. Type Narrowing (Thu hẹp kiểu)

### Lý thuyết

TypeScript tự động phân tích và thu hẹp kiểu dữ liệu của biến dựa trên các câu lệnh kiểm tra luồng điều kiện (`typeof`, `instanceof`, `in`, `Array.isArray`).

### Ví dụ

```typescript
function printId(id: number | string) {
  if (typeof id === 'string') {
    console.log(id.toUpperCase());
  } else {
    console.log(id.toFixed(2));
  }
}
```

---

## 8. TSConfig Strict Mode & Các cờ quan trọng

### Lý thuyết

Cờ `strict: true` trong `tsconfig.json` kích hoạt tập hợp các kiểm tra nghiêm ngặt. Ngoài ra, cần lưu ý hai cờ cực kỳ quan trọng:

- **`useUnknownInCatchVariables`:** Đảm bảo biến lỗi trong khối `catch (error)` có kiểu là `unknown` thay vì `any` (nếu bật strict).
- **`noUncheckedIndexedAccess`:** Ép buộc lập trình viên phải xử lý trường hợp truy cập mảng hoặc object qua index (`arr[0]`) có thể trả về giá trị `undefined`.
- **`"module": "NodeNext"`:** Khi dùng cấu hình này, các import tương đối bắt buộc phải kèm phần mở rộng file rõ ràng (ví dụ: `import { x } from "./utils.js"`).

### Ví dụ `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## 9. Generics & Generic Constraints

### Lý thuyết

- **Generics:** Cho phép tạo các thành phần (function, interface, class) có khả năng tái sử dụng cao với nhiều kiểu dữ liệu khác nhau mà vẫn đảm bảo an toàn kiểu.
- **Generic Constraints (`<T extends ...>`):** Giới hạn phạm vi của `T` phải thỏa mãn một cấu trúc hoặc kiểu nhất định (Prisma và NestJS sử dụng rất nhiều).

### Ví dụ

```typescript
// Generic cơ bản
function wrapInArray<T>(item: T): T[] {
  return [item];
}

// Generic Constraint: T bắt buộc phải có thuộc tính id kiểu number
function findById<T extends { id: number }>(
  items: T[],
  id: number
): T | undefined {
  return items.find((item) => item.id === id);
}

const user = findById(
  [
    { id: 1, name: 'An' },
    { id: 2, name: 'Binh' },
  ],
  1
);
```

---

## 10. Utility Types (`Partial`, `Pick`, `Omit`, `Record`)

### Lý thuyết

Các utility sẵn có giúp biến đổi kiểu dữ liệu linh hoạt:

- `Partial<T>`: Biến mọi thuộc tính thành optional.
- `Pick<T, K>`: Chọn ra tập con các thuộc tính `K` từ `T`.
- `Omit<T, K>`: Lược bỏ các thuộc tính `K` khỏi `T`.
- `Record<K, T>`: Tạo object type với key `K` và giá trị `T`.

### Ví dụ thực tế

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
}

// Khi cập nhật User, không được phép sửa id và passwordHash trực tiếp qua DTO này:
type UpdateUserDto = Partial<Omit<User, 'id' | 'passwordHash'>>;

type UserBasicInfo = Pick<User, 'id' | 'name'>;
```

---

## 11. Kiểu cho Express.js

### Lý thuyết

Khi viết ứng dụng Express với TypeScript, ta gán kiểu cho `Request`, `Response`, và kết hợp generics `Request<Params, ResBody, ReqBody, ReqQuery>`.

- _Lưu ý quan trọng:_ Kiểu của `req.body` trong Express chỉ là lời khai báo tĩnh, **không đảm bảo dữ liệu thực tế** lúc chạy. Luôn phải kết hợp với thư viện Validation (như Zod) để kiểm tra runtime.

### Ví dụ

```typescript
import { Request, Response, NextFunction } from 'express';

interface Params {
  id: string;
}
interface RequestBody {
  title: string;
  content: string;
}

export const createPostHandler = (
  req: Request<Params, any, RequestBody>,
  res: Response,
  next: NextFunction
) => {
  const { title } = req.body; // Được gợi ý kiểu dữ liệu chuẩn xác
  res.status(201).json({ success: true, title });
};
```

---

## 12. Zod + `z.infer` (Validation Runtime)

### Lý thuyết

TypeScript chỉ kiểm tra lúc biên dịch. **Zod** giúp validate dữ liệu trực tiếp khi chương trình đang chạy. `z.infer` tự động sinh TypeScript type từ Zod schema, tránh việc khai báo trùng lặp.

- _Lưu ý phiên bản:_ Hãy đối chiếu tài liệu chính thức nếu bạn sử dụng các phiên bản Zod mới nhất để cập nhật các phương thức validation phù hợp.

### Ví dụ

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
});

// Tự động suy diễn type từ Zod Schema
type UserInput = z.infer<typeof UserSchema>;

function processUserData(data: unknown) {
  const result = UserSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Dữ liệu không hợp lệ!');
  }
  const validUser: UserInput = result.data; // An toàn tuyệt đối tại runtime & compile-time
}
```

---

## 13. Discriminated Unions (Kiểu phân biệt)

### Lý thuyết

Đây là một trong những kỹ thuật quan trọng nhất trong TypeScript, dùng để xây dựng các kiểu dữ liệu kết quả (như `Result<T, E>`) hoặc quản lý trạng thái phức tạp. TypeScript tự động thu hẹp kiểu dựa trên một trường chung (ví dụ: `ok: boolean`).

### Ví dụ

```typescript
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Ví dụ ứng dụng trong Checker Core
type CheckResult = Result<
  { latency: number },
  { code: 'timeout' | 'dns_error' | 'ssl_error' }
>;

function handleCheck(res: CheckResult) {
  if (res.ok) {
    // TypeScript tự hiểu đây là nhánh thành công, truy cập được res.data
    console.log(`Độ trễ: ${res.data.latency}ms`);
  } else {
    // TypeScript tự hiểu đây là nhánh lỗi, truy cập được res.error
    console.log(`Mã lỗi: ${res.error.code}`);
  }
}
```

---

## 14. Type Guards (`x is User`)

### Lý thuyết

Type Guard là một hàm trả về kiểu dữ liệu dạng `arg is Type`. Khi hàm trả về `true`, TypeScript sẽ tự động thu hẹp kiểu của biến ở phạm vi bên ngoài.

### Ví dụ

```typescript
interface User {
  id: number;
  name: string;
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj
  );
}

function processInput(input: unknown) {
  if (isUser(input)) {
    // Tại đây input đã được TypeScript tự động chuyển kiểu thành User
    console.log(input.name.toUpperCase());
  }
}
```

---

## 15. Các từ khóa nâng cao: `as const`, `satisfies`, `readonly`, `import type`

### Lý thuyết

- **`as const`:** Biến object hoặc array thành dạng readonly và ép kiểu về hằng số giá trị nguyên thủy (literal types) thay vì kiểu chung chung (`string`, `number`).
- **`satisfies`:** Cho phép kiểm tra xem một biến có thỏa mãn một kiểu dữ liệu hay không mà **không làm mất đi** kiểu literal cụ thể của nó.
- **`readonly`:** Ngăn chặn việc gán lại giá trị cho thuộc tính của object hoặc phần tử mảng.
- **`import type`:** Chỉ định rõ chỉ import kiểu dữ liệu (type/interface), giúp trình biên dịch loại bỏ hoàn toàn dòng import đó khi chuyển sang JavaScript.

### Ví dụ

```typescript
// 1. as const
const CONFIG = {
  endpoint: 'https://api.example.com',
  timeout: 5000,
} as const; // Kiểu sẽ là readonly các giá trị literal cụ thể

// 2. satisfies
type Colors = Record<string, string | string[]>;
const palette = {
  primary: ['#ff0000', '#00ff00'],
  secondary: '#0000ff',
} satisfies Colors;

// 3. import type
import type { User } from './types.js';
```

---

## 16. Kiểu cho hàm Async: `Promise<T>`, `Awaited<T>`, `ReturnType<T>`

### Lý thuyết

- **`Promise<T>`:** Đại diện cho một hàm bất đồng bộ trả về giá trị kiểu `T` khi hoàn thành.
- **`Awaited<T>`:** Trích xuất kiểu dữ liệu bên trong một `Promise` hoặc mảng lồng nhau.
- **`ReturnType<T>`:** Lấy ra kiểu dữ liệu trả về của một hàm bất kỳ.

### Ví dụ

```typescript
async function fetchUser(): Promise<{ id: number; name: string }> {
  return { id: 1, name: 'Nguyen Van A' };
}

// Awaited<T> giúp lấy trực tiếp kiểu dữ liệu mà Promise trả về
type FetchedUser = Awaited<ReturnType<typeof fetchUser>>;
// Kết quả: { id: number; name: string; }
```

---

## 17. Error Handling tập trung trong TypeScript

### Lý thuyết

Khi bật `useUnknownInCatchVariables: true`, biến lỗi trong khối `catch (error)` có kiểu `unknown`. Bạn cần dùng type checking an toàn để xử lý.

### Ví dụ

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function handleCatchError(error: unknown): string {
  if (error instanceof AppError) {
    return `[Lỗi ứng dụng ${error.statusCode}]: ${error.message}`;
  } else if (error instanceof Error) {
    return `[Lỗi hệ thống]: ${error.message}`;
  }
  return 'Đã xảy ra lỗi không xác định!';
}
```

---

## 18. Fetch và `AbortSignal.timeout` trong Node.js

### Lý thuyết

Node.js hiện đại hỗ trợ sẵn `fetch` và `AbortSignal.timeout(ms)`, giúp xử lý việc hủy yêu cầu HTTP quá thời gian (timeout) một cách cực kỳ gọn gàng mà không cần tự tạo `AbortController` phức tạp.

- _Lưu ý thực tế:_ Khi dùng `AbortSignal.timeout`, lỗi timeout sinh ra có tên là `TimeoutError` (hoặc `AbortError` tùy phiên bản runtime), hãy kiểm tra kỹ khi làm phần Checker Core.

### Ví dụ

```typescript
async function checkWebsite(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000), // Tự động timeout sau 3 giây
    });

    if (!response.ok) throw new Error('HTTP Error');
    return { ok: true, status: response.status };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { ok: false, error: { code: 'timeout' as const } };
    }
    return { ok: false, error: { code: 'dns_error' as const } };
  }
}
```

---

## 19. Góc nhìn từ Total TypeScript (Matt Pocock)

Các nguyên tắc vàng giúp tư duy lập trình TypeScript chuyên nghiệp hơn:

1. **Tránh ép kiểu `as` vô tội vạ:** Việc dùng `as User` sẽ che giấu lỗi thực tế. Hãy dùng Zod hoặc Type Guards để kiểm tra dữ liệu thật.
2. **Ưu tiên `unknown` thay vì `any`:** Ép buộc lập trình viên phải kiểm tra kiểu trước khi sử dụng dữ liệu từ bên ngoài.
3. **Đọc lỗi từ dưới lên (hoặc từ trong ra ngoài):** Các thông báo lỗi của TS đôi khi rất dài, hãy tập trung vào dòng cuối cùng hoặc từ khóa mấu chốt để tìm nguyên nhân gốc rễ.
