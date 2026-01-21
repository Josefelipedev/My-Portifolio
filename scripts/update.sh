#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Starting project update...${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Generate Prisma client
echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
npm run db:generate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to generate Prisma client${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Prisma client generated${NC}"

# Push schema to database
echo -e "${YELLOW}🗄️  Pushing schema to database...${NC}"
npm run db:push
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to push schema${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database schema updated${NC}"

# Build project
echo -e "${YELLOW}🏗️  Building project...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completed${NC}"

# Update Job Scraper Docker service
if [ -d "job-scraper" ]; then
    echo -e "${YELLOW}🐳 Updating Job Scraper Docker service...${NC}"
    cd job-scraper

    # Build and restart container
    docker-compose build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to build Job Scraper${NC}"
        cd ..
    else
        docker-compose down 2>/dev/null || true
        docker-compose up -d
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to start Job Scraper${NC}"
        else
            echo -e "${GREEN}✅ Job Scraper updated${NC}"
        fi
        cd ..
    fi
fi

echo -e "${GREEN}🎉 Update completed successfully!${NC}"
