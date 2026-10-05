import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated, Any, AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from emotion import load_emotion_classifier, predict_emotion
from schemas import HealthResponse, PredictionRequest, PredictionResponse

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("moodtune.ml")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Loading emotion model %s", "j-hartmann/emotion-english-distilroberta-base")
    app.state.classifier = load_emotion_classifier()
    logger.info("Emotion model loaded")
    yield
    app.state.classifier = None


app = FastAPI(
    title="MoodTune ML Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def invalid_request_handler(
    _request: Request,
    _error: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"detail": "Provide non-empty text of at most 2,000 characters."},
    )


async def verify_service_key(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    configured_key = os.getenv("ML_API_KEY")
    if configured_key and not hmac.compare_digest(
        authorization or "",
        f"Bearer {configured_key}",
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")


@app.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=getattr(request.app.state, "classifier", None) is not None,
    )


@app.post(
    "/predict",
    response_model=PredictionResponse,
    dependencies=[Depends(verify_service_key)],
)
async def predict(payload: PredictionRequest, request: Request) -> PredictionResponse:
    classifier: Any = getattr(request.app.state, "classifier", None)
    if classifier is None:
        raise HTTPException(status_code=503, detail="The emotion model is not ready.")

    try:
        result = await run_in_threadpool(predict_emotion, payload.text, classifier)
        return PredictionResponse(**result)
    except Exception as error:
        logger.exception("Emotion inference failed")
        raise HTTPException(
            status_code=503,
            detail="Mood analysis is temporarily unavailable. Please try again.",
        ) from error
