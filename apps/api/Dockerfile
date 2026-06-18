# Portfolio API service (Node/Hono). Build from the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t portfolio-api .
# Run (env provided externally — DATABASE_URL, JWT_SECRET, TOGETHER_API_KEY,
# SMTP_*, CONTACT_EMAIL, CORS_ALLOWED_ORIGINS, AUTH_COOKIE_*, …):
#   docker run -p 4000:4000 --env-file .env portfolio-api

# ---- deps: install the workspace + generate the Prisma client ----
FROM node:22-slim AS deps
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# Only the manifests first, for layer caching. NODE_ENV is unset here so
# devDeps (tsx, used to run the service) are installed.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY prisma ./prisma
RUN npm ci

# ---- prune: drop web-only + dev-tooling packages the API never imports ----
FROM deps AS pruned
WORKDIR /repo/node_modules
RUN rm -rf \
      next @next react react-dom react-is scheduler \
      @react-pdf recharts victory-vendor d3-* \
      react-markdown remark-gfm jspdf html2pdf.js canvg \
      isomorphic-dompurify dompurify @marsidev \
      @anthropic-ai \
      typescript eslint eslint-config-next @typescript-eslint \
      vitest @vitest vite vite-node @vitejs jsdom @testing-library \
      prisma tailwindcss @tailwindcss postcss autoprefixer \
      .cache .bin/next .bin/eslint .bin/tsc .bin/vitest

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=pruned /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
EXPOSE 4000
WORKDIR /repo/apps/api
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
