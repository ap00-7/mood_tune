# MoodTune ML Service

Small FastAPI service that runs the original Hugging Face emotion classifier and maps its top prediction to MoodTune's existing mood categories. It is deployed separately from the Next.js application.

## Model and inference

- Model: `j-hartmann/emotion-english-distilroberta-base`
- Inference: `transformers.pipeline("text-classification", model=MODEL_ID, top_k=1)`
- The model is loaded once during FastAPI application startup.
- The model's top emotion label and its returned score are used directly. Unknown labels retain the original app's `"chill"` fallback.
- The complete emotion-to-mood mapping is retained from `mood_recommender/app.py`.

## Local setup

Use Python 3.10 or newer. From the repository root:

```powershell
py -3 -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install -r ml_service/requirements.txt
```

The service reads `ML_API_KEY` from its process environment. Set it before starting the service only if the same server-side key is configured in the root `.env.local`; omit it in both processes for unauthenticated local-only development. `.env.example` is a template and is not loaded automatically.

Start the service from `ml_service`:

```powershell
Set-Location ml_service
# Optional, when using server-to-server authentication:
$env:ML_API_KEY = 'your-local-shared-secret'
uvicorn app:app --host 127.0.0.1 --port 8000
```

The first startup downloads model files from Hugging Face; subsequent starts use the Hugging Face cache. Model inference runs on CPU unless the deployment provides a supported accelerator.

## Endpoints

### `GET /health`

Returns service health and whether the model loaded. It does not run inference:

```json
{"status":"ok","model_loaded":true}
```

### `POST /predict`

Accepts one non-empty text string, normalized for repeated whitespace, up to 2,000 characters:

```json
{"text":"I feel amazing today"}
```

Returns model-derived output:

```json
{
  "emotion": "joy",
  "mood": "happy",
  "confidence": 0.94,
  "model": "j-hartmann/emotion-english-distilroberta-base"
}
```

When `ML_API_KEY` is configured, send `Authorization: Bearer <key>`. The Next.js API adds this header server-side; the browser does not receive the key.

## Connect Next.js locally

Set these values in the repository-root `.env.local`:

```env
ML_API_URL=http://localhost:8000
ML_API_KEY=
```

Run the Python service in one terminal and the Next.js app from the repository root in another:

```powershell
npm run dev
```

The browser calls only Next.js at `http://localhost:3000/api/mood`. Next.js calls this service privately.

## Container deployment

Build and run the included Docker image:

```sh
docker build -t moodtune-ml ./ml_service
docker run --rm -p 8000:8000 -e ML_API_KEY=your-server-secret moodtune-ml
```

Deploy the container to Railway, Render, Fly.io, or another container host. Configure `ML_API_KEY` and a persistent volume mounted at `/home/app/.cache/huggingface` to avoid downloading model weights on every replacement deployment. Configure the Next.js Vercel project with:

- `ML_API_URL`: the deployed service's HTTPS origin, without `/predict`
- `ML_API_KEY`: the same server-to-server secret

Restrict the service to HTTPS and use the shared key or the hosting provider's private networking when available. Never use a `NEXT_PUBLIC_` prefix for the key.
