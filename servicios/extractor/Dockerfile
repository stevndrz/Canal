# La imagen oficial de Playwright ya trae Chromium y sus librerías del sistema.
# Instalarlas a mano sobre una python:slim son ~40 líneas de apt-get que se
# rompen en cada actualización de Debian.
FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV ORIGENES_PERMITIDOS=http://localhost:3000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
