import {
  emitCallAccepted,
  emitCallEnded,
  emitCallRejected,
  emitIncomingCall,
  emitWebrtcAnswer,
  emitWebrtcIceCandidate,
  emitWebrtcOffer,
} from "./calls.emitters.js";

export function registerCallSocketHandlers({ socket, userId }) {
  socket.on("call:invite", ({ receiverId, callId } = {}) => {
    if (!receiverId || !callId) return;

    emitIncomingCall(socket, {
      receiverId,
      callerId: userId,
      callId,
    });
  });

  socket.on("call:accept", ({ callerId, callId } = {}) => {
    if (!callerId || !callId) return;

    emitCallAccepted(socket, {
      callerId,
      receiverId: userId,
      callId,
    });
  });

  socket.on("call:reject", ({ callerId, callId } = {}) => {
    if (!callerId || !callId) return;

    emitCallRejected(socket, {
      callerId,
      receiverId: userId,
      callId,
    });
  });

  socket.on("call:end", ({ receiverId, callId } = {}) => {
    if (!receiverId || !callId) return;

    emitCallEnded(socket, {
      receiverId,
      senderId: userId,
      callId,
    });
  });

  socket.on("webrtc:offer", ({ receiverId, callId, offer } = {}) => {
    if (!receiverId || !callId || !offer) return;

    emitWebrtcOffer(socket, {
      receiverId,
      senderId: userId,
      callId,
      offer,
    });
  });

  socket.on("webrtc:answer", ({ receiverId, callId, answer } = {}) => {
    if (!receiverId || !callId || !answer) return;

    emitWebrtcAnswer(socket, {
      receiverId,
      senderId: userId,
      callId,
      answer,
    });
  });

  socket.on(
    "webrtc:ice-candidate",
    ({ receiverId, callId, candidate } = {}) => {
      if (!receiverId || !callId || !candidate) return;

      emitWebrtcIceCandidate(socket, {
        receiverId,
        senderId: userId,
        callId,
        candidate,
      });
    },
  );
}
