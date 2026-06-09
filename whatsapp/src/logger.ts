import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import pino, { type Logger } from "pino";
import { env } from "./env.js";
import { isBroadcastJid } from "./jid.js";

const logsDir = dirname(env.logFile);
mkdirSync(logsDir, { recursive: true });

const fileStream = createWriteStream(env.logFile, { flags: "a" });
const personalMsgStream = createWriteStream(join(logsDir, "personal-message.log"), { flags: "a" });
const broadcastMsgStream = createWriteStream(join(logsDir, "broadcast.log"), { flags: "a" });
const groupMsgStream = createWriteStream(join(logsDir, "group-message.log"), { flags: "a" });
const othersStream = createWriteStream(join(logsDir, "others.log"), { flags: "a" });

/**
 * Shared pino logger. Writes JSON lines to `env.logFile` and mirrors to stdout
 * (pretty in dev, JSON in production). Baileys uses a quieter child at warn.
 */
function createLogger(): Logger {
  const level = env.logLevel as pino.Level;
  const streams: pino.StreamEntry[] = [{ stream: fileStream, level }];

  if (env.isDev) {
    streams.unshift({
      stream: pino.transport({ target: "pino-pretty", options: { colorize: true } }),
      level,
    });
  } else {
    streams.unshift({ stream: process.stdout, level });
  }

  return pino({ level }, pino.multistream(streams));
}

export const logger = createLogger();

export const baileysLogger = logger.child({ scope: "baileys" }, { level: "warn" });

/** Logs raw event payload to the appropriate category file for debugging. */
export function logRawEventToCategory(
  type: string,
  isGroup: boolean,
  fields: Record<string, unknown>,
): void {
  const entry = JSON.stringify({ time: Date.now(), type, ...fields }) + "\n";
  const isMessage = type === "message.inbound" || type === "message.outbound_mirror";
  const isBroadcast =
    isBroadcastJid(typeof fields.sender === "string" ? fields.sender : undefined) ||
    isBroadcastJid(typeof fields.chatId === "string" ? fields.chatId : undefined);
  if (isMessage && isGroup) {
    groupMsgStream.write(entry);
  } else if (isMessage && isBroadcast) {
    broadcastMsgStream.write(entry);
  } else if (isMessage) {
    personalMsgStream.write(entry);
  } else {
    othersStream.write(entry);
  }
}
