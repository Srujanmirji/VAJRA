# Contributing

1. Create a branch from `main`: `feature/<short-name>`.
2. Keep changes small and focused; add or update tests in `backend/tests/`.
3. Run `pytest -q` (backend) and `npm run lint` (frontend) before opening a PR.
4. Never commit large data, credentials or internal documents (see `.gitignore`).
5. Any metric shown in the UI must be computed by the system — no hard-coded skill numbers.
6. Label every data source as LIVE, REPLAY or SIMULATED.
