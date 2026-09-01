import fs from "fs";
import path from "path";

let cachedLogo = null;

// Reads the app icon once per server process and returns it as a base64 data
// URI so @react-pdf/renderer's <Image> can embed it without a network round trip.
export function getLogoDataUri() {
  if (cachedLogo) return cachedLogo;
  const file = fs.readFileSync(path.join(process.cwd(), "public", "icon-512.png"));
  cachedLogo = `data:image/png;base64,${file.toString("base64")}`;
  return cachedLogo;
}
