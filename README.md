# Universal LLM Prompt Builder

Small web interface that collects prompt parameters and generates a portable JSON payload for multiple LLM APIs.

## What it generates

- A normalized prompt schema (`system`, `user`, and generation parameters)
- Provider payloads for:
  - OpenAI chat/completions style
  - Anthropic messages style
  - Gemini `generateContent` style
  - A generic fallback format

## Run

1. Open `index.html` directly in a browser.
2. Or serve locally from this folder:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Notes

- The page is fully client-side (no backend required).
- `Copy JSON` may not work in some locked-down browser contexts; use `Download JSON` as fallback.
