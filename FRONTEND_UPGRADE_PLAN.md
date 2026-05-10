# LangBridge Frontend Upgrade Plan

This file focuses only on making the frontend feel like a polished language-exchange app while staying understandable. The goal is not a flashy redesign. The goal is a clean, demo-ready interface where every screen supports the learning workflow.

## Design Direction

LangBridge should feel:
- calm and focused
- social, but not noisy
- helpful for language learning
- fast to scan
- easy to explain

Avoid:
- landing-page style sections inside the app
- huge decorative cards
- too many gradients
- complex animations that hide the actual workflow
- UI features that are not backed by real product behavior

## Current Frontend Map

Core screens:
- `frontend/src/pages/HomePage.jsx`
  Friends and recommended users.
- `frontend/src/pages/MessagesPage.jsx`
  Conversation list.
- `frontend/src/pages/ChatPage.jsx`
  One-to-one chat.
- `frontend/src/pages/LearningPage.jsx`
  Translations, corrections, saved phrases.
- `frontend/src/pages/ProfilePage.jsx`
  User profile.
- `frontend/src/pages/OnboardingPage.jsx`
  Language profile setup.
- `frontend/src/pages/NotificationPage.jsx`
  Friend requests.

Core components:
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/RecommendedUserCard.jsx`
- `frontend/src/components/FriendCard.jsx`
- `frontend/src/components/MessageBubble.jsx`
- `frontend/src/components/ChatInput.jsx`

## Phase 1: App Shell Cleanup

Goal: make navigation predictable and consistent.

Tasks:
- Review `Layout`, `Sidebar`, and `Navbar` spacing.
- Make active navigation states obvious.
- Keep primary navigation simple:
  - Home
  - Messages
  - Learning
  - Friends
  - Profile
- Put moderation behind a simple admin/dev-only link later.
- Make mobile navigation comfortable.

Done when:
- You can move through the whole app without guessing where things are.
- The layout does not jump between pages.

## Phase 2: Chat Screen Upgrade

Goal: make chat the strongest screen in the project.

Tasks:
- Improve message action buttons:
  - translate
  - save phrase
  - correct
- Show translated text with a clear toggle.
- Add correction result preview below the message.
- Add voice note UI after backend support exists.
- Keep block/report actions available but visually quieter.
- Keep typing, read receipts, queued, sending, failed states visible.

Files:
- `frontend/src/pages/ChatPage.jsx`
- `frontend/src/components/MessageBubble.jsx`
- `frontend/src/components/ChatInput.jsx`

Done when:
- The chat screen clearly feels like a language-learning chat, not a generic messenger.

## Phase 3: Discovery Upgrade

Goal: make partner recommendations understandable and useful.

Tasks:
- Add compact filters:
  - language I want to practice
  - native language
  - proficiency
  - online now
- Show match score only if it helps; match reasons matter more.
- Make `RecommendedUserCard` show:
  - name
  - native language
  - learning language
  - proficiency
  - interests
  - match reasons
  - request button state
- Add empty states that explain what profile fields improve matching.

Files:
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/components/RecommendedUserCard.jsx`
- `frontend/src/components/NoRecommendedUser.jsx`

Done when:
- A user can understand why each person was recommended.

## Phase 4: Learning Dashboard Upgrade

Goal: make learning progress feel useful, not just statistical.

Tasks:
- Split dashboard into:
  - weekly summary
  - saved phrases
  - corrections
  - translations
- Add tabs or segmented controls for activity type.
- Let users copy saved phrases.
- Show original and result text clearly.
- Add partner name later if backend populates it.

Files:
- `frontend/src/pages/LearningPage.jsx`
- `frontend/src/lib/api.js`

Done when:
- The learning page helps users review what happened in chat.

## Phase 5: Profile and Onboarding Upgrade

Goal: make the language profile strong enough to power matching.

Tasks:
- Make onboarding fields clear:
  - native language
  - learning language
  - proficiency
  - timezone/location
  - interests
  - short bio
- Add helper text only where users need it.
- Show profile completion hints on profile page.
- Keep proficiency simple: beginner, intermediate, advanced.

Files:
- `frontend/src/pages/OnboardingPage.jsx`
- `frontend/src/pages/ProfilePage.jsx`

Done when:
- A new user can create a useful language profile in one pass.

## Phase 6: Messages Page Upgrade

Goal: make conversations easy to resume.

Tasks:
- Show unread count clearly.
- Show last message preview.
- Show online state.
- Add search by friend name.
- Add empty state for no conversations.

Files:
- `frontend/src/pages/MessagesPage.jsx`

Done when:
- Users can quickly return to active chats.

## Phase 7: Moments UI Later

Goal: add a small public learning feed after chat and discovery are solid.

Tasks:
- Create `MomentsPage.jsx`.
- Add a simple composer.
- Add feed cards with text, language, author, and comments.
- Add correction/comment action.
- Add pagination.

Do not start this until:
- Chat learning tools are polished.
- Discovery filters work.
- Learning dashboard is useful.

## Suggested Frontend Build Order

1. App shell cleanup.
2. Chat learning actions.
3. Learning dashboard tabs.
4. Discovery filters and match cards.
5. Onboarding/profile polish.
6. Messages page polish.
7. Voice note UI.
8. Moments page.

## How We Will Work Together

For each screen:

1. First I will explain what the screen currently does.
2. Then we will choose one small improvement.
3. I will implement it.
4. We will run the app and inspect the result.
5. I will explain the changed files in simple language.

This keeps the frontend upgrade connected to your learning instead of becoming a mystery redesign.
