/**
 * 极简 protobuf 解码器。
 *
 * B 站直播的新版事件（SEND_GIFT_V2 / INTERACT_WORD_V2 等）把内容放在 protobuf 的
 * `pb` 字段里，这里实现一个通用解码器：按字段编号聚合，长度分隔字段会先尝试按
 * UTF-8 文本解析，失败时递归当作嵌套消息处理。
 */

export type PBValue = number | string | PBMessage | Uint8Array;

export interface PBMessage {
  [field: number]: PBValue[];
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

function tryDecodeText(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return '';
  try {
    const text = utf8.decode(bytes);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return null;
    }
    return text;
  } catch {
    return null;
  }
}

function readVarint(bytes: Uint8Array, start: number): [bigint, number] | null {
  let result = 0n;
  let shift = 0n;
  let index = start;
  while (index < bytes.length) {
    const byte = bytes[index];
    index += 1;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result, index];
    shift += 7n;
    if (shift > 70n) return null;
  }
  return null;
}

export function decodeProtobuf(bytes: Uint8Array): PBMessage {
  const message: PBMessage = {};
  let index = 0;

  while (index < bytes.length) {
    const keyRead = readVarint(bytes, index);
    if (!keyRead) break;
    const [key, next] = keyRead;
    index = next;

    const wireType = Number(key & 0x07n);
    const field = Number(key >> 0x03n);
    if (field <= 0) break;

    let value: PBValue | null = null;

    switch (wireType) {
      case 0: {
        const read = readVarint(bytes, index);
        if (!read) return message;
        const [raw, after] = read;
        index = after;
        value = raw <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(raw) : raw.toString();
        break;
      }
      case 1: {
        if (index + 8 > bytes.length) return message;
        value = bytes.slice(index, index + 8);
        index += 8;
        break;
      }
      case 2: {
        const read = readVarint(bytes, index);
        if (!read) return message;
        const [length, after] = read;
        index = after;
        const end = index + Number(length);
        if (end > bytes.length) return message;
        const chunk = bytes.slice(index, end);
        index = end;
        const text = tryDecodeText(chunk);
        value = text !== null ? text : decodeProtobuf(chunk);
        break;
      }
      case 5: {
        if (index + 4 > bytes.length) return message;
        value = bytes.slice(index, index + 4);
        index += 4;
        break;
      }
      default:
        return message;
    }

    if (value !== null) {
      (message[field] ??= []).push(value);
    }
  }

  return message;
}

export function pbString(message: PBMessage | undefined, field: number, index = 0): string {
  const value = message?.[field]?.[index];
  return typeof value === 'string' ? value : '';
}

export function pbNumber(message: PBMessage | undefined, field: number, index = 0): number {
  const value = message?.[field]?.[index];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function pbMessage(message: PBMessage | undefined, field: number, index = 0): PBMessage | undefined {
  const value = message?.[field]?.[index];
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) return undefined;
  return value;
}

export function fromBase64(input: string): Uint8Array {
  if (!input) return new Uint8Array();
  try {
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return new Uint8Array();
  }
}
