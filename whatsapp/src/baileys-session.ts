import { rm } from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type Contact,
  type GroupMetadata,
  type WAMessageContent,
  type WASocket,
} from "baileys";
import { env } from "./env.js";
import { baileysLogger, logger } from "./logger.js";
import { buildMessageEvent } from "./events.js";
import { baileysMessageForLog } from "./log-payload.js";
import {
  clearConnectionLidState,
  learnFromContact,
  learnFromLidMapping,
  learnFromMessageKey,
  learnMapping,
  normalizeJid,
  resolveToPn,
  toSendableJid,
} from "./jid.js";
import { MessageDedupeTracker, webhookDedupeKey } from "./message-dedupe.js";
import {
  isIngestableUpsertType,
  shouldIngestBaileysMessage,
  type MessageIngestSource,
} from "./message-ingest.js";
import { clearSessionQr, getSessionQr, setSessionQr } from "./qr.js";
import { deliverEvent } from "./webhook.js";

export type SessionStatus = "authorized" | "pending_qr" | "not_authorized";

// Baileys' protocol version is fetched once and shared across sockets.
let cachedVersion: [number, number, number] | undefined;
async function getVersion(): Promise<[number, number, number] | undefined> {
  if (cachedVersion) return cachedVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    cachedVersion = version;
  } catch (error) {
    logger.warn({ error: String(error) }, "fetchLatestBaileysVersion failed; using bundled default");
  }
  return cachedVersion;
}

const GROUP_META_TTL_MS = 5 * 60 * 1000;
const SELF_SENT_TTL_MS = 5 * 60 * 1000;

/** A single WhatsApp connection: its socket, auth state, caches, and event wiring. */
export class BaileysSession {
  readonly connectionId: string;
  private readonly authDir: string;
  private sock: WASocket | null = null;
  private saveCreds: (() => Promise<void>) | null = null;
  private status: SessionStatus = "not_authorized";
  private selfJid = "";
  private phone = "";
  private starting = false;
  private stopped = false;
  private reconnectAttempts = 0;

  private readonly contactNames = new Map<string, string>();
  private readonly groupMetaCache = new Map<string, { meta: GroupMetadata; at: number }>();
  /** Message ids we sent via the API — used to suppress self outbound mirrors. */
  private readonly selfSent = new Map<string, number>();
  private readonly messageDedupe = new MessageDedupeTracker();

  constructor(connectionId: string) {
    this.connectionId = connectionId;
    this.authDir = path.join(env.sessionsDir, connectionId);
  }

  getStatus(): { status: SessionStatus; phone?: string } {
    return { status: this.status, phone: this.phone || undefined };
  }

  getQr(): string | undefined {
    return getSessionQr(this.connectionId);
  }

  /** (Re)create the socket and wire all event handlers. */
  async start(): Promise<void> {
    if (this.starting || this.sock) return;
    this.starting = true;
    this.stopped = false;
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      this.saveCreds = saveCreds;
      const version = await getVersion();
      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        logger: baileysLogger,
        printQRInTerminal: false,
        browser: Browsers.appropriate("Chrome"),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        // Refuse initial/recent history sync (~1y). syncFullHistory:false alone is not enough.
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined as WAMessageContent | undefined,
      });
      this.sock = sock;
      this.wire(sock);
    } catch (error) {
      logger.error({ connectionId: this.connectionId, error: String(error) }, "session start failed");
      this.sock = null;
    } finally {
      this.starting = false;
    }
  }

  private wire(sock: WASocket): void {
    sock.ev.on("creds.update", () => {
      void this.saveCreds?.();
    });

    sock.ev.on("connection.update", (update) => {
      void this.onConnectionUpdate(update);
    });

    sock.ev.on("contacts.upsert", (contacts) => this.onContacts(contacts));
    sock.ev.on("contacts.update", (contacts) => {
      for (const c of contacts) {
        if (c.id) learnFromContact(this.connectionId, c as Contact);
      }
    });

    sock.ev.on("lid-mapping.update", (mapping) => {
      learnFromLidMapping(this.connectionId, mapping);
      logger.debug(
        { connectionId: this.connectionId, lid: mapping.lid, pn: mapping.pn },
        "lid-mapping.update",
      );
    });

    // Contacts / LID only — do not ingest history message batches (old conversation sync).
    sock.ev.on("messaging-history.set", ({ contacts, lidPnMappings }) => {
      if (lidPnMappings?.length) {
        for (const m of lidPnMappings) learnFromLidMapping(this.connectionId, m);
      }
      if (contacts?.length) this.onContacts(contacts);
    });

    sock.ev.on("groups.update", (updates) => {
      for (const u of updates) if (u.id) this.groupMetaCache.delete(u.id);
    });
    sock.ev.on("group-participants.update", (u) => {
      if (u.id) this.groupMetaCache.delete(u.id);
    });

    sock.ev.on("messages.upsert", (upsert) => {
      if (!isIngestableUpsertType(upsert.type)) return;
      this.ingestLiveMessages(upsert.messages, upsert.type);
    });
  }

  private ingestLiveMessages(
    messages: Parameters<typeof buildMessageEvent>[1][],
    source: MessageIngestSource,
  ): void {
    for (const msg of messages) {
      if (!shouldIngestBaileysMessage(msg)) continue;
      learnFromMessageKey(this.connectionId, msg.key);
      void this.onMessage(msg, source);
    }
  }

  private onContacts(contacts: Contact[]): void {
    for (const c of contacts) {
      learnFromContact(this.connectionId, c);
      const name = c.name?.trim() || c.verifiedName?.trim() || c.notify?.trim();
      const idForName = c.phoneNumber || c.id;
      if (idForName && name) {
        const resolved = resolveToPn(this.connectionId, idForName).jid;
        this.contactNames.set(resolved, name);
      }
    }
  }

  private async getGroupMetadata(jid: string): Promise<GroupMetadata | null> {
    const cached = this.groupMetaCache.get(jid);
    if (cached && Date.now() - cached.at < GROUP_META_TTL_MS) return cached.meta;
    try {
      const meta = await this.sock!.groupMetadata(jid);
      this.groupMetaCache.set(jid, { meta, at: Date.now() });
      // Learn participant LID<->PN pairings from metadata.
      for (const p of meta.participants) {
        learnFromContact(this.connectionId, p);
      }
      return meta;
    } catch (error) {
      logger.warn({ jid, error: String(error) }, "groupMetadata failed");
      return null;
    }
  }

  private getContactName = (jid: string): string | undefined => {
    return this.contactNames.get(jid);
  };

  private async onConnectionUpdate(update: {
    connection?: string;
    lastDisconnect?: { error?: Error } | undefined;
    qr?: string;
  }): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.status = "pending_qr";
      await setSessionQr(this.connectionId, qr);
      await deliverEvent({
        type: "connection.state",
        connectionId: this.connectionId,
        state: "pending_qr",
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    if (connection === "open") {
      this.reconnectAttempts = 0;
      this.status = "authorized";
      this.selfJid = normalizeJid(this.sock?.user?.id ?? "");
      this.phone = this.selfJid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
      // Learn our own lid<->pn pairing if Baileys exposes it.
      const user = this.sock?.user;
      if (user?.lid && user.phoneNumber) {
        learnFromContact(this.connectionId, {
          id: user.id,
          lid: user.lid,
          phoneNumber: user.phoneNumber,
        });
      } else if (user?.lid) {
        learnMapping(this.connectionId, user.lid, this.selfJid);
      }
      clearSessionQr(this.connectionId);
      logger.info({ connectionId: this.connectionId, phone: this.phone }, "connection authorized");
      await deliverEvent({
        type: "connection.state",
        connectionId: this.connectionId,
        state: "authorized",
        phone: this.phone || undefined,
        deviceId: this.selfJid || undefined,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const banned = statusCode === 403;
      this.sock = null;

      if (this.stopped) {
        logger.info({ connectionId: this.connectionId }, "connection closed (stopped)");
        return;
      }

      if (loggedOut || banned) {
        logger.warn({ connectionId: this.connectionId, statusCode }, "connection deauthorized");
        this.status = "not_authorized";
        clearSessionQr(this.connectionId);
        await deliverEvent({
          type: "connection.state",
          connectionId: this.connectionId,
          state: "not_authorized",
          timestamp: Math.floor(Date.now() / 1000),
        });
        return;
      }

      // Transient close (incl. restartRequired after pairing) → reconnect.
      this.reconnectAttempts += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(this.reconnectAttempts, 5));
      logger.info(
        { connectionId: this.connectionId, statusCode, attempt: this.reconnectAttempts, delay },
        "connection closed; reconnecting",
      );
      setTimeout(() => {
        if (!this.stopped) void this.start();
      }, delay);
    }
  }

  private async onMessage(
    msg: Parameters<typeof buildMessageEvent>[1],
    source: MessageIngestSource = "notify",
  ): Promise<void> {
    const msgKey = msg.key;
    if (!msgKey?.id) return;

    const dedupeKey = webhookDedupeKey(msgKey.fromMe === true, msgKey.id);
    if (!this.messageDedupe.tryAcquire(dedupeKey)) return;

    try {
      // Suppress mirrors for messages we sent ourselves via the API.
      if (msgKey.fromMe && this.selfSent.has(msgKey.id)) {
        this.selfSent.delete(msgKey.id);
        this.messageDedupe.markDelivered(dedupeKey);
        return;
      }
      if (!this.selfJid) this.selfJid = normalizeJid(this.sock?.user?.id ?? "");
      logger.info(
        {
          connectionId: this.connectionId,
          source,
          baileysMessage: baileysMessageForLog(msg),
        },
        "baileys message received",
      );
      const event = await buildMessageEvent(
        {
          connectionId: this.connectionId,
          sock: this.sock!,
          selfJid: this.selfJid,
          getGroupMetadata: (jid) => this.getGroupMetadata(jid),
          getContactName: this.getContactName,
        },
        msg,
      );
      if (!event) {
        this.messageDedupe.markDelivered(dedupeKey);
        logger.debug(
          {
            connectionId: this.connectionId,
            source,
            messageId: msgKey.id,
            baileysMessage: baileysMessageForLog(msg),
          },
          "message not ingestable",
        );
        return;
      }
      await deliverEvent(event);
      this.messageDedupe.markDelivered(dedupeKey);
    } catch (error) {
      this.messageDedupe.release(dedupeKey);
      logger.error(
        { connectionId: this.connectionId, source, error: String(error) },
        "failed to process inbound message",
      );
    }
  }

  // ── Send API ────────────────────────────────────────────────────────────

  private requireSock(): WASocket {
    if (!this.sock) throw new Error("session socket is not connected");
    return this.sock;
  }

  private rememberSelfSent(id: string | null | undefined): void {
    if (!id) return;
    this.selfSent.set(id, Date.now());
    // opportunistic TTL sweep
    const cutoff = Date.now() - SELF_SENT_TTL_MS;
    for (const [k, at] of this.selfSent) if (at < cutoff) this.selfSent.delete(k);
  }

  async sendText(chatId: string, text: string): Promise<string> {
    const jid = toSendableJid(chatId);
    const res = await this.requireSock().sendMessage(jid, { text });
    const id = res?.key?.id ?? "";
    this.rememberSelfSent(id);
    return id;
  }

  async sendMedia(args: {
    chatId: string;
    fileName: string;
    mimeType: string;
    data: Buffer;
    caption?: string;
  }): Promise<string> {
    const jid = toSendableJid(args.chatId);
    const mt = args.mimeType.toLowerCase();
    let content: Parameters<WASocket["sendMessage"]>[1];
    if (mt.startsWith("image/")) {
      content = { image: args.data, mimetype: args.mimeType, caption: args.caption };
    } else if (mt.startsWith("video/")) {
      content = { video: args.data, mimetype: args.mimeType, caption: args.caption };
    } else if (mt.startsWith("audio/")) {
      // Render as a voice note only for opus/ogg/amr; other audio (mp3, m4a) plays
      // as a regular audio attachment instead of a (likely broken) voice note.
      const ptt = /ogg|opus|amr/.test(mt);
      content = { audio: args.data, mimetype: args.mimeType, ptt };
    } else {
      content = {
        document: args.data,
        mimetype: args.mimeType || "application/octet-stream",
        fileName: args.fileName,
        caption: args.caption,
      };
    }
    const res = await this.requireSock().sendMessage(jid, content);
    const id = res?.key?.id ?? "";
    this.rememberSelfSent(id);
    return id;
  }

  async sendPresence(chatId: string, presence: "composing" | "recording"): Promise<void> {
    const jid = toSendableJid(chatId);
    const sock = this.requireSock();
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate(presence, jid);
  }

  /**
   * Step 5 — ask the user to share their phone number (WhatsApp protocol message).
   * Use sparingly when LID cannot be resolved and the contact is important.
   */
  async requestContactPhoneNumber(chatId: string): Promise<string> {
    const jid = toSendableJid(chatId);
    const res = await this.requireSock().sendMessage(jid, { requestPhoneNumber: true });
    const id = res?.key?.id ?? "";
    this.rememberSelfSent(id);
    return id;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    this.stopped = false;
    try {
      this.sock?.end(new Error("restart requested"));
    } catch {
      /* ignore */
    }
    this.sock = null;
    await this.start();
  }

  /** Log out (revoke credentials) but keep the session object. */
  async logout(): Promise<void> {
    this.stopped = true;
    try {
      await this.sock?.logout();
    } catch (error) {
      logger.warn({ connectionId: this.connectionId, error: String(error) }, "logout error (ignored)");
    }
    try {
      this.sock?.end(undefined);
    } catch {
      /* ignore */
    }
    this.sock = null;
    this.status = "not_authorized";
    clearSessionQr(this.connectionId);
  }

  /** Stop the socket without logging out (used on shutdown). */
  stop(): void {
    this.stopped = true;
    try {
      this.sock?.end(undefined);
    } catch {
      /* ignore */
    }
    this.sock = null;
  }

  /** Logout and delete all on-disk auth state. */
  async destroy(): Promise<void> {
    await this.logout();
    clearConnectionLidState(this.connectionId);
    try {
      await rm(this.authDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn({ connectionId: this.connectionId, error: String(error) }, "auth dir cleanup failed");
    }
  }
}
