/* ============================================================
   pack.js — tiny store-only ZIP writer/reader (no dependencies)
   Used for "Download backup of everything" and the portable .polypotion
   project bundle. Store-only (no deflate) keeps it small and instant; GLBs are
   already binary so compression buys little. Includes CRC32 so the archives are
   valid ZIPs any tool can open.
   ============================================================ */
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const _enc = new TextEncoder();
const _dec = new TextDecoder();

function concat(chunks) {
  let len = 0; for (const c of chunks) len += c.length;
  const out = new Uint8Array(len); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// files: [{ name, data: Uint8Array|ArrayBuffer|string }] → Blob
export function zipStore(files) {
  const parts = []; const central = []; let offset = 0;
  const u16 = n => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  for (const f of files) {
    let data = f.data;
    if (typeof data === 'string') data = _enc.encode(data);
    else if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const name = _enc.encode(f.name); const crc = crc32(data);
    // local file header
    const lfh = [];
    lfh.push(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name);
    const lfhBytes = concat(lfh);
    parts.push(lfhBytes, data);
    // central directory record
    const cdr = [];
    cdr.push(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name);
    central.push(concat(cdr));
    offset += lfhBytes.length + data.length;
  }
  const cd = concat(central); const cdSize = cd.length; const cdOffset = offset;
  const eocd = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdOffset), u16(0)]);
  return new Blob([...parts, cd, eocd], { type: 'application/zip' });
}

// arrayBuffer → { name: Uint8Array }  (store-only reader; handles deflate=stored)
export function unzip(arrayBuffer) {
  const dv = new DataView(arrayBuffer); const u8 = new Uint8Array(arrayBuffer); const out = {};
  let i = 0;
  while (i + 4 <= u8.length) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const name = _dec.decode(u8.subarray(i + 30, i + 30 + nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    const data = u8.slice(dataStart, dataStart + compSize);
    if (method === 0) out[name] = data;   // stored
    i = dataStart + compSize;
  }
  return out;
}

export function jsonBytes(obj) { return _enc.encode(JSON.stringify(obj)); }
export function bytesJson(u8) { return JSON.parse(_dec.decode(u8)); }
