export const serviceIcons = [
  "auto",
  "haircut",
  "color",
  "wash",
  "facial",
  "nails",
  "massage",
  "brows",
] as const;
export function validServiceImage(bytes: Buffer, type: string) {
  if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024) return false;
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}
