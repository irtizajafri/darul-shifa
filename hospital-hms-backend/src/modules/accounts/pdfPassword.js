const crypto = require('crypto');

// Password-locked PDFs (owner, 2026-11-24): bank statements often come locked.
// Chrome's viewer just clears the box on a wrong password — no message — so
// a password saved with a statement is checked here first: does it open
// this PDF? Standard security handler R2–R4 (RC4 / AES-128); AES-256 PDFs
// aren't checked.
// Only the check; the PDF itself is never changed.

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const md5 = (...parts) => crypto.createHash('md5').update(Buffer.concat(parts)).digest();

function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

// A PDF string token — (literal) or <hex> — as bytes.
function pdfString(tok) {
  if (!tok) return null;
  if (tok[0] === '<') return Buffer.from(tok.slice(1, -1).replace(/\s+/g, '').padEnd(2, '0'), 'hex');
  const body = tok.slice(1, -1);
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\') { out.push(body.charCodeAt(i) & 255); continue; }
    const n = body[++i];
    const map = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
    if (n in map) out.push(map[n]);
    else if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(body[i + 1])) oct += body[++i];
      out.push(parseInt(oct, 8) & 255);
    } else if (n === '\r') { if (body[i + 1] === '\n') i++; } else if (n !== '\n') out.push(n.charCodeAt(0) & 255);
  }
  return Buffer.from(out);
}
const STR = String.raw`(<[0-9A-Fa-f\s]*>|\((?:\\[\s\S]|[^\\)])*\))`;

// The /Encrypt dictionary's values, or null (not locked / can't read it).
function encryptionOf(buf) {
  const s = buf.toString('latin1');
  let dict = null;
  const ref = /\/Encrypt\s+(\d+)\s+(\d+)\s+R/.exec(s);
  if (ref) {
    const m = new RegExp(String.raw`(?:^|[\s>])${ref[1]}\s+${ref[2]}\s+obj([\s\S]*?)endobj`).exec(s);
    if (m) dict = m[1];
  } else {
    const m = /\/Encrypt\s*<<([\s\S]*?)>>/.exec(s);
    if (m) dict = m[1];
  }
  if (dict == null) return ref ? { unreadable: true } : null;
  const num = (k, d) => { const m = new RegExp(String.raw`\/${k}\s+(-?\d+)`).exec(dict); return m ? Number(m[1]) : d; };
  const str = (k) => { const m = new RegExp(String.raw`\/${k}\s*${STR}`).exec(dict); return m ? pdfString(m[1]) : null; };
  const idm = new RegExp(String.raw`\/ID\s*\[\s*${STR}`).exec(s);
  const V = num('V', 0);
  const R = num('R', 2);
  return {
    V, R,
    lengthBytes: V >= 4 ? 16 : Math.max(5, Math.min(16, num('Length', 40) / 8)),
    P: num('P', 0),
    O: str('O'),
    U: str('U'),
    id0: idm ? pdfString(idm[1]) : Buffer.alloc(0),
    encryptMetadata: !/\/EncryptMetadata\s+false/.test(dict),
    standard: /\/Filter\s*\/Standard/.test(dict),
  };
}

// R2–R4 (RC4 / AES-128)
function fileKey(pwBytes, e) {
  const p = Buffer.concat([pwBytes.subarray(0, 32), PAD]).subarray(0, 32);
  const pBytes = Buffer.alloc(4);
  pBytes.writeUInt32LE(e.P >>> 0);
  const parts = [p, e.O.subarray(0, 32), pBytes, e.id0];
  if (e.R >= 4 && !e.encryptMetadata) parts.push(Buffer.from([255, 255, 255, 255]));
  let h = md5(...parts);
  const n = e.R === 2 ? 5 : e.lengthBytes;
  if (e.R >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
  return h.subarray(0, n);
}
function userOk(pwBytes, e) {
  const key = fileKey(pwBytes, e);
  if (e.R === 2) return rc4(key, PAD).equals(e.U.subarray(0, 32));
  let x = rc4(key, md5(PAD, e.id0));
  for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x);
  return x.subarray(0, 16).equals(e.U.subarray(0, 16));
}
function ownerOk(pwBytes, e) {
  let h = md5(Buffer.concat([pwBytes.subarray(0, 32), PAD]).subarray(0, 32));
  const n = e.R === 2 ? 5 : e.lengthBytes;
  if (e.R >= 3) for (let i = 0; i < 50; i++) h = md5(h);
  const key = h.subarray(0, n);
  let user = e.O.subarray(0, 32);
  if (e.R === 2) user = rc4(key, user);
  else for (let i = 19; i >= 0; i--) user = rc4(key.map((b) => b ^ i), user);
  return userOk(user, e);
}

// { locked: false } | { locked: true, ok: true|false|null } — ok null: can't
// tell (unusual lock); the password is then kept as typed.
function checkPdfPassword(buf, password) {
  const e = encryptionOf(buf);
  if (!e) return { locked: false, ok: null };
  if (e.unreadable || !e.standard || !e.O || !e.U) return { locked: true, ok: null };
  const pw = String(password ?? '');
  try {
    // AES-256 (R5/R6) isn't checked here — the password is kept as typed.
    if (e.R >= 5) return { locked: true, ok: null };
    const bytes = Buffer.from(pw, 'latin1');
    return { locked: true, ok: userOk(bytes, e) || ownerOk(bytes, e) };
  } catch {
    return { locked: true, ok: null };
  }
}

const isLockedPdf = (buf) => !!encryptionOf(buf);

module.exports = { checkPdfPassword, isLockedPdf };
