# ADR-007: Video Architecture Direction (Phase 2)

## Status
Accepted (future implementation)

## Decision
Adopt S3 for upload storage, MediaConvert for transcoding, and CDN delivery via CloudFront.

## Rationale
- Durable and scalable pipeline for user-generated media.
- Supports asynchronous analysis and progressive quality delivery.

## Consequences
- Queue orchestration and job visibility required in phase 2.
- Cost monitoring for encoding/transcode usage required from launch.
