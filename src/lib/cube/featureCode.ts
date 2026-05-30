import { FACE_ORDER, type FaceLetter } from './types';

const PREFIX = 'SC1';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const FACELET_COUNT = 54;
const BITS_PER_FACELET = 3;
const PACKED_BYTE_COUNT = Math.ceil((FACELET_COUNT * BITS_PER_FACELET) / 8);
const PAYLOAD_BYTE_COUNT = PACKED_BYTE_COUNT + 1;
const BODY_CHAR_COUNT = Math.ceil((PAYLOAD_BYTE_COUNT * 8) / 5);

const FACE_TO_VALUE: Record<FaceLetter, number> = {
  U: 0,
  R: 1,
  F: 2,
  D: 3,
  L: 4,
  B: 5,
};

const VALUE_TO_FACE = FACE_ORDER;

const BASE32_VALUE = new Map([...BASE32].map((ch, i) => [ch, i]));

export function encodeFeatureCode(facelets: string): string {
  const packed = packFacelets(facelets);
  const payload = new Uint8Array(PAYLOAD_BYTE_COUNT);
  payload.set(packed);
  payload[PACKED_BYTE_COUNT] = crc8(packed);
  return `${PREFIX}-${group(base32Encode(payload), 5)}`;
}

export function decodeFeatureCode(code: string): string {
  const compact = code.replace(/[\s-]+/g, '').toUpperCase();
  if (!compact.startsWith(PREFIX)) {
    throw new Error('Feature code must start with SC1.');
  }

  const body = compact.slice(PREFIX.length);
  if (body.length !== BODY_CHAR_COUNT) {
    throw new Error(`Feature code body must be ${BODY_CHAR_COUNT} characters.`);
  }

  const payload = base32Decode(body);
  if (payload.length !== PAYLOAD_BYTE_COUNT) {
    throw new Error('Feature code payload has the wrong length.');
  }

  const packed = payload.slice(0, PACKED_BYTE_COUNT);
  const expectedChecksum = crc8(packed);
  if (payload[PACKED_BYTE_COUNT] !== expectedChecksum) {
    throw new Error('Feature code checksum mismatch.');
  }

  return unpackFacelets(packed);
}

function packFacelets(facelets: string): Uint8Array {
  if (facelets.length !== FACELET_COUNT) {
    throw new Error(`Feature code facelets must be ${FACELET_COUNT} characters.`);
  }

  const bytes = new Uint8Array(PACKED_BYTE_COUNT);
  let bitOffset = 0;
  for (const ch of facelets) {
    const value = FACE_TO_VALUE[ch as FaceLetter];
    if (value === undefined) {
      throw new Error(`Invalid facelet color "${ch}".`);
    }

    for (let bit = BITS_PER_FACELET - 1; bit >= 0; bit--) {
      if ((value & (1 << bit)) !== 0) {
        const byteIndex = Math.floor(bitOffset / 8);
        bytes[byteIndex] |= 1 << (7 - (bitOffset % 8));
      }
      bitOffset++;
    }
  }
  return bytes;
}

function unpackFacelets(bytes: Uint8Array): string {
  let bitOffset = 0;
  let out = '';
  for (let i = 0; i < FACELET_COUNT; i++) {
    let value = 0;
    for (let bit = 0; bit < BITS_PER_FACELET; bit++) {
      const byteIndex = Math.floor(bitOffset / 8);
      const bitValue = (bytes[byteIndex] >> (7 - (bitOffset % 8))) & 1;
      value = (value << 1) | bitValue;
      bitOffset++;
    }

    const face = VALUE_TO_FACE[value];
    if (!face) {
      throw new Error('Feature code contains an invalid sticker value.');
    }
    out += face;
  }
  return out;
}

function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }

    buffer &= bits === 0 ? 0 : (1 << bits) - 1;
  }

  if (bits > 0) {
    out += BASE32[(buffer << (5 - bits)) & 31];
  }

  return out;
}

function base32Decode(body: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const ch of body) {
    const value = BASE32_VALUE.get(ch);
    if (value === undefined) {
      throw new Error(`Invalid feature code character "${ch}".`);
    }

    buffer = (buffer << 5) | value;
    bits += 5;

    while (bits >= 8) {
      out.push((buffer >> (bits - 8)) & 255);
      bits -= 8;
    }

    buffer &= bits === 0 ? 0 : (1 << bits) - 1;
  }

  if (bits > 0 && buffer !== 0) {
    throw new Error('Feature code has invalid padding.');
  }

  return new Uint8Array(out);
}

function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function group(value: string, size: number): string {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    parts.push(value.slice(i, i + size));
  }
  return parts.join('-');
}
