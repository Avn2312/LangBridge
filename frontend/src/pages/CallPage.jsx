import {
  Camera,
  CameraOff,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useSocketStore } from "../store/socketStore.js";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const callCopy = {
  starting: "Starting camera and microphone...",
  ready: "Preparing call...",
  calling: "Ringing...",
  connecting: "Connecting secure video...",
  connected: "Connected",
  ended: "Call ended",
  failed: "Call failed",
  rejected: "Call declined",
};

const CallPage = () => {
  const [callState, setCallState] = useState("starting");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const queuedIceCandidatesRef = useRef([]);
  const hasEndedRef = useRef(false);
  const inviteSentRef = useRef(false);
  const callAcceptedRef = useRef(false);
  const offerSentRef = useRef(false);

  const { id: otherUserId } = useParams();
  const location = useLocation();
  const socket = useSocketStore((s) => s.socket);

  const searchParams = new URLSearchParams(location.search);
  const isCaller = searchParams.get("start") === "1";
  const incomingCallId = searchParams.get("callId");

  const [callId] = useState(() => incomingCallId || crypto.randomUUID());

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const statusText = useMemo(() => {
    if (error) return error;
    return callCopy[callState] || "In call";
  }, [callState, error]);

  const emitToPeer = useCallback(
    (eventName, payload = {}) => {
      if (!socketRef.current || !otherUserId || !callId) return false;

      socketRef.current.emit(eventName, {
        receiverId: otherUserId,
        callId,
        ...payload,
      });

      return true;
    },
    [callId, otherUserId],
  );

  const stopStream = useCallback((stream) => {
    stream?.getTracks?.().forEach((track) => {
      track.stop();
    });
  }, []);

  const cleanupCall = useCallback(() => {
    hasEndedRef.current = true;

    stopStream(localStreamRef.current);
    localStreamRef.current = null;

    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    peerRef.current?.getSenders?.().forEach((sender) => {
      sender.track?.stop();
    });
    peerRef.current?.close();
    peerRef.current = null;

    queuedIceCandidatesRef.current = [];

    [localVideoRef.current, remoteVideoRef.current].forEach((videoElement) => {
      if (!videoElement) return;

      videoElement.pause();
      videoElement.srcObject = null;
      videoElement.load();
    });

    setHasRemoteVideo(false);
  }, [stopStream]);

  const flushQueuedIceCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;

    const candidates = queuedIceCandidatesRef.current;
    queuedIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add queued ICE candidate:", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerRef.current) return peerRef.current;

    const stream = localStreamRef.current;
    if (!stream) return null;

    const peer = new RTCPeerConnection(rtcConfig);

    peer.onicecandidate = (event) => {
      if (!event.candidate || hasEndedRef.current) return;

      emitToPeer("webrtc:ice-candidate", {
        candidate: event.candidate,
      });
    };

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      remoteStreamRef.current = remoteStream;
      setHasRemoteVideo(
        remoteStream.getVideoTracks().some((track) => track.enabled),
      );

      remoteStream.getVideoTracks().forEach((track) => {
        track.onmute = () => setHasRemoteVideo(false);
        track.onunmute = () => setHasRemoteVideo(true);
        track.onended = () => setHasRemoteVideo(false);
      });

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      setCallState("connected");
    };

    peer.onconnectionstatechange = () => {
      if (hasEndedRef.current) return;

      if (peer.connectionState === "connected") {
        setCallState("connected");
      } else if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        setCallState("failed");
        setError("The connection was interrupted.");
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (hasEndedRef.current) return;

      if (peer.iceConnectionState === "failed") {
        setCallState("failed");
        setError("Unable to establish a media connection.");
      }
    };

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peerRef.current = peer;
    return peer;
  }, [emitToPeer]);

  const sendOffer = useCallback(async () => {
    const peer = createPeerConnection();
    if (!peer || offerSentRef.current || hasEndedRef.current) return;

    try {
      setCallState("connecting");
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peer.setLocalDescription(offer);
      offerSentRef.current = true;

      emitToPeer("webrtc:offer", {
        offer: peer.localDescription,
      });
    } catch (err) {
      console.error("Failed to create WebRTC offer:", err);
      setCallState("failed");
      setError("Unable to start the video connection.");
    }
  }, [createPeerConnection, emitToPeer]);

  const handleOffer = useCallback(
    async ({ callId: eventCallId, offer }) => {
      if (eventCallId !== callId || !offer || hasEndedRef.current) return;

      const peer = createPeerConnection();
      if (!peer) return;

      try {
        setCallState("connecting");
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await flushQueuedIceCandidates();

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        emitToPeer("webrtc:answer", {
          answer: peer.localDescription,
        });
      } catch (err) {
        console.error("Failed to answer WebRTC offer:", err);
        setCallState("failed");
        setError("Unable to answer the video connection.");
      }
    },
    [callId, createPeerConnection, emitToPeer, flushQueuedIceCandidates],
  );

  const handleAnswer = useCallback(
    async ({ callId: eventCallId, answer }) => {
      const peer = peerRef.current;
      if (eventCallId !== callId || !answer || !peer || hasEndedRef.current) {
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        await flushQueuedIceCandidates();
        setCallState("connecting");
      } catch (err) {
        console.error("Failed to apply WebRTC answer:", err);
        setCallState("failed");
        setError("Unable to complete the video connection.");
      }
    },
    [callId, flushQueuedIceCandidates],
  );

  const handleIceCandidate = useCallback(
    async ({ callId: eventCallId, candidate }) => {
      if (eventCallId !== callId || !candidate || hasEndedRef.current) return;

      const iceCandidate = new RTCIceCandidate(candidate);
      const peer = peerRef.current;

      if (!peer?.remoteDescription) {
        queuedIceCandidatesRef.current.push(iceCandidate);
        return;
      }

      try {
        await peer.addIceCandidate(iceCandidate);
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    },
    [callId],
  );

  const leaveCall = useCallback(
    (nextState = "ended") => {
      setCallState(nextState);
      cleanupCall();
      navigate(`/chat/${otherUserId}`, { replace: true });
    },
    [cleanupCall, navigate, otherUserId],
  );

  const endCall = useCallback(() => {
    if (!hasEndedRef.current) {
      emitToPeer("call:end");
    }

    leaveCall("ended");
  }, [emitToPeer, leaveCall]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextCameraOff = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  }, [isCameraOff]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleAccepted = ({ callId: acceptedCallId }) => {
      if (acceptedCallId !== callId || !isCaller || hasEndedRef.current) return;
      callAcceptedRef.current = true;
      sendOffer();
    };

    const handleRejected = ({ callId: rejectedCallId }) => {
      if (rejectedCallId !== callId) return;

      setError("The call was declined.");
      leaveCall("rejected");
    };

    const handleCallEnded = ({ callId: endedCallId }) => {
      if (endedCallId !== callId) return;
      leaveCall("ended");
    };

    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleCallEnded);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleCallEnded);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
    };
  }, [
    callId,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    isCaller,
    leaveCall,
    sendOffer,
    socket,
  ]);

  useEffect(() => {
    let isActive = true;
    hasEndedRef.current = false;

    const startLocalMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCallState("failed");
        setError("This browser does not support camera and microphone access.");
        return;
      }

      try {
        setCallState("starting");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!isActive || hasEndedRef.current) {
          stopStream(stream);
          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        createPeerConnection();
        setCallState("ready");
      } catch (err) {
        console.error("Failed to access camera/microphone:", err);
        setCallState("failed");
        setError(
          "Unable to access camera and microphone. Please check permissions.",
        );
      }
    };

    startLocalMedia();

    return () => {
      isActive = false;
      cleanupCall();
    };
  }, [cleanupCall, createPeerConnection, stopStream]);

  useEffect(() => {
    if (
      !isCaller ||
      !socket ||
      !otherUserId ||
      !localStreamRef.current ||
      inviteSentRef.current ||
      hasEndedRef.current
    ) {
      return;
    }

    inviteSentRef.current = true;
    socket.emit("call:invite", {
      receiverId: otherUserId,
      callId,
    });
    setCallState("calling");
  }, [callId, callState, isCaller, otherUserId, socket]);

  useEffect(() => {
    if (
      !isCaller ||
      !callAcceptedRef.current ||
      !localStreamRef.current ||
      offerSentRef.current ||
      hasEndedRef.current
    ) {
      return;
    }

    sendOffer();
  }, [callState, isCaller, sendOffer]);

  useEffect(() => {
    if (callState !== "calling") return undefined;

    const timeoutId = window.setTimeout(() => {
      if (callAcceptedRef.current || hasEndedRef.current) return;

      emitToPeer("call:end");
      leaveCall("ended");
    }, 60000);

    return () => window.clearTimeout(timeoutId);
  }, [callState, emitToPeer, leaveCall]);

  useEffect(() => {
    if (!socket) {
      setError("Connecting to the call service...");
      return;
    }

    setError("");
  }, [socket]);

  const remotePlaceholder = callState !== "connected" || !hasRemoteVideo;
  const showSpinner = ["starting", "ready", "calling", "connecting"].includes(
    callState,
  );

  return (
    <main className="min-h-screen bg-[#070B12] text-white">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200/70">
              LangBridge Video
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-300">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  callState === "connected"
                    ? "bg-emerald-400"
                    : callState === "failed"
                      ? "bg-red-400"
                      : "bg-amber-300"
                }`}
              />
              <span className="truncate">{statusText}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={endCall}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
            title="End call"
            aria-label="End call"
          >
            <PhoneOff className="size-5" />
          </button>
        </header>

        <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full max-h-[calc(100vh-146px)] w-full object-contain"
          />

          {remotePlaceholder && (
            <div className="absolute inset-0 grid place-items-center bg-[#070B12] px-6 text-center">
              <div className="flex max-w-sm flex-col items-center">
                <div className="grid h-20 w-20 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10">
                  {showSpinner ? (
                    <Loader2 className="size-9 animate-spin text-cyan-200" />
                  ) : (
                    <Video className="size-9 text-cyan-200" />
                  )}
                </div>
                <p className="mt-5 text-lg font-semibold text-white">
                  {statusText}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Keep this tab open while the peer connection is established.
                </p>
              </div>
            </div>
          )}

          <div className="absolute right-3 top-3 w-36 overflow-hidden rounded-lg border border-white/15 bg-black shadow-2xl sm:right-6 sm:top-6 sm:w-56">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`aspect-video w-full object-cover ${
                isCameraOff ? "opacity-0" : ""
              }`}
            />
            {isCameraOff && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950">
                <CameraOff className="size-7 text-slate-300" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
              You
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-center gap-3 border-t border-white/10 bg-[#070B12]/95 px-4 py-4">
          <button
            type="button"
            onClick={toggleMute}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
              isMuted
                ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                : "border-white/15 bg-white/10 text-white hover:bg-white/15"
            }`}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>

          <button
            type="button"
            onClick={endCall}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400"
            title="End call"
            aria-label="End call"
          >
            <Phone className="size-6 rotate-[135deg]" />
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
              isCameraOff
                ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                : "border-white/15 bg-white/10 text-white hover:bg-white/15"
            }`}
            title={isCameraOff ? "Turn camera on" : "Turn camera off"}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {isCameraOff ? (
              <CameraOff className="size-5" />
            ) : (
              <Camera className="size-5" />
            )}
          </button>
        </footer>
      </div>
    </main>
  );
};

export default CallPage;
