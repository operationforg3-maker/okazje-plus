import crypto from 'crypto';

// Build timestamp in format yyyy-MM-dd HH:mm:ss in UTC
// AliExpress API expects timestamps in specific format
function formatTimestamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use UTC time for consistency
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Create signature for AliExpress AOP-like APIs
// Algorithm: MD5( appSecret + concat(sortedParams key+value) + appSecret )
// Returns uppercase hex string (common convention)
export function createAliSign(
  params: Record<string, string | null | undefined>,
  appSecret: string
) {
  const keys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '').sort();
  let concatenated = '';
  for (const k of keys) concatenated += `${k}${params[k]}`;
  const payload = `${appSecret}${concatenated}${appSecret}`;
  const md5 = crypto.createHash('md5').update(payload, 'utf8').digest('hex').toUpperCase();
  return md5;
}

export function buildSignedParams(userParams: Record<string, string | number | boolean>, appKey: string, appSecret: string) {
  const params: Record<string, string> = {};
  // copy user params (stringify values)
  for (const [k, v] of Object.entries(userParams)) {
    if (v === undefined || v === null) continue;
    params[k] = String(v);
  }
  // Add required AOP params
  params.app_key = appKey;
  params.timestamp = formatTimestamp();
  params.format = params.format || 'json';
  params.v = params.v || '2.0';
  // Explicitly set sign method (AliExpress AOP)
  params.sign_method = params.sign_method || 'md5';

  const sign = createAliSign(params, appSecret);
  params.sign = sign;
  return params;
}

export function toQueryString(params: Record<string, string | number | boolean>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}
