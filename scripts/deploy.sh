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
npx prisma db push --skip-generate

# Build application
log "Building application..."
npm run build

# Restart PM2
log "Restarting PM2..."
pm2 restart myportfolio

log "========== Deployment complete =========="
