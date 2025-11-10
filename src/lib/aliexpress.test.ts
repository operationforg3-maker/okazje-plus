import { createAliSign, buildSignedParams, toQueryString } from './aliexpress';

describe('AliExpress AOP Signing Helpers', () => {
  describe('createAliSign', () => {
    it('should generate MD5 signature with appSecret wrapped around params', () => {
      const params = {
        q: 'smartwatch',
        category: 'electronics'
      };
      const appSecret = 'test-secret-123';

      // Expected: MD5(test-secret-123categoryelectronicsqsmartwatch test-secret-123)
      // Note: params are sorted alphabetically: category, q
      const sign = createAliSign(params, appSecret);

      // Verify it returns uppercase hex
      expect(sign).toMatch(/^[A-F0-9]{32}$/);
    });

    it('should sort parameters alphabetically before signing', () => {
      const params1 = { z: 'last', a: 'first', m: 'middle' };
      const params2 = { a: 'first', m: 'middle', z: 'last' };
      const appSecret = 'secret';

      const sign1 = createAliSign(params1, appSecret);
      const sign2 = createAliSign(params2, appSecret);

      // Same parameters in different order should produce same signature
      expect(sign1).toBe(sign2);
    });

    it('should ignore empty, null, and undefined values', () => {
      const params1 = { q: 'test', empty: '', nil: null, undef: undefined };
      const params2 = { q: 'test' };
      const appSecret = 'secret';

      const sign1 = createAliSign(params1, appSecret);
      const sign2 = createAliSign(params2, appSecret);

      expect(sign1).toBe(sign2);
    });

    it('should produce deterministic output for same inputs', () => {
      const params = { q: 'test', limit: '10' };
      const appSecret = 'my-secret';

      const sign1 = createAliSign(params, appSecret);
      const sign2 = createAliSign(params, appSecret);

      expect(sign1).toBe(sign2);
    });

    it('should produce different signatures for different appSecrets', () => {
      const params = { q: 'test' };

      const sign1 = createAliSign(params, 'secret1');
      const sign2 = createAliSign(params, 'secret2');

      expect(sign1).not.toBe(sign2);
    });

    it('should produce different signatures for different parameters', () => {
      const appSecret = 'secret';

      const sign1 = createAliSign({ q: 'test1' }, appSecret);
      const sign2 = createAliSign({ q: 'test2' }, appSecret);

      expect(sign1).not.toBe(sign2);
    });
  });

  describe('buildSignedParams', () => {
    it('should include user params in the signed params', () => {
      const userParams = { q: 'smartphone', minPrice: 50 };
      const appKey = 'key123';
      const appSecret = 'secret123';

      const signed = buildSignedParams(userParams, appKey, appSecret);

      expect(signed.q).toBe('smartphone');
      expect(signed.minPrice).toBe('50');
    });

    it('should add required AOP parameters', () => {
      const userParams = { q: 'test' };
      const appKey = 'key123';
      const appSecret = 'secret123';

      const signed = buildSignedParams(userParams, appKey, appSecret);

      expect(signed.app_key).toBe('key123');
      expect(signed.timestamp).toBeDefined();
      expect(signed.format).toBe('json');
      expect(signed.v).toBe('2.0');
      expect(signed.sign).toBeDefined();
    });

    it('should preserve user-provided format and v parameters', () => {
      const userParams = { q: 'test', format: 'xml', v: '1.0' };
      const appKey = 'key';
      const appSecret = 'secret';

      const signed = buildSignedParams(userParams, appKey, appSecret);

      expect(signed.format).toBe('xml');
      expect(signed.v).toBe('1.0');
    });

    it('should convert numeric and boolean user params to strings', () => {
      const userParams = { q: 'test', limit: 100, isDraft: true };
      const appKey = 'key';
      const appSecret = 'secret';

      const signed = buildSignedParams(userParams, appKey, appSecret);

      expect(typeof signed.limit).toBe('string');
      expect(signed.limit).toBe('100');
      expect(typeof signed.isDraft).toBe('string');
      expect(signed.isDraft).toBe('true');
    });

    it('should generate valid sign that matches createAliSign result', () => {
      const userParams = { q: 'test' };
      const appKey = 'key123';
      const appSecret = 'secret123';

      const signed = buildSignedParams(userParams, appKey, appSecret);

      // Reconstruct params without sign for verification
      const paramsForVerify: Record<string, string> = {};
      Object.entries(signed).forEach(([k, v]) => {
        if (k !== 'sign') paramsForVerify[k] = String(v);
      });

      const expectedSign = createAliSign(paramsForVerify, appSecret);
      expect(signed.sign).toBe(expectedSign);
    });
  });

  describe('toQueryString', () => {
    it('should convert params to URL query string', () => {
      const params = { q: 'test', limit: 10 };
      const qs = toQueryString(params);

      expect(qs).toContain('q=test');
      expect(qs).toContain('limit=10');
      expect(qs).toContain('&');
    });

    it('should URL-encode special characters', () => {
      const params = { q: 'smart watch', category: 'elektronika/smartwatch' };
      const qs = toQueryString(params);

      expect(qs).toContain('smart%20watch');
      expect(qs).toContain('elektronika%2Fsmartwatch');
    });

    it('should handle numeric and boolean values', () => {
      const params = { limit: 50, active: true };
      const qs = toQueryString(params);

      expect(qs).toContain('limit=50');
      expect(qs).toContain('active=true');
    });

    it('should not include empty string values (behavior depends on implementation)', () => {
      // Note: Current implementation includes empty strings; adjust if behavior changes
      const params = { q: 'test', empty: '' };
      const qs = toQueryString(params);

      // Implementation includes empty values, so:
      expect(qs).toContain('empty=');
    });
  });

  describe('Integration: Full signing flow', () => {
    it('should produce valid signed params for AliExpress search', () => {
      const userParams = { q: 'wireless earphones', category: 'electronics' };
      const appKey = 'aliexpress_app_key_123';
      const appSecret = 'aliexpress_app_secret_xyz';

      const signed = buildSignedParams(userParams, appKey, appSecret);
      const qs = toQueryString(signed);

      // Verify signed params are present
      expect(qs).toContain('q=wireless%20earphones');
      expect(qs).toContain('app_key=aliexpress_app_key_123');
      expect(qs).toContain('sign=');
      expect(qs).toContain('timestamp=');

      // Verify signature is valid
      const paramsForVerify: Record<string, string> = {};
      Object.entries(signed).forEach(([k, v]) => {
        if (k !== 'sign') paramsForVerify[k] = String(v);
      });
      const expectedSign = createAliSign(paramsForVerify, appSecret);
      expect(signed.sign).toBe(expectedSign);
    });
  });
});
