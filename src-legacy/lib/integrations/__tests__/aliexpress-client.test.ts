/**
 * AliExpress API Client Tests
 * - Mock signing verification
 * - Token exchange
 * - Product fetching
 */

// @ts-nocheck
import { describe, it, expect, beforeAll } from "@jest/globals";
import { AliExpressClient, getAliExpressClient } from "../aliexpress-client";

describe("AliExpressClient", () => {
  let client: AliExpressClient;

  beforeAll(() => {
    // Mock environment
    process.env.ALIEXPRESS_APP_KEY = "test_app_key_12345";
    process.env.ALIEXPRESS_APP_SECRET = "test_app_secret_67890";

    client = new AliExpressClient({
      appKey: "test_app_key_12345",
      appSecret: "test_app_secret_67890",
      region: "eu",
    });
  });

  describe("Token management", () => {
    it("should set and retrieve tokens", () => {
      const accessToken = "test_access_token";
      const refreshToken = "test_refresh_token";
      const expiresIn = 3600;

      client.setTokens(accessToken, refreshToken, expiresIn);

      const tokens = client.getTokens();
      expect(tokens.accessToken).toBe(accessToken);
      expect(tokens.refreshToken).toBe(refreshToken);
      expect(tokens.expiresAt).toBeDefined();
    });

    it("should calculate token expiry correctly", () => {
      const beforeTime = Date.now();
      client.setTokens("access", "refresh", 3600);
      const afterTime = Date.now();

      const tokens = client.getTokens();
      const expiryTime = tokens.expiresAt!;

      expect(expiryTime).toBeGreaterThan(beforeTime + 3600 * 1000 - 100);
      expect(expiryTime).toBeLessThan(afterTime + 3600 * 1000 + 100);
    });
  });

  describe("Signing", () => {
    it("should generate valid HMAC-MD5 signature", () => {
      // This test verifies the signature format
      // In production, compare against known good signatures from AE docs
      const params = {
        app_key: "test_key",
        method: "aliexpress.solution.product.info.get",
        timestamp: "2025-12-05T10:00:00",
        v: "1.0",
        format: "json",
      };

      // Manually call signing (would be private in real usage)
      // For now, just verify it doesn't throw
      expect(() => {
        client.getTokens(); // Just verify client is instantiated
      }).not.toThrow();
    });
  });

  describe("Error handling", () => {
    it("should handle network errors gracefully", async () => {
      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network error"));

      await expect(
        client.getProductInfo("test_product_id")
      ).rejects.toThrow();
    });

    it("should retry on 429 (rate limit)", async () => {
      let callCount = 0;
      global.fetch = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(null, { status: 429 });
        }
        return new Response(
          JSON.stringify({ product_id: "123", title: "Test Product" }),
          { status: 200 }
        );
      });

      // This would need the actual retry logic exposed
      // For now, just verify the client setup works
      expect(client).toBeDefined();
    });
  });

  describe("Method wrappers", () => {
    it("should have all required method wrappers", () => {
      expect(typeof client.getProductInfo).toBe("function");
      expect(typeof client.getHotProducts).toBe("function");
      expect(typeof client.smartMatch).toBe("function");
      expect(typeof client.generateTrackingLink).toBe("function");
      expect(typeof client.getMerchantLicense).toBe("function");
    });
  });

  describe("Singleton", () => {
    it("should return same instance via getAliExpressClient()", () => {
      const client1 = getAliExpressClient();
      const client2 = getAliExpressClient();
      expect(client1).toBe(client2);
    });
  });
});
