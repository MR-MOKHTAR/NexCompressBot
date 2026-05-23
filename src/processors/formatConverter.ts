import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

export type AudioFormat =
  | "mp3"
  | "aac"
  | "opus"
  | "ogg"
  | "m4a"
  | "wav"
  | "flac"
  | "voice";

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
    additionalArgs: ["-q:a", "2", "-map_metadata", "0", "-id3v2_version", "3"],
  },
  aac: {
    codec: "aac",
    extension: "aac",
    container: "adts",
    additionalArgs: ["-b:a", "128k", "-map_metadata", "0"],
  },
  opus: {
    codec: "libopus",
    extension: "opus",
    container: "ogg",
    additionalArgs: ["-b:a", "96k", "-map_metadata", "0"],
  },
  ogg: {
    codec: "libvorbis",
    extension: "ogg",
    container: "ogg",
    additionalArgs: ["-q:a", "4", "-map_metadata", "0"],
  },
  m4a: {
    codec: "aac",
    extension: "m4a",
    container: "ipod",
    additionalArgs: ["-b:a", "128k", "-map_metadata", "0"],
  },
  wav: {
    codec: "pcm_s16le",
    extension: "wav",
    container: "wav",
    additionalArgs: ["-map_metadata", "0"],
  },
  flac: {
    codec: "flac",
    extension: "flac",
    container: "flac",
    additionalArgs: ["-map_metadata", "0"],
  },
  voice: {
    codec: "libopus",
    extension: "ogg",
    container: "ogg",
    // Telegram voice: mono, 48kHz, OGG Opus
    additionalArgs: ["-b:a", "64k", "-ac", "1", "-ar", "48000"],
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

export function isVoiceFormat(format: string): boolean {
  return format === "voice";
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
