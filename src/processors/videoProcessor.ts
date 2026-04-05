import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { TMP_DIR } from "../utils/fileHelper";

const PRESETS: Record<string, { resolution: string, crf: number }> = {
  "360p": { resolution: "?x360", crf: 30 },
  "480p": { resolution: "?x480", crf: 28 },
  "720p": { resolution: "?x720", crf: 25 },
  "1080p": { resolution: "?x1080", crf: 22 },
};

export async function processVideo(
  inputPath: string, 
  quality: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const outputPath = path.join(TMP_DIR, `${uuidv4()}_processed.mp4`);
  const preset = PRESETS[quality] || PRESETS["480p"];

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      // Maintains aspect ratio and scales width to keep it even
      .size(preset.resolution)
      .outputOptions([
        `-crf ${preset.crf}`,
        "-preset fast", // balances speed and compression
        "-c:a aac",
        "-b:a 128k"
      ])
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
