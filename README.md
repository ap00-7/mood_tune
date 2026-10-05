# MoodTune

MoodTune recommends music for a user's current emotional state. It preserves the original Hugging Face emotion classifier while rebuilding the product as a Next.js application backed by a focused Python ML service.

## Overview

The browser experience collects a short mood description, presents the model's result, and displays tracks matched from the existing music catalog. The product keeps emotion inference server-side and sends no ML credentials to the browser.

## Features

- Text emotion classification using the original Hugging Face model
- Faithful mapping from model emotion labels to MoodTune mood categories
- Mood-based track selection and ranking from audio features
- Language filtering and Spotify/external track links
- Catalog browsing by supported mood without a mood-analysis request
- Responsive Next.js interface with analysis, loading, and error states
- Separate FastAPI inference service suitable for container hosting

## How It Works

1. The user describes their mood in the Next.js interface.
2. The Next.js API validates the text and sends it to the Python ML service.
3. The ML service runs transformer inference and returns its top emotion and actual model score.
4. The emotion is mapped to happy, sad, energetic, or chill using the original mapping.
5. Next.js passes that mood to the recommendation engine, which ranks catalog tracks using mood, valence, energy, danceability, and the selected language.
6. The user can open a recommended track through its Spotify or external link.

Catalog pages browse successive slices of the existing ranked results; the scoring formula is unchanged. Duplicate track/artist/language rows are collapsed, matching the original Streamlit catalog's deduplication behavior.

## Machine Learning

- Model: `j-hartmann/emotion-english-distilroberta-base`
- Library: Hugging Face Transformers, with `pipeline("text-classification", ..., top_k=1)`
- Model instance: loaded once during FastAPI application startup
- Output: model's top emotion label and its returned confidence score
- Mapping: all 110 emotion-to-mood entries are preserved from the original Streamlit app; unlisted labels default to `chill`, matching the original behavior

No keyword-based JavaScript detector or generated confidence score is used for inference.

## Tech Stack

- Next.js, React, TypeScript, and Tailwind CSS
- Python, FastAPI, Hugging Face Transformers, and PyTorch
- Framer Motion and Lucide icons
- Existing CSV music catalog
- Vercel for the Next.js app; a separate container host for Python inference

## Architecture

```text
Browser
  -> Next.js frontend
  -> Next.js /api/mood
  -> authenticated Python FastAPI /predict
  -> Hugging Face transformer
  -> emotion -> original MoodTune mood mapping
  -> Next.js recommendation engine
  -> local music catalog -> external music link
```

The model service is intentionally separate; the transformer and PyTorch runtime are not bundled into Vercel's frontend deployment.

## Product Routes

- `/` — product landing page
- `/discover` — browse catalog recommendations by mood and language
- `/mood` — analyze a text description with the real transformer model
- `/recommendations` — explore catalog picks with mood and language filters
- `/about` — architecture and implementation overview

## Local Development

Install the Next.js dependencies and create a Python environment once:

```powershell
npm install
py -3 -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install -r ml_service\requirements.txt
```

Copy the Next.js environment template:

```powershell
Copy-Item .env.example .env.local
```

Start the ML service in terminal 1:

```powershell
Set-Location ml_service
uvicorn app:app --host 127.0.0.1 --port 8000
```

Start Next.js from the repository root in terminal 2:

```powershell
npm run dev
```

Open http://localhost:3000. The first ML-service startup downloads the model; later runs reuse the Hugging Face cache. To enable local service authentication, set the same `ML_API_KEY` value in the ML process environment and the root `.env.local`. Leave it unset in both places for unauthenticated local-only development.

## Environment Variables

Root `.env.local` (see [.env.example](./.env.example)):

| Variable | Purpose |
| --- | --- |
| `ML_API_URL` | Python service origin, e.g. `http://localhost:8000` |
| `ML_API_KEY` | Optional server-to-server bearer secret; never exposed to the browser |
| `NEXT_PUBLIC_APP_URL` | Public application URL |
| `NEXT_PUBLIC_SITE_NAME` | Site name |
| `NEXT_PUBLIC_SPOTIFY_URL` | Spotify link base |

The Python service reads `ML_API_KEY` from its process environment. Its environment template is [ml_service/.env.example](./ml_service/.env.example).

## Deployment

1. Deploy the Next.js application to Vercel.
2. Deploy the [ml_service](./ml_service/) container to Railway, Render, Fly.io, or another persistent container host.
3. Configure `ML_API_URL` in Vercel with the Python service's HTTPS origin.
4. Set the same strong, private `ML_API_KEY` in Vercel and the Python host. Never prefix it with `NEXT_PUBLIC_`.
5. Keep the Python service warm and persist its Hugging Face cache so startup does not repeatedly download model files.

See [ml_service/README.md](./ml_service/README.md) for service setup, endpoints, and container deployment details.

## Future Improvements

- Richer music metadata and official Spotify API integration
- Playlist export and optional account-based saved recommendations
- Dataset improvements and more extensive recommendation evaluation
- Monitoring and model latency/cold-start optimization for the hosted inference service

## Author

MoodTune is a portfolio project exploring emotion-aware music discovery, full-stack development, and practical ML service architecture.
