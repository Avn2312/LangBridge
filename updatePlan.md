Plan: LangBridge 8-Week Execution Sprint
Objective: move LangBridge from strong MVP to mid-level-ready, production-credible system with measurable engineering and product outcomes.

Week 1: Security + Environment Baseline

Externalize runtime config (frontend API base URL, backend CORS/session settings).
Add auth/message rate limiting and brute-force protection.
Add request size limits and standardized API error contract.
KPI targets:
100% env-driven runtime host/origin config.
0 unthrottled auth endpoints.
p95 auth latency under 250 ms in local load baseline.

Week 1 status: complete in code, pending latency run

Completed:
Runtime config is env-driven for frontend API base URL, backend CORS, session settings, request body limits, and auth redirect URLs.
Auth and message routes now have Redis-backed rate limiting, plus brute-force lockout for login.
Express request body size limits and a standardized API error envelope are in place.
Socket.IO CORS now uses the shared runtime origin config.
Auth latency benchmark script added at backend/scripts/auth-latency-baseline.mjs.

Remaining:
Run the local auth latency baseline and record the p95 result against the 250 ms target.

Week 2: Test + CI Foundation

Add integration tests for auth/users/messages.
Add socket-path tests (sendMessage, typing, markAsRead).
Add CI pipeline for lint, tests, build; enforce merge gate.
KPI targets:
At least 15 API tests and 5 realtime tests.
CI pass rate above 95%.
No merges allowed with failing checks.
Week 3: Realtime Delivery Guarantees

Add message acknowledgment IDs and client resend timeout.
Add server idempotency for duplicate retries.
Add UI send states for pending/failed/retried.
KPI targets:
Delivery success above 99% in unstable network simulation.
Duplicate message rate below 0.1%.
p95 end-to-end message delivery under 300 ms.
Week 4: Conversation + Presence Scalability

Optimize conversation query/index strategy and pagination.
Replace global presence fanout with scoped updates.
Add Redis cache for conversation summaries + invalidation.
KPI targets:
Conversation list p95 under 200 ms on seeded dataset.
Presence broadcast volume reduced by at least 60%.
Cache hit ratio above 70% for repeated conversation fetch.
Week 5: Product Baseline Upgrades

Add image/file attachments in chat.
Add block/report user flow with backend enforcement.
Improve read-receipt consistency in UI and API.
KPI targets:
Attachment success rate above 98%.
100% blocked-user enforcement in integration tests.
Read receipt correctness above 99%.
Week 6: Matching + Retention Mechanics

Add discovery filters (language, timezone, proficiency, availability).
Add weighted heuristic ranking baseline.
Add retention nudges for unread/re-engagement.
KPI targets:
Friend-request-to-first-chat conversion uplift target: +20%.
Time-to-first-match reduced by 30%.
7-day return-rate uplift target: +10%.
Week 7: AI Feature Layer 1

Ship context-aware translation assist.
Ship inline grammar/tone correction with explanations.
Track correction usage events for impact analytics.
KPI targets:
Suggestion acceptance rate above 25%.
User helpfulness above 4.0/5 in beta feedback.
Translation p95 latency under 800 ms.
Week 8: AI Matching + Interview Packaging

Add embedding-backed reranker for partner matching.
Build reliability + funnel metrics dashboard.
Finalize architecture narrative and case-study README.
KPI targets:
Match acceptance uplift target: +15% over heuristic-only baseline.
Realtime SLO: 99.9% ack within 2 seconds.
3 quantified outcomes ready for resume/interviews.
Scope boundaries

Included: web app, backend APIs, realtime system, AI assistance, measurable outcomes.
Excluded in 8 weeks: native mobile apps, full monetization marketplace, enterprise admin suite.
