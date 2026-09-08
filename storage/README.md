# storage/

Runtime file storage. The folders are tracked; their contents are git-ignored.

| Folder         | Contents                                                              |
| -------------- | ------------------------------------------------------------------- |
| `uploads/`     | User-supplied images for image-to-video (UUID filenames only).      |
| `generations/` | Rendered MP4s + per-job `metadata.json` written by the API worker.  |

- Filenames are always server-generated UUIDs — user filenames are never trusted.
- `uploads/` is swept on a retention timer (see `UPLOAD_RETENTION_HOURS`).
- In `DEMO_MODE` nothing is written here; the mock provider keeps state in memory.
