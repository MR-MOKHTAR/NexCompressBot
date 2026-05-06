import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

export async function trimAudio(
  inputPath: string,
  startSeconds: number,
  endSeconds: number,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file does not exist: ${inputPath}`));
    }

    if (startSeconds < 0 || endSeconds <= startSeconds) {
      return reject(
        new Error(
          "Invalid trim range: start must be >= 0 and end must be > start",
        ),
      );
    }

    const outputPath = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}_trimmed.mp3`,
    );

    let lastReportedPercent = 0;
    let totalDuration = 0;

    const command = ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .duration(endSeconds - startSeconds)
      .audioCodec("libmp3lame")
      .format("mp3")
      .on("start", (commandLine) => {
        console.log("FFmpeg trim started:", commandLine);
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
        console.log(
          `Audio trimmed successfully: ${startSeconds}s to ${endSeconds}s`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("Trim error:", err.message);
        reject(err);
      });

    command.save(outputPath);
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

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function parseSingleTime(input: string): number | null {
  const cleanInput = input.trim();

  // Format: HH:MM:SS or MM:SS or M:SS
  const timeRegex = /^(?:(\d+):)?(?:(\d+):)?(\d+)$/;
  const match = cleanInput.match(timeRegex);

  if (match) {
    const hours = match[1] && match[2] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : match[1] ? parseInt(match[1], 10) : 0;
    const seconds = parseInt(match[3], 10);

    // If only one colon is present, it's MM:SS.
    // If two colons, it's HH:MM:SS.
    // If no colons, it's SS.

    const parts = cleanInput.split(":");
    if (parts.length === 3) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } else if (parts.length === 1) {
      return parseInt(parts[0], 10);
    }
  }

  return null;
}

export function parseTimeInput(input: string): [number, number] | null {
  // Support old format for backward compatibility: "MM:SS-MM:SS"
  const parts = input.split("-");
  if (parts.length === 2) {
    const start = parseSingleTime(parts[0]);
    const end = parseSingleTime(parts[1]);

    if (start !== null && end !== null && end > start) {
      return [start, end];
    }
  }

  return null;
}
