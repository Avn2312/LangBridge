import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";

export function emitIncomingCall(socket, { receiverId, callerId, callId }) {
  socket.to(userRoom(receiverId)).emit("call:incoming", {
    callerId,
    callId,
  });
}

export function emitCallAccepted(socket, { callerId, receiverId, callId }) {
  socket.to(userRoom(callerId)).emit("call:accepted", {
    receiverId,
    callId,
  });
}

export function emitCallRejected(socket, { callerId, receiverId, callId }) {
  socket.to(userRoom(callerId)).emit("call:rejected", {
    receiverId,
    callId,
  });
}

export function emitCallEnded(socket, { receiverId, senderId, callId }) {
  socket.to(userRoom(receiverId)).emit("call:ended", {
    senderId,
    callId,
  });
}

export function emitWebrtcOffer(socket, { receiverId, senderId, callId, offer }) {
  socket.to(userRoom(receiverId)).emit("webrtc:offer", {
    senderId,
    callId,
    offer,
  });
}

export function emitWebrtcAnswer(socket, { receiverId, senderId, callId, answer }) {
  socket.to(userRoom(receiverId)).emit("webrtc:answer", {
    senderId,
    callId,
    answer,
  });
}

export function emitWebrtcIceCandidate(
  socket,
  { receiverId, senderId, callId, candidate },
) {
  socket.to(userRoom(receiverId)).emit("webrtc:ice-candidate", {
    senderId,
    callId,
    candidate,
  });
}
