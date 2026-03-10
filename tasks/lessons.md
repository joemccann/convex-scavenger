# Lessons

## 2026-03-10

- When documenting or automating IBC control in this repo, treat the canonical service as the secure machine-local wrappers under `~/ibc/bin/`, not as a repo-owned service.
- Repo scripts for IBC remote control must be described as convenience wrappers around `/Users/joemccann/ibc/bin/*secure-ibc-service.sh`, never as the primary service implementation.
- For market index integrations, do not assume a daily historical bar matches the authoritative displayed value on the exchange dashboard; verify the exact field semantics against the live source before wiring the signal.
- For repo changes that touch a monorepo with separate deploy targets, check whether deployment filters are needed so unrelated pushes do not rebuild unaffected apps.
