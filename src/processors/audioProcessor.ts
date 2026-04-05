import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { TMP_DIR } from "../utils/fileHelper";

export async function processAudio(
  inputPath: string,
  quality: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const outputPath = path.join(TMP_DIR, `${uuidv4()}_processed.mp3`);
  
  // quality here comes from callback: e.g. "128k", "64k", "48k", "24k"
  const bitrate = quality;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate(bitrate)
      .on("progress", (progress) => {
        if (progress.percent && onProgress) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
