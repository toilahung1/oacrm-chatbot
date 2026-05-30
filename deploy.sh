#!/bin/bash
echo "🚀 Starting Deployment Process..."

# 1. Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "⚙️ Initializing local Git repository..."
    git init
    git branch -m main
    git remote add origin https://github.com/toilahung1/genztech.git
else
    echo "✅ Local Git repository already initialized."
    # Ensure remote is set correctly
    git remote remove origin 2>/dev/null
    git remote add origin https://github.com/toilahung1/genztech.git
fi

# 2. Configure default git identity if not set
if [ -z "$(git config user.name)" ]; then
    echo "👤 Setting Git user name..."
    git config user.name "Dong Hung"
fi
if [ -z "$(git config user.email)" ]; then
    echo "📧 Setting Git user email..."
    git config user.email "donghung@genztechcorp.com"
fi

# 3. Add files and commit
echo "📦 Staging files..."
git add .

echo "💾 Committing changes..."
git commit -m "feat: Integrate Google Workspace navigation and skeleton views (Gmail, Sheets, Calendar, Drive)"

# 4. Push to remote
echo "📤 Pushing to GitHub (origin main)..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "🎉 Successfully pushed to GitHub! Railway will auto-redeploy."
else
    echo "⚠️ Push failed. This might be due to branch history conflicts."
    echo "If you want to overwrite the remote branch with your local workspace, run:"
    echo "  git push -f origin main"
fi
