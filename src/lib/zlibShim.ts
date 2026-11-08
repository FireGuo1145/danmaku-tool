import { inflate } from 'pako';

/**
 * 浏览器端的 zlib 兼容层。
 *
 * `bilibili-ws-client` 的 ESM 构建会 `import zlib from 'zlib'`，
 * 在浏览器里并没有 Node 的 zlib，这里用 pako 实现其中用到的同步解压方法，
 * 并在 vite.config.ts 中通过 alias 替换。
 */

export function inflateSync(input: Uint8Array): Uint8Array {
  return inflate(input);
}

export function brotliDecompressSync(): Uint8Array {
  throw new Error('浏览器端暂不支持 Brotli 解压，请把 VITE_PROTOVER 设置为 1 或 2（默认 2）');
}

const zlib = { inflateSync, brotliDecompressSync };

export default zlib;
