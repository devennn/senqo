/**
 * OpenAI-style multimodal fragments for JSONB in `agent_messages`.
 * At inference, `image_url` parts are converted to AI SDK image parts for the model call.
 */
export type StoredUserTextPart = {
  type: "text";
  text: string;
};

export type StoredUserImageUrlPart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

/** Storage buckets that own media referenced from an agent transcript. */
export type MediaStorageBucket = "whatsapp-media" | "agent-assets";

/** Stable storage coordinates for an attachment; signed URLs are minted per run. */
export type StoredMediaRef = {
  bucket: MediaStorageBucket;
  path: string;
};

/**
 * Persisted attachment pointer. Signed URLs expire (~1 hour) and replayed
 * history is re-fetched on every run, so transcripts must store the storage
 * coordinates and mint a fresh URL at inference instead.
 */
export type StoredUserMediaRefPart = {
  type: "media_ref";
  media: StoredMediaRef;
};

/**
 * Inbound attachment for one agent run: the freshly signed URL (or data-URL
 * thumbnail) used by this run's model call, plus the stable reference persisted
 * with the user turn for later runs.
 */
export type InboundUserMediaPart = {
  /** Freshly signed URL for the model call. Only persisted when `storageRef` is absent. */
  url: string;
  /** Storage coordinates persisted with the user turn; absent for data-URL thumbnails. */
  storageRef?: StoredMediaRef;
};

export type StoredUserMultimodalPart =
  | StoredUserTextPart
  | StoredUserImageUrlPart
  | StoredUserMediaRefPart;
