import { uploadBuffer } from "./media.storage.js";

const getAttachmentType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

const getCloudinaryResourceType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return "video";
  }
  return "raw";
};

export async function uploadChatAttachment(file) {
  if (!file) {
    const error = new Error("No file provided.");
    error.statusCode = 400;
    error.code = "NO_ATTACHMENT_FILE";
    throw error;
  }

  const attachmentType = getAttachmentType(file.mimetype);
  const resourceType = getCloudinaryResourceType(file.mimetype);
  const result = await uploadBuffer(file.buffer, {
    resource_type: resourceType,
    folder:
      attachmentType === "audio"
        ? "langbridge/voice-notes"
        : "langbridge/chat-attachments",
  });

  return {
    url: result.secure_url,
    type: attachmentType,
    filename: file.originalname || "",
    size: file.size || result.bytes || 0,
  };
}
