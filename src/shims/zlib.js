// Browser stand-in for `node:zlib`, used only by just-bash's gzip/zcat
// commands in the in-browser shell runner (vite.config.js aliases it).
// Backed by fflate (MIT), a small pure-JS deflate implementation.
import { gzipSync as gz, gunzipSync as gunz } from 'fflate';

export const constants = { Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1 };
const level = (opts) => (opts?.level == null || opts.level < 0 ? 6 : opts.level);
export const gzipSync = (data, opts) => gz(data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)), { level: level(opts) });
export const gunzipSync = (data) => gunz(data);
export default { constants, gzipSync, gunzipSync };
