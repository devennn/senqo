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

export type StoredUserMultimodalPart = StoredUserTextPart | StoredUserImageUrlPart;
