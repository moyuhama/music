import { AES, MD5, SHA256, Hex, Utf8, ECB, Pkcs7 } from "crypto-es";
export function resourceCrypto(operation: string, args: unknown[]): string {
  if (operation === "md5") return MD5(String(args[0])).toString();
  if (operation === "sha256") return SHA256(String(args[0])).toString();
  if (operation === "aesEcbDecrypt") {
    const key = String(args[1]);
    if (!/^(?:[\da-f]{32}|[\da-f]{48}|[\da-f]{64})$/i.test(key)) return "";
    try {
      const encoded = String(args[0]).replace(/-/g, "+").replace(/_/g, "/");
      return AES.decrypt(encoded, Hex.parse(key), { mode: ECB, padding: Pkcs7 }).toString(Utf8);
    } catch { return ""; }
  }
  throw new Error("不支持的音源加密工具");
}
