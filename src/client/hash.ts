// why: crypto.subtle exists only in secure contexts, and http://shop-a.test from /etc/hosts is not one.
// A non-cryptographic 53-bit hash (cyrb53) is enough to shorten large values such as canvas pixels.
export const hashString = (input: string, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
};

export const hashBytes = (bytes: Uint8Array | Uint8ClampedArray): string => hashString(bytes.join(','));
