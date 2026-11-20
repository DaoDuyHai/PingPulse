import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkUrl } from '../checker/checkUrl.js';

describe('checkUrl (Unit Tests với Mocking Fetch)', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks;
  });
  //---Test 1 : Website sống bình thường (200 OK)
  it('tra ve isUp = true khi website phan hoi ma 200', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await checkUrl('https://google.com');

    expect(result.isUp).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeNull();
    expect(typeof result.latencyMs).toBe('number');
  });

  // Test 2 : Test lỗi khi máy chủ bị lỗi 500

  // --- TEST 2: Website bị lỗi máy chủ (500 Server Error) ---
  it('tra ve isUp = false khi website phan hoi ma 500', async () => {
    // Giả lập: fetch trả về mã lỗi 500
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await checkUrl('https://my-broken-website.com');
    expect(result.isUp).toBe(false);
    expect(result.status).toBe(500);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.error).toBeNull();
  });

  //---Test 3 : Đứt cáp quang hoặt TimeOut (Ném ngoại lệ Error)

  it('tra ve isUp = false va error message khi mang bi mat ket noi', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await checkUrl('https://dead-link.com');

    expect(result.isUp).toBe(false);
    expect(result.status).toBeNull();
    expect(result.latencyMs).toBeNull();
    expect(result.error).toBe('Connection timeout');
  });
});
