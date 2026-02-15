## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.
### Available skills
- api-contract-sync: Synchronize API contracts, frontend endpoint definitions, request and response types, and backend handlers. Use when adding or changing endpoints, updating API documentation, resolving contract drift, reviewing breaking API changes, or validating docs-to-code consistency across frontend and backend. (file: /home/jun/code/blog/skills/api-contract-sync/SKILL.md)
- design-token-governance: Govern design token changes with validation, impact analysis, preview discipline, and rollback safety. Use when editing token files, introducing theme revisions, reviewing visual consistency regressions, or enforcing token change policy across admin and frontend surfaces. (file: /home/jun/code/blog/skills/design-token-governance/SKILL.md)
- backend-optimizer: Optimize backend services for latency, throughput, reliability, and cost efficiency. Use when requests mention slow APIs, high p95 or p99 latency, error-rate spikes, DB bottlenecks, N+1 queries, cache miss problems, queue backlog, CPU or memory pressure, timeout and retry storms, connection-pool tuning, or backend optimization code review. (file: /home/jun/code/blog/skills/backend-optimizer/SKILL.md)
- backend-security-hardening: Harden backend authentication, authorization, input validation, rate limiting, token lifecycle, and audit logging. Use when implementing or reviewing login flows, RBAC, write-path safeguards, upload security, abuse controls, or backend security regression checks. (file: /home/jun/code/blog/skills/backend-security-hardening/SKILL.md)
- ci-quality-gate: Build and enforce repeatable CI quality gates for frontend and backend delivery. Use when setting up build and test pipelines, adding release checks, defining required status checks, reducing regressions, or standardizing pre-merge and pre-release validation. (file: /home/jun/code/blog/skills/ci-quality-gate/SKILL.md)
- media-upload-pipeline: Implement secure and reliable media upload pipelines with metadata validation, object storage integration, and lifecycle cleanup. Use when building upload APIs, validating media payloads, handling signed uploads, enforcing size and type limits, or preventing orphaned media records. (file: /home/jun/code/blog/skills/media-upload-pipeline/SKILL.md)
- frontend-optimizer: Optimize frontend applications for performance, bundle size, rendering speed, accessibility, and interaction quality. Use when requests mention Lighthouse or Core Web Vitals, slow load or poor responsiveness, oversized JS or CSS bundles, React or Vue rendering bottlenecks, image or font optimization, responsive layout stability issues, or frontend optimization code review. (file: /home/jun/code/blog/skills/frontend-optimizer/SKILL.md)
- admin-mobile-ui-polish: Improve admin mobile UX for completion speed, readability, and operational safety. Use when refining mobile layouts, card and form density, touch interactions, task flows, fixed action bars, or final UI quality checks for admin pages. (file: /home/jun/code/blog/skills/admin-mobile-ui-polish/SKILL.md)
- publish-rollback-guard: Protect release workflows with deterministic pre-publish checks, change review gates, and rollback readiness validation. Use when preparing production releases, validating publish notes, checking rollback safety, or reducing release regressions for content and configuration updates. (file: /home/jun/code/blog/skills/publish-rollback-guard/SKILL.md)
### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
