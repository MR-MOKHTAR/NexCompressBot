import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export const TMP_DIR = path.join(process.cwd(), "tmp");

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

import { fileURLToPath } from "url";

export async function downloadFile(
  url: string,
  extension: string,
): Promise<string> {
  const filePath = path.join(TMP_DIR, `${uuidv4()}${extension}`);

  if (url.startsWith("file://")) {
    const sourcePath = fileURLToPath(url);
    fs.copyFileSync(sourcePath, filePath);
    return filePath;
  }

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

export function cleanupFiles(...files: (string | undefined)[]) {
  for (const file of files) {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error(`Error deleting file ${file}:`, err);
      }
    }
  }
}
