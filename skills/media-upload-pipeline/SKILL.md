---
name: media-upload-pipeline
description: Implement secure and reliable media upload pipelines with metadata validation, object storage integration, and lifecycle cleanup. Use when building upload APIs, validating media payloads, handling signed uploads, enforcing size and type limits, or preventing orphaned media records.
---

# Media Upload Pipeline

## Overview

- Validate payloads before writing metadata.
- Keep storage and database records consistent.
- Enforce deterministic cleanup of orphan files.

## Execution Workflow

1. Define upload mode.
   - Choose proxy upload or signed direct upload based on traffic profile.
2. Validate metadata and policy.
   - Enforce MIME, size, and optional dimension rules.
   - Run `scripts/media-manifest-check.sh` for bulk metadata validation.
3. Persist metadata safely.
   - Write object metadata and business linkage in one transaction boundary where possible.
4. Protect and observe.
   - Add limits, auth checks, and audit events.
   - Track upload failures and orphan cleanup results.
5. Clean lifecycle.
   - Implement retention and orphan sweep strategy.

## Output Requirements

- Document upload flow and failure states.
- Record validation policy and limits.
- Provide cleanup job strategy and rollback behavior.

## Guardrails

- Avoid accepting unbounded file sizes.
- Avoid trusting client MIME blindly.
- Avoid deleting storage object before metadata state is known.

## Resources

- Upload reference: `references/upload-playbook.md`
- Manifest validator: `scripts/media-manifest-check.sh`
