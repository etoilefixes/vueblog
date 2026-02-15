# Upload Playbook

## Validation Baseline

- Require `name`, `url`, `mimeType`, and `size`.
- Enforce maximum size by media class.
- Validate optional width and height for images.

## Storage and Metadata

- Keep object path deterministic.
- Store uploader, MIME, size, dimensions, and timestamp.
- Keep delete behavior explicit: soft-delete then cleanup.

## Reliability

- Retry transient storage errors with bounded retries.
- Keep idempotency key for repeated client submissions.
- Emit audit log for upload and delete operations.
