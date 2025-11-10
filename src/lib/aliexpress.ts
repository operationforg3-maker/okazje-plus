import crypto from 'crypto';

// Build timestamp in format yyyy-MM-dd HH:mm:ss expected by many AOP implementations
function formatTimestamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Create signature for AliExpress AOP-like APIs
// Algorithm: MD5( appSecret + concat(sortedParams key+value) + appSecret )
// Returns uppercase hex string (common convention)
export function createAliSign(params: Record<string, string>, appSecret: string) {
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

  const sign = createAliSign(params, appSecret);
  params.sign = sign;
  return params;
}

export function toQueryString(params: Record<string, string | number | boolean>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}
