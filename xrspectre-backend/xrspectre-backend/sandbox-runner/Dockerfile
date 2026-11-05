FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  gcc \
  g++ \
  python3 \
  openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password --gecos '' sandbox
USER sandbox
WORKDIR /workspace

COPY runner.js /runner.js

ENTRYPOINT ["node", "/runner.js"]
