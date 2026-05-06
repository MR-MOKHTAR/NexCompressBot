import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { writeFileSync, unlinkSync } from "fs";

export async function mergeAudios(
  inputPaths: string[],
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!inputPaths || inputPaths.length < 2) {
      return reject(
        new Error("At least 2 audio files are required for merging"),
      );
    }

    // Verify all files exist
    for (const inputPath of inputPaths) {
      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Input file does not exist: ${inputPath}`));
      }
    }

    // Create concat demuxer file
    const tmpDir = path.dirname(inputPaths[0]);
    const concatFile = path.join(tmpDir, `concat_${Date.now()}.txt`);
    const outputPath = path.join(tmpDir, `merged_${Date.now()}.mp3`);

    try {
      // Build concat file content
      const concatContent = inputPaths
        .map((filepath) => `file '${filepath.replace(/'/g, "'\\''")}'`)
        .join("\n");

      writeFileSync(concatFile, concatContent, "utf-8");

      let lastReportedPercent = 0;

      const command = ffmpeg()
        .input(concatFile)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .audioCodec("libmp3lame")
        .format("mp3")
        .outputOptions(["-q:a", "2"]) // VBR quality
        .on("start", (commandLine) => {
          console.log("FFmpeg merge started:", commandLine);
        })
        .on("progress", (progress) => {
          if (onProgress) {
            const percent = Math.min(Math.round(progress.percent || 0), 99);
            if (percent - lastReportedPercent >= 5 || percent === 99) {
              onProgress(percent);
              lastReportedPercent = percent;
            }
          }
        })
        .on("end", () => {
          if (onProgress) {
            onProgress(100);
          }
          console.log(`Audios merged successfully: ${inputPaths.length} files`);

          // Cleanup concat file
          try {
            unlinkSync(concatFile);
          } catch (err) {
            console.warn("Failed to cleanup concat file:", err);
          }

          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("Merge error:", err.message);

          // Cleanup concat file on error
          try {
            unlinkSync(concatFile);
          } catch (err) {
            console.warn("Failed to cleanup concat file:", err);
          }

          reject(err);
        });

      command.save(outputPath);
    } catch (err) {
      // Cleanup concat file if it was created
      try {
        if (fs.existsSync(concatFile)) {
          unlinkSync(concatFile);
        }
      } catch (cleanupErr) {
        console.warn("Failed to cleanup concat file:", cleanupErr);
      }
      reject(err);
    }
  });
}

export async function getAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const duration = metadata.format.duration || 0;
      resolve(Math.floor(duration));
    });
  });
}

export async function getTotalDuration(inputPaths: string[]): Promise<number> {
  try {
    let totalDuration = 0;
    for (const filepath of inputPaths) {
      const duration = await getAudioDuration(filepath);
      totalDuration += duration;
    }
    return totalDuration;
  } catch (err) {
    console.error("Error calculating total duration:", err);
    return 0;
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
