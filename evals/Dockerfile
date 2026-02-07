FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copy package files for dependency install
COPY package.json pnpm-lock.yaml ./

# Install only dev dependencies (promptfoo lives there)
RUN pnpm install --frozen-lockfile

# Copy eval configs and golden references
COPY evals/ ./evals/

WORKDIR /app

ENTRYPOINT ["pnpm", "exec", "promptfoo"]
CMD ["eval", "--config", "evals/promptfooconfig.yaml", "--no-progress-bar"]
