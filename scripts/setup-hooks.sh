#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Setting up git hooks...${NC}"

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create post-merge hook
cat > .git/hooks/post-merge << 'EOF'
#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Git pull detected - checking for changes...${NC}"

CHANGED_FILES=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)

if echo "$CHANGED_FILES" | grep -q "package.json"; then
    echo -e "${YELLOW}📦 package.json changed - installing dependencies...${NC}"
    npm install
fi

if echo "$CHANGED_FILES" | grep -q "prisma/schema.prisma"; then
    echo -e "${YELLOW}🗄️  Prisma schema changed - updating database...${NC}"
    npm run db:generate
    npm run db:push
fi

echo -e "${GREEN}✅ Post-merge hook completed${NC}"
EOF

chmod +x .git/hooks/post-merge

echo -e "${GREEN}✅ Git hooks configured successfully!${NC}"
echo -e "The following hooks are now active:"
echo -e "  - post-merge: Auto-updates after git pull"
