#!/bin/bash

# Auto-deploy script for portfolio
# Runs git pull, npm install, prisma generate, build, and restart

set -e

LOGFILE="$HOME/deploy.log"
LOCKFILE="$HOME/.deploy.lock"
APP_DIR="$HOME/myportfolio"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# Check if already deploying
if [ -f "$LOCKFILE" ]; then
  log "Deploy already in progress, skipping..."
  exit 0
fi

# Create lock file
touch "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

log "========== Starting deployment =========="

cd "$APP_DIR"

# Pull latest changes
log "Pulling latest changes..."
git pull origin main

# Install dependencies
log "Installing dependencies..."
npm install --production=false

# Generate Prisma client
log "Generating Prisma client..."
npx prisma generate

# Push schema to database
log "Pushing schema to database..."
npx prisma db push

# Build application
log "Building application..."
npm run build

# Update and restart Job Scraper Docker service
if [ -d "$APP_DIR/job-scraper" ]; then
  log "Updating Job Scraper Docker service..."
  cd "$APP_DIR/job-scraper"

  # Build and restart container
  docker-compose build --no-cache
  docker-compose down 2>/dev/null || true
  docker-compose up -d

  # Wait for health check
  log "Waiting for Job Scraper to be healthy..."
  for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
      log "Job Scraper is healthy"
      break
    fi
    sleep 1
  done

  cd "$APP_DIR"
fi

# Restart PM2
log "Restarting PM2..."
pm2 restart myportfolio

log "========== Deployment complete =========="
