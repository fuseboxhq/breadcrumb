FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copy package files for dependency install
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (promptfoo is a devDependency)
RUN pnpm install --frozen-lockfile

# Copy eval configs, golden references, and agent definitions
COPY evals/ ./evals/
COPY agents/ ./agents/

WORKDIR /app

ENTRYPOINT ["pnpm", "exec", "promptfoo"]
CMD ["eval", "--config", "evals/suites/bc-researcher/promptfooconfig.yaml", "--no-progress-bar"]
