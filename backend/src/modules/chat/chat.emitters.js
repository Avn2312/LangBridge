export function emitSocketError(socket, payload) {
  socket.emit("error", payload);
}

import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";

export function emitNewMessage(io, { receiverId, senderId, message }) {
  io.to(userRoom(receiverId)).emit("newMessage", message);
  io.to(userRoom(senderId)).emit("newMessage", message);
}

export function emitTyping(socket, { receiverId, senderId }) {
  socket.to(userRoom(receiverId)).emit("typing", { senderId });
}

export function emitStopTyping(socket, { receiverId, senderId }) {
  socket.to(userRoom(receiverId)).emit("stopTyping", { senderId });
}

export function emitMessagesRead(io, { senderId, readBy, readAt }) {
  io.to(userRoom(senderId)).emit("messagesRead", {
    readBy,
    readAt,
  });
}
