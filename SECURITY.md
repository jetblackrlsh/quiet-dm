# Safety and data boundaries

Quiet DM has no runtime network calls, remote AI service or account requirement.
Saves and logs may contain private writing: keep them private unless you intend
to share them. Public issue reports should use minimal fictional examples.

Checksums detect accidental corruption; they are not signatures or protection
against an author who edits a save and recomputes its checksum. Future randomness
is inspectable. Reproducibility does not imply cryptographic secrecy.

Use one canonical local path per CLI save and one browser tab per browser save.
The CLI lock does not coordinate symlink aliases, shared network drives or
browser tabs. Forced process termination can leave a lock; follow README's
recovery steps only after confirming no process is using that save.

The browser's local storage can be cleared, blocked or filled. Export backups.
Node/DOM tests do not establish exhaustive real-browser behavior. Imported files
should come from a trusted source; do not execute JavaScript supplied as a save.
