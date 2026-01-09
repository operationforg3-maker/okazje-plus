/** @jest-environment node */
import { convertPrice, getFxRate } from '../fx';

describe('fx', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    global.fetch = realFetch as any;
    jest.clearAllMocks();
  });

  it('converts with live rate when API responds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { PLN: 4 } }),
    } as any);

    const rate = await getFxRate('USD', 'PLN');
    expect(rate).toBe(4);

    const price = await convertPrice(10, 'USD', 'PLN');
    expect(price).toBe(40);
  });

  it('falls back to 1.0 when API fails and no fallback rate', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as any);
    const price = await convertPrice(5, 'XYZ', 'ABC');
    expect(price).toBe(5);
  });
});
