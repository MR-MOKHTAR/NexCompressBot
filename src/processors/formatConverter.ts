import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

type AudioFormat =
  | "mp3"
  | "aac"
  | "opus"
  | "ogg"
  | "m4a"
  | "mp4"
  | "wma"
  | "amr"
  | "3gp";

interface FormatConfig {
  codec: string;
  extension: string;
  container: string;
  additionalArgs?: string[];
}

const formatConfigs: Record<AudioFormat, FormatConfig> = {
  mp3: {
    codec: "libmp3lame",
    extension: "mp3",
    container: "mp3",
    additionalArgs: ["-q:a", "2"], // VBR quality (2=high)
  },
  aac: {
    codec: "aac",
    extension: "aac",
    container: "aac",
    additionalArgs: ["-b:a", "192k"],
  },
  opus: {
    codec: "libopus",
    extension: "opus",
    container: "ogg",
    additionalArgs: ["-b:a", "128k"],
  },
  ogg: {
    codec: "libvorbis",
    extension: "ogg",
    container: "ogg",
    additionalArgs: ["-q:a", "6"], // VBR quality
  },
  m4a: {
    codec: "aac",
    extension: "m4a",
    container: "ipod",
    additionalArgs: ["-b:a", "192k"],
  },
  mp4: {
    codec: "aac",
    extension: "mp4",
    container: "mp4",
    additionalArgs: ["-b:a", "192k"],
  },
  wma: {
    codec: "wmav2",
    extension: "wma",
    container: "asf",
    additionalArgs: ["-b:a", "192k"],
  },
  amr: {
    codec: "libopencore_amrnb",
    extension: "amr",
    container: "amr",
    additionalArgs: ["-ar", "8000", "-b:a", "12.2k"],
  },
  "3gp": {
    codec: "aac",
    extension: "3gp",
    container: "3gp",
    additionalArgs: ["-b:a", "64k"],
  },
};

export async function convertAudio(
  inputPath: string,
  targetFormat: AudioFormat,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const config = formatConfigs[targetFormat];
    if (!config) {
      return reject(new Error(`Unsupported format: ${targetFormat}`));
    }

    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file does not exist: ${inputPath}`));
    }

    const outputPath = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}_converted.${config.extension}`,
    );

    let lastReportedPercent = 0;

    const command = ffmpeg(inputPath)
      .audioCodec(config.codec)
      .format(config.container)
      .on("start", (commandLine) => {
        console.log("FFmpeg conversion started:", commandLine);
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
        console.log(`Audio converted successfully to ${targetFormat}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("Conversion error:", err.message);
        reject(err);
      });

    // Apply format-specific arguments
    if (config.additionalArgs) {
      command.outputOptions(config.additionalArgs);
    }

    command.save(outputPath);
  });
}

export function isSupportedFormat(format: string): boolean {
  return Object.keys(formatConfigs).includes(format.toLowerCase());
}

export function getSupportedFormats(): AudioFormat[] {
  return Object.keys(formatConfigs) as AudioFormat[];
}

export function getFormatInfo(format: AudioFormat): FormatConfig {
  return formatConfigs[format];
}
