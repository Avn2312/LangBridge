import { describe, expect, it, vi } from "vitest";
import {
  emitMessagesRead,
  emitNewMessage,
  emitSocketError,
  emitStopTyping,
  emitTyping,
} from "./chat.emitters.js";

const createIo = () => {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { emit, to };
};

const createSocket = () => {
  const emit = vi.fn();
  const toEmit = vi.fn();
  const to = vi.fn(() => ({ emit: toEmit }));
  return { emit, to, toEmit };
};

describe("chat emitters", () => {
  it("emits new messages to both conversation participants", () => {
    const io = createIo();
    const message = { _id: "message-1", text: "hello" };

    emitNewMessage(io, {
      receiverId: "receiver-1",
      senderId: "sender-1",
      message,
    });

    expect(io.to).toHaveBeenNthCalledWith(1, "receiver-1");
    expect(io.to).toHaveBeenNthCalledWith(2, "sender-1");
    expect(io.emit).toHaveBeenCalledTimes(2);
    expect(io.emit).toHaveBeenCalledWith("newMessage", message);
  });

  it("emits typing lifecycle events through the target room", () => {
    const socket = createSocket();

    emitTyping(socket, { receiverId: "receiver-1", senderId: "sender-1" });
    emitStopTyping(socket, {
      receiverId: "receiver-1",
      senderId: "sender-1",
    });

    expect(socket.to).toHaveBeenCalledWith("receiver-1");
    expect(socket.toEmit).toHaveBeenCalledWith("typing", {
      senderId: "sender-1",
    });
    expect(socket.toEmit).toHaveBeenCalledWith("stopTyping", {
      senderId: "sender-1",
    });
  });

  it("emits socket errors and read receipts with stable payloads", () => {
    const socket = createSocket();
    const io = createIo();
    const readAt = new Date("2026-01-01T00:00:00.000Z");

    emitSocketError(socket, { message: "Nope", code: "NOPE" });
    emitMessagesRead(io, {
      senderId: "sender-1",
      readBy: "reader-1",
      readAt,
    });

    expect(socket.emit).toHaveBeenCalledWith("error", {
      message: "Nope",
      code: "NOPE",
    });
    expect(io.to).toHaveBeenCalledWith("sender-1");
    expect(io.emit).toHaveBeenCalledWith("messagesRead", {
      readBy: "reader-1",
      readAt,
    });
  });
});
