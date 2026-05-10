# LangBridge Project-Aware Upgrade Roadmap

This plan replaces the generic Gemini roadmap with a plan that matches our actual LangBridge codebase.

LangBridge is already more than a basic MERN chat app. It currently has JWT/Google auth, onboarding, friend requests, Socket.IO chat, typing indicators, read receipts, Redis presence/cache/rate-limit pieces, Kafka-style worker hooks, moderation, smart recommendations, learning activity, draft correction, message translation, saved phrases, and a learning dashboard.

So our goal is not to throw in every advanced feature at once. Our goal is to turn the existing pieces into a clean, explainable language-exchange product inspired by HelloTalk, while keeping the project understandable enough for you to confidently explain in interviews or demos.

References used:
- HelloTalk official site: https://www.hellotalk.net/
- HelloTalk feature overview: https://creators.hellotalk.com/article/navigating-hellotalk

## Implementation Progress Snapshot

Last updated: May 10, 2026

Recently completed:
- Replaced the placeholder call page with a custom one-to-one WebRTC call flow.
- Added caller/callee signaling using the existing Socket.IO events:
  - `call:invite`
  - `call:accepted`
  - `call:rejected`
  - `call:ended`
  - `webrtc:offer`
  - `webrtc:answer`
  - `webrtc:ice-candidate`
- Added local camera and microphone startup when entering the call page.
- Added production-safe media cleanup so camera and microphone tracks are stopped when the call ends, the peer ends the call, setup fails, or the page unmounts.
- Added mute microphone and camera toggle controls.
- Added a full-screen call UI with remote video as the main stage and local self-preview as an overlay.
- Added call states for starting, ringing, connecting, connected, failed, declined, and ended.
- Added a 60-second unanswered-call timeout.
- Updated the incoming-call toast so the receiver can Accept or Decline.

Verified:
- `npm run lint` passes in `frontend`.
- `npm run build` passes in `frontend`.
- Vite dev server starts at `http://127.0.0.1:5173/`.

Still needs manual verification:
- Test with two logged-in users in separate browsers/devices.
- Confirm browser camera/mic indicators turn on during the call.
- Confirm indicators turn off after End Call, remote hangup, decline, timeout, and navigation away.
- Confirm both users return to the correct chat after the call ends.

## Product Direction

HelloTalk-style features we will borrow carefully:
- Chat with learning tools: translate, correct, save phrase.
- Partner discovery: native language, learning language, interests, proficiency.
- Voice practice: voice notes first, live calls later.
- Learning history: saved phrases, corrections, translations, weekly progress.
- Community feel later: a simple "Moments" feed can come after the core chat experience is solid.

Features we should avoid for now:
- Livestreams.
- Public voice rooms.
- Heavy AI embeddings.
- Complex rich text editors like Tiptap.
- Multi-person group chats.
- Paid/VIP-style feature gates.

These are good real product ideas, but they will make the code harder to understand before the basics feel natural.

## Current Project Map

Important backend files:
- `backend/src/models/User.js`
  User profile, languages, proficiency, interests, friends, blocked users.
- `backend/src/models/Message.js`
  Direct messages, attachments, read receipts, client message id.
- `backend/src/models/LearningActivity.js`
  Saved phrases, translations, corrections.
- `backend/src/controllers/learning.controller.js`
  Translation, correction, saved phrases, learning dashboard.
- `backend/src/lib/languageAssist.js`
  Local correction, local translation preview, partner match scoring.
- `backend/src/lib/socket.js`
  Socket.IO realtime messages, typing, read receipts, presence.
- `backend/src/controllers/user.controller.js`
  Recommendations, friends, block/report flows.

Important frontend files:
- `frontend/src/pages/CallPage.jsx`
  Custom one-to-one WebRTC call screen, local/remote video, call controls, media cleanup.
- `frontend/src/hooks/useSocket.js`
  Socket connection lifecycle, chat events, incoming-call toast, call accept/decline event bridge.
- `frontend/src/pages/ChatPage.jsx`
  Chat screen, translations, save phrase, block/report, video call entry point.
- `frontend/src/components/ChatInput.jsx`
  Message sending, attachments, emoji picker, draft correction.
- `frontend/src/components/MessageBubble.jsx`
  Message UI, translate button, save phrase button.
- `frontend/src/pages/LearningPage.jsx`
  Learning dashboard.
- `frontend/src/pages/HomePage.jsx`
  Friends and recommended users.
- `frontend/src/components/RecommendedUserCard.jsx`
  Partner discovery card.
- `frontend/src/lib/api.js`
  Frontend API wrappers.

## Phase 0: Stabilize Understanding Before New Features

Goal: make sure you understand the app's main data flow before we add more.

What we will study together:
- Signup/login -> JWT cookie -> `protectRoute`.
- Onboarding -> languages/interests/proficiency saved on `User`.
- Friend request -> accepted friend -> visible in friends list.
- Chat send -> Socket.IO -> MongoDB `Message` -> receiver gets `newMessage`.
- Translate/save/correct -> `LearningActivity` -> dashboard.

Small implementation tasks:
- Add short learning comments or docs only where the flow is confusing.
- Create one simple architecture note: `docs/LEARNING_FLOW.md`.
- Make sure `geminiPlan.md`, `PLAN.md`, and the code do not contradict each other.

Done when:
- You can explain how one message travels from frontend input to database to receiver UI.
- You can explain why translation/correction belongs under `/api/learning`.

## Phase 1: Polish Existing Learning Tools

Goal: make the already-present translation, correction, and saved phrase features feel intentional.

Current state:
- `POST /api/learning/translate` already exists.
- `POST /api/learning/correct` already exists.
- `POST /api/learning/phrases` already exists.
- Chat already has translate and save phrase buttons.
- Chat input already has a polish/correct draft button.

What we should implement:
- Add a visible "show original / show translation" toggle per message.
- Show translation metadata in a small, simple way: target language and confidence.
- Add a "Correct this message" action on received messages, separate from draft correction.
- Store correction activity with `messageId` and `partnerId`.
- Improve `LearningPage` so it groups recent activity by type.

What you will learn:
- React local state for per-message UI.
- Mutations with TanStack Query.
- MongoDB references through `LearningActivity`.
- Why we keep corrections as learning activities instead of editing another user's original message.

Suggested files:
- `frontend/src/pages/ChatPage.jsx`
- `frontend/src/components/MessageBubble.jsx`
- `frontend/src/pages/LearningPage.jsx`
- `frontend/src/lib/api.js`
- `backend/src/controllers/learning.controller.js`
- `backend/src/models/LearningActivity.js`

Done when:
- In chat, a user can translate a message, save it, and request a correction.
- The learning dashboard clearly shows those actions afterward.
- Original messages remain untouched.



## Phase 2: Real Collaborative Corrections

Goal: add HelloTalk-style partner corrections without introducing a heavy editor.

Simple version:
- User clicks "Correct" on a partner's message.
- A small modal opens with:
  - original text
  - editable corrected text
  - optional note
- Submit creates a `correction` learning activity and emits a socket event to the partner.

Backend shape:
- Keep original `Message.text` unchanged.
- Add a new model only if needed:
  - `Correction`
  - fields: `message`, `author`, `receiver`, `originalText`, `correctedText`, `note`, `status`
- Or start simpler by storing it in `LearningActivity.metadata`.

Recommended first implementation:
- Use `LearningActivity` first.
- Add a dedicated `type: "partner_correction"` if the current enum supports it or can be safely expanded.
- Add socket event `newCorrection` only after the REST flow works.

What you will learn:
- Why editing someone else's message is risky.
- Difference between source data and annotation data.
- How socket events can notify users after database writes.

Done when:
- Corrections appear as annotations, not message edits.
- Both users can see the correction in the learning history or chat context.

## Phase 3: Better Partner Discovery

Goal: make recommendations feel like a language-exchange product.

Current state:
- `User` already has `nativeLanguage`, `learningLanguage`, `proficiencyLevel`, `interests`, `timezone`, and `location`.
- `scorePartnerMatch` already scores mutual language goals and interests.
- `HomePage` already renders recommended users.

What we should implement:
- Add filter controls on the home/discovery screen:
  - target language
  - native language
  - proficiency
  - online now
- Show match reasons clearly on each user card.
- Add "best exchange match" label when the match is mutual.
- Improve onboarding so users choose proficiency from clear beginner/intermediate/advanced choices.

What you will learn:
- Query parameters in frontend API calls.
- MongoDB filtering vs in-memory scoring.
- Product thinking: why match reasons build trust.

Suggested files:
- `backend/src/controllers/user.controller.js`
- `backend/src/lib/languageAssist.js`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/components/RecommendedUserCard.jsx`
- `frontend/src/pages/OnboardingPage.jsx`

Done when:
- Users can filter recommendations.
- Recommendation cards explain why a person is a good partner.

## Phase 4: Voice Notes Before Live Calls

Goal: add asynchronous speaking practice without jumping straight into complicated WebRTC.

Why voice notes first:
- They are easier to understand than live calls.
- They fit language learning very well.
- They reuse the existing message and attachment flow.

Current state:
- `Message.attachments` supports `image` and `file`.
- `ChatInput` already supports attachments, currently as data URLs.

What we should implement:
- Add `audio` as an attachment type in `Message`.
- Add a small recorder button using the browser `MediaRecorder` API.
- Store recorded audio as an attachment.
- For learning/demo mode, data URL is acceptable.
- For production mode, later replace data URLs with Cloudinary/S3 upload.

What you will learn:
- Browser media permissions.
- Blob -> URL/data URL conversion.
- Schema enums and frontend rendering.
- Why production apps store media outside MongoDB.

Suggested files:
- `backend/src/models/Message.js`
- `backend/src/lib/socket.js`
- `frontend/src/components/ChatInput.jsx`
- `frontend/src/components/MessageBubble.jsx`

Done when:
- User can record a short voice note.
- Voice note appears in chat with an audio player.
- The same Socket.IO message flow is reused.

## Phase 5: Make Live Calls Explainable

Goal: keep live calling as a demo-friendly feature, not a huge system rewrite.

Current state:
- `frontend/src/pages/CallPage.jsx` now implements a custom one-to-one WebRTC call page.
- `frontend/src/components/CallButton.jsx` starts a call from chat by navigating to `/call/:id?start=1`.
- `backend/src/lib/socket.js` already provides call invite, accept, reject, end, offer, answer, and ICE candidate relay events.
- `frontend/src/hooks/useSocket.js` shows the incoming-call toast and emits accept/reject.

Implemented:
- One-to-one WebRTC only.
- Socket.IO is used only for signaling and call lifecycle events.
- Caller sends `call:invite`.
- Receiver accepts from the toast and navigates to `/call/:callerId?callId=:callId`.
- Caller creates and sends the WebRTC offer after `call:accepted`.
- Receiver applies the offer, creates an answer, and sends it back.
- Both peers exchange ICE candidates through Socket.IO.
- Local camera/mic tracks are attached to the peer connection.
- Remote stream is rendered in the main video area.
- Local stream is rendered as a self-preview overlay.
- End call stops media tracks, closes the peer connection, clears video elements, and navigates back to chat.
- Remote call end also cleans up media and returns to chat.
- Mute/camera toggles use `track.enabled` during the call.
- Ending the call uses `track.stop()` so browser camera/mic indicators should turn off.
- Decline and unanswered timeout are handled.

What still needs testing:
- Two-user happy path: caller starts, receiver accepts, both see/hear each other.
- Receiver decline path: caller returns cleanly.
- Caller hangup before accept: receiver does not get stuck.
- Remote hangup during active call: local user returns cleanly and media stops.
- Permission denied path: user sees the failure state and no stale media remains.
- Refresh/navigation-away path: camera and mic stop.
- Mobile layout with local preview and controls.

Possible next improvements:
- Add TURN server support for production networks where STUN-only peer connections fail.
- Show the partner's name/avatar on the call screen.
- Add a ringing sound or visual incoming-call modal instead of only a toast.
- Add socket handling for callee disconnect or caller disconnect while ringing.
- Add a short call debugging panel in development mode only.

What you will learn:
- Difference between chat sockets and WebRTC media streams.
- Why signaling is not the same as sending audio/video.
- What STUN/TURN servers are.

Done when:
- You can explain the call flow from chat button -> invite -> accept -> offer -> answer -> ICE -> media stream.
- Two logged-in test users can complete a call.
- Camera and microphone turn off after every end/decline/failure path.
- Chat remains stable if calls fail.

## Phase 6: A Simple Moments Feature

Goal: add a small community feature inspired by HelloTalk Moments, but keep it lightweight.

Recommended scope:
- Create text-only public posts first.
- Users can post in the language they are learning.
- Other users can comment with corrections.
- Add images later only if the text version is solid.

Backend:
- New `Moment` model:
  - `author`
  - `text`
  - `language`
  - `visibility`
  - `createdAt`
- New routes:
  - `GET /api/moments`
  - `POST /api/moments`
  - `POST /api/moments/:id/comments`

Frontend:
- New `MomentsPage.jsx`.
- Composer at top.
- Feed below.
- Correction/comment actions.

What you will learn:
- Public feed design.
- Pagination.
- Nested data: posts and comments.
- Basic moderation concerns.

Done when:
- Users can post a short learning update.
- Other learners can reply or correct.
- The feature feels connected to language learning, not random social posting.

## Phase 7: Provider Upgrade for Translation and Grammar

Goal: only after the local learning flow is understood, replace local helpers with real providers.

Do later:
- Add provider interface:
  - `translateText({ text, targetLanguage, contextMessages })`
  - `correctText({ text, tone, targetLanguage })`
- Keep local provider as fallback.
- Add provider env vars.
- Add rate limits and caching.

Provider options:
- Translation: Google Cloud Translate, DeepL, or an LLM.
- Grammar: LanguageTool or an LLM.

Important:
- Do not start here. API providers add cost, rate limits, secrets, and failure modes. We should first make the product flow strong with local helpers.

## Final Recommended Build Order

1. Understand current auth, onboarding, friend, chat, and learning flow.
2. Polish message translation/save/correction UI.
3. Add partner correction annotations.
4. Improve discovery filters and match reasons.
5. Add voice notes.
6. Finish manual QA for the WebRTC call page and add TURN support if needed.
7. Add simple Moments feed.
8. Swap local learning helpers with real translation/grammar providers.

## What I Will Help You Learn While We Build

For every feature, we will follow this rhythm:

1. Read the existing files.
2. Draw the data flow in plain language.
3. Make the smallest useful backend change.
4. Connect the frontend.
5. Test it manually.
6. Add focused tests only where risk is high.
7. Write a short explanation you can use in your project demo.

That way you are not just getting code added to the project. You are building a mental model of how the project works.
