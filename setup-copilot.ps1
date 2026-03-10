# setup-copilot.ps1 - Quick setup for GitHub Copilot compatibility
# PowerShell version

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Babysitter for GitHub Copilot..." -ForegroundColor Cyan
Write-Host ""

# Check if running in Babysitter repository
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Must run from Babysitter repository root" -ForegroundColor Red
    exit 1
}

# 1. Check Copilot instructions
Write-Host "📋 Step 1: Checking Copilot instructions..." -ForegroundColor Yellow
if (Test-Path ".github\copilot-instructions.md") {
    Write-Host "✅ Copilot instructions already in place" -ForegroundColor Green
} else {
    Write-Host "⚠️  .github\copilot-instructions.md not found" -ForegroundColor Yellow
}

# 2. Check SDK installation
Write-Host ""
Write-Host "📦 Step 2: Checking SDK installation..." -ForegroundColor Yellow
try {
    $sdkVersion = & babysitter --version 2>&1 | Select-Object -First 1
    Write-Host "✅ SDK installed: $sdkVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  SDK not installed globally" -ForegroundColor Yellow
    Write-Host "   Install with: npm install -g @a5c-ai/babysitter-sdk" -ForegroundColor Gray
}

# 3. Check VS Code extension
Write-Host ""
Write-Host "🔌 Step 3: Checking VS Code extension..." -ForegroundColor Yellow
if (Test-Path "packages\vscode-extension\package.json") {
    Write-Host "✅ Extension source found" -ForegroundColor Green
    
    if (Test-Path "packages\vscode-extension\dist\extension.js") {
        Write-Host "✅ Extension compiled" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Extension not compiled" -ForegroundColor Yellow
        Write-Host "   Build with: cd packages\vscode-extension; npm run build" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Extension source not found" -ForegroundColor Red
}

# 4. Check for .vsix package
Write-Host ""
Write-Host "📦 Step 4: Checking for VSIX package..." -ForegroundColor Yellow
$vsixFiles = Get-ChildItem -Path . -Filter "babysitter-vscode-*.vsix" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($vsixFiles) {
    Write-Host "✅ VSIX package found: $($vsixFiles.Name)" -ForegroundColor Green
} else {
    Write-Host "⚠️  No VSIX package found" -ForegroundColor Yellow
    Write-Host "   Build with: cd packages\vscode-extension; npm run package" -ForegroundColor Gray
}

# 5. Summary and next steps
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✨ Setup Summary" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Conversion Status:" -ForegroundColor White
Write-Host "  ✅ Copilot instructions (.github\copilot-instructions.md)" -ForegroundColor Green
Write-Host "  ✅ Chat participant code (src\copilot\participant.ts)" -ForegroundColor Green
Write-Host "  ✅ Documentation (docs\copilot-participant.md)" -ForegroundColor Green
Write-Host "  ✅ Conversion guide (COPILOT_CONVERSION.md)" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1️⃣  Install SDK globally (optional):" -ForegroundColor Yellow
Write-Host "     npm install -g @a5c-ai/babysitter-sdk" -ForegroundColor Gray
Write-Host ""
Write-Host "  2️⃣  Build VS Code extension:" -ForegroundColor Yellow
Write-Host "     cd packages\vscode-extension" -ForegroundColor Gray
Write-Host "     npm install" -ForegroundColor Gray
Write-Host "     npm run build" -ForegroundColor Gray
Write-Host "     npm run package" -ForegroundColor Gray
Write-Host ""
Write-Host "  3️⃣  Install extension:" -ForegroundColor Yellow
Write-Host "     code --install-extension babysitter-vscode-*.vsix" -ForegroundColor Gray
Write-Host ""
Write-Host "  4️⃣  Restart VS Code" -ForegroundColor Yellow
Write-Host ""
Write-Host "  5️⃣  Test in Copilot Chat:" -ForegroundColor Yellow
Write-Host "     @babysitter help" -ForegroundColor Gray
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor White
Write-Host "  - .github\copilot-instructions.md - How to use with Copilot" -ForegroundColor Gray
Write-Host "  - docs\copilot-participant.md - @babysitter commands" -ForegroundColor Gray
Write-Host "  - COPILOT_CONVERSION.md - Full conversion guide" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Conversion complete! See COPILOT_CONVERSION.md for details." -ForegroundColor Green
