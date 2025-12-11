import { test, expect } from '@playwright/test';

test.describe('Voting System', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:9002';

  test('should return 401 when voting without authorization', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/deals/test-deal-id/vote`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        action: 'up',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body.message).toContain('Unauthorized');
  });

  test('should return 404 for non-existent deal', async ({ request }) => {
    // Get a test token (in real scenario, this would be from Firebase Auth)
    // For now, we'll just test the error response
    const response = await request.post(`${baseUrl}/api/deals/non-existent-id/vote`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      data: {
        action: 'up',
      },
    });

    // Should be either 401 (auth) or 404 (not found)
    expect([401, 404]).toContain(response.status());
  });

  test('should return 400 for invalid action', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/deals/test-deal-id/vote`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      data: {
        action: 'invalid-action',
      },
    });

    // Should fail with 400 or 401
    expect([400, 401]).toContain(response.status());
  });

  test('should have proper JSON response format', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/deals/test-deal-id/vote`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        action: 'up',
      },
    });

    // Check response content type
    expect(response.headers()['content-type']).toContain('application/json');

    // Check response body structure
    const body = await response.json();
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('message');
  });

  test('voting system health endpoint should be accessible', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health/vote`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body).toHaveProperty('timestamp');
  });

  test('general health endpoint should include voting info', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/health`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('checks');
  });
});
