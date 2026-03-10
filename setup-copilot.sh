#!/bin/bash
# setup-copilot.sh - Quick setup for GitHub Copilot compatibility

set -e

echo "🚀 Setting up Babysitter for GitHub Copilot..."
echo ""

# Check if running in Babysitter repository
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from Babysitter repository root"
    exit 1
fi

# 1. Copy Copilot instructions to workspace
echo "📋 Step 1: Checking Copilot instructions..."
if [ ! -f ".github/copilot-instructions.md" ]; then
    echo "⚠️  .github/copilot-instructions.md not found (already created in conversion)"
else
    echo "✅ Copilot instructions already in place"
fi

# 2. Check SDK installation
echo ""
echo "📦 Step 2: Checking SDK installation..."
if command -v babysitter &> /dev/null; then
    SDK_VERSION=$(babysitter --version 2>&1 | head -1 || echo "unknown")
    echo "✅ SDK installed: $SDK_VERSION"
else
    echo "⚠️  SDK not installed globally"
    echo "   Install with: npm install -g @a5c-ai/babysitter-sdk"
fi

# 3. Check VS Code extension
echo ""
echo "🔌 Step 3: Checking VS Code extension..."
if [ -f "packages/vscode-extension/package.json" ]; then
    echo "✅ Extension source found"
    
    if [ -f "packages/vscode-extension/dist/extension.js" ]; then
        echo "✅ Extension compiled"
    else
        echo "⚠️  Extension not compiled"
        echo "   Build with: cd packages/vscode-extension && npm run build"
    fi
else
    echo "❌ Extension source not found"
fi

# 4. Check for .vsix package
echo ""
echo "📦 Step 4: Checking for VSIX package..."
VSIX_COUNT=$(find . -maxdepth 2 -name "babysitter-vscode-*.vsix" 2>/dev/null | wc -l)
if [ "$VSIX_COUNT" -gt 0 ]; then
    VSIX_FILE=$(find . -maxdepth 2 -name "babysitter-vscode-*.vsix" | head -1)
    echo "✅ VSIX package found: $VSIX_FILE"
else
    echo "⚠️  No VSIX package found"
    echo "   Build with: cd packages/vscode-extension && npm run package"
fi

# 5. Summary and next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Setup Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Conversion Status:"
echo "  ✅ Copilot instructions (.github/copilot-instructions.md)"
echo "  ✅ Chat participant code (src/copilot/participant.ts)"
echo "  ✅ Documentation (docs/copilot-participant.md)"
echo "  ✅ Conversion guide (COPILOT_CONVERSION.md)"
echo ""
echo "Next Steps:"
echo ""
echo "  1️⃣  Install SDK globally (optional):"
echo "     npm install -g @a5c-ai/babysitter-sdk"
echo ""
echo "  2️⃣  Build VS Code extension:"
echo "     cd packages/vscode-extension"
echo "     npm install"
echo "     npm run build"
echo "     npm run package"
echo ""
echo "  3️⃣  Install extension:"
echo "     code --install-extension babysitter-vscode-*.vsix"
echo ""
echo "  4️⃣  Restart VS Code"
echo ""
echo "  5️⃣  Test in Copilot Chat:"
echo "     @babysitter help"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Documentation:"
echo "  - .github/copilot-instructions.md - How to use with Copilot"
echo "  - docs/copilot-participant.md - @babysitter commands"
echo "  - COPILOT_CONVERSION.md - Full conversion guide"
echo ""
echo "✅ Conversion complete! See COPILOT_CONVERSION.md for details."
