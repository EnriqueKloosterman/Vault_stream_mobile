export type SrtCue = {
  start: number;
  end: number;
  text: string;
};

const WINDOWS_1252_OVERRIDES: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

function decodeUtf8Strict(bytes: Uint8Array): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
      continue;
    }
    let codePoint: number;
    let size: number;
    if ((b0 & 0xe0) === 0xc0) {
      codePoint = b0 & 0x1f;
      size = 2;
    } else if ((b0 & 0xf0) === 0xe0) {
      codePoint = b0 & 0x0f;
      size = 3;
    } else if ((b0 & 0xf8) === 0xf0) {
      codePoint = b0 & 0x07;
      size = 4;
    } else {
      return null;
    }
    if (i + size > bytes.length) {
      return null;
    }
    for (let k = 1; k < size; k += 1) {
      const bk = bytes[i + k];
      if ((bk & 0xc0) !== 0x80) {
        return null;
      }
      codePoint = (codePoint << 6) | (bk & 0x3f);
    }
    if (size === 2 && codePoint < 0x80) return null;
    if (size === 3 && codePoint < 0x800) return null;
    if (size === 4 && (codePoint < 0x10000 || codePoint > 0x10ffff)) return null;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return null;
    out += String.fromCodePoint(codePoint);
    i += size;
  }
  return out;
}

function decodeWindows1252(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    if (byte >= 0x80 && byte <= 0x9f && WINDOWS_1252_OVERRIDES[byte] !== undefined) {
      out += String.fromCodePoint(WINDOWS_1252_OVERRIDES[byte]);
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

export function decodeSubtitleBytes(bytes: Uint8Array): string {
  let data = bytes;
  const hasBom =
    data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf;
  if (hasBom) {
    data = data.subarray(3);
    const decoded = decodeUtf8Strict(data);
    if (decoded !== null) {
      return decoded;
    }
    return decodeWindows1252(data);
  }
  const decoded = decodeUtf8Strict(data);
  if (decoded !== null) {
    return decoded;
  }
  return decodeWindows1252(data);
}

function parseTimestamp(hours: string, minutes: string, seconds: string, millis: string): number {
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis.padEnd(3, '0').slice(0, 3)) / 1000
  );
}

export function parseSrt(raw: string): SrtCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) {
      continue;
    }
    const match = lines[timingIndex].match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/,
    );
    if (!match) {
      continue;
    }
    const start = parseTimestamp(match[1], match[2], match[3], match[4]);
    const end = parseTimestamp(match[5], match[6], match[7], match[8]);
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!text) {
      continue;
    }
    cues.push({ start, end, text });
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

export function findCueAt(cues: SrtCue[], time: number): SrtCue | null {
  let low = 0;
  let high = cues.length - 1;
  let answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (answer === -1) {
    return null;
  }
  const cue = cues[answer];
  return time <= cue.end ? cue : null;
}
