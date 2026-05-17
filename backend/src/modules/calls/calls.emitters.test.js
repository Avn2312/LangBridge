import { describe, expect, it, vi } from "vitest";
import {
  emitCallAccepted,
  emitCallEnded,
  emitCallRejected,
  emitIncomingCall,
  emitWebrtcAnswer,
  emitWebrtcIceCandidate,
  emitWebrtcOffer,
} from "./calls.emitters.js";

const createSocket = () => {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { emit, to };
};

describe("call emitters", () => {
  it("emits call lifecycle events with stable names and payloads", () => {
    const socket = createSocket();

    emitIncomingCall(socket, {
      receiverId: "receiver-1",
      callerId: "caller-1",
      callId: "call-1",
    });
    emitCallAccepted(socket, {
      callerId: "caller-1",
      receiverId: "receiver-1",
      callId: "call-1",
    });
    emitCallRejected(socket, {
      callerId: "caller-1",
      receiverId: "receiver-1",
      callId: "call-1",
    });
    emitCallEnded(socket, {
      receiverId: "receiver-1",
      senderId: "sender-1",
      callId: "call-1",
    });

    expect(socket.emit).toHaveBeenCalledWith("call:incoming", {
      callerId: "caller-1",
      callId: "call-1",
    });
    expect(socket.emit).toHaveBeenCalledWith("call:accepted", {
      receiverId: "receiver-1",
      callId: "call-1",
    });
    expect(socket.emit).toHaveBeenCalledWith("call:rejected", {
      receiverId: "receiver-1",
      callId: "call-1",
    });
    expect(socket.emit).toHaveBeenCalledWith("call:ended", {
      senderId: "sender-1",
      callId: "call-1",
    });
  });

  it("emits WebRTC signaling events with stable names and payloads", () => {
    const socket = createSocket();

    emitWebrtcOffer(socket, {
      receiverId: "receiver-1",
      senderId: "sender-1",
      callId: "call-1",
      offer: { type: "offer" },
    });
    emitWebrtcAnswer(socket, {
      receiverId: "receiver-1",
      senderId: "sender-1",
      callId: "call-1",
      answer: { type: "answer" },
    });
    emitWebrtcIceCandidate(socket, {
      receiverId: "receiver-1",
      senderId: "sender-1",
      callId: "call-1",
      candidate: { candidate: "candidate" },
    });

    expect(socket.emit).toHaveBeenCalledWith("webrtc:offer", {
      senderId: "sender-1",
      callId: "call-1",
      offer: { type: "offer" },
    });
    expect(socket.emit).toHaveBeenCalledWith("webrtc:answer", {
      senderId: "sender-1",
      callId: "call-1",
      answer: { type: "answer" },
    });
    expect(socket.emit).toHaveBeenCalledWith("webrtc:ice-candidate", {
      senderId: "sender-1",
      callId: "call-1",
      candidate: { candidate: "candidate" },
    });
  });
});
