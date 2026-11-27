# Podcast GPU worker

This worker is deployed as a Modal serverless GPU app. Use `uv` both to run the local Modal CLI and, via `Image.uv_pip_install`, to install the worker's Python requirements into the remote image.

On Windows, create a local virtual environment with `uv`, install Modal into it, and authenticate:

```powershell
cd D:\My_Youtube\motiongrapc-genrator\workers\podcast
uv venv --python 3.12 .venv
uv pip install --python .venv\Scripts\python.exe "modal>=1.1.0" "pydantic>=2"
.\.venv\Scripts\modal.exe setup
```

Create a Modal Secret named `ai-podcast-clipper-secret` in the Modal dashboard with `AUTH_TOKEN`, `OPENAI_API_KEY`, AWS credentials and region, and `CLIP_S3_BUCKET` set to the same bucket used by the web app. The worker needs read access to source objects and write access to clip outputs. The highlight selector uses OpenAI `gpt-4o-mini` by default; set `PODCAST_OPENAI_MODEL` in the secret to select another model available to your API key.

From the repository's podcast worker directory, deploy the app with the same virtual environment's CLI:

```powershell
.\.venv\Scripts\modal.exe deploy main.py
```

Modal builds the GPU image and exposes the ASGI endpoint URL. The first build installs a large ML dependency set and may take a while.

WhisperX uses a matched PyTorch 2.8.0, TorchAudio 2.8.0, and TorchVision 0.23.0 CUDA 12.8 stack. Keeping these versions pinned prevents the `torchaudio.AudioMetaData` import failure seen with TorchAudio 2.9 and later.

Set the resulting ASGI base URL in the Next server environment as `PODCAST_WORKER_URL`, with the same bearer secret in `PODCAST_WORKER_TOKEN`. All clipping jobs are sent to this Modal worker; the clipping UI and API accept vertical 9:16 jobs only. WhisperX aligns English speech; OpenAI proposes extra highlight candidates; LR-ASD checks visible active speakers, follows the best-scoring speaking face when reframing, and rejects a candidate when an active speaker is visible in less than 25% of analyzed frames. The worker checks up to three candidates per requested clip (up to 30) to replace rejected candidates where possible.

Source: https://github.com/Andreaswt/ai-podcast-clipper-saas . The Modal image fetches the original LR-ASD revision and weights during build.
