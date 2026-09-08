FROM python:3.12-slim

WORKDIR /app

# nvidia-smi is provided by the host driver / NVIDIA Container Toolkit at runtime.
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir "."

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
