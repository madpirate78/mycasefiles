# GitHub Releases Setup Guide for MyCaseFiles

This guide provides step-by-step instructions for setting up GitHub releases to distribute Windows installation packages for MyCaseFiles.

## 📋 Overview

- **Goal**: Create Windows installer (.exe) files distributed via GitHub Releases
- **Approach**: GitHub Actions automatically builds and publishes releases when you create version tags
- **Target**: Windows x64 systems with NSIS installer
- **Repository**: Works with private repositories

## 🏗️ What's Already Configured

### ✅ Package.json Configuration
- `electron-builder` configured for Windows NSIS installer
- GitHub publish provider settings for private repository
- Version management scripts (`npm run version-patch`, etc.)
- Build scripts optimized for Windows target

### ✅ GitHub Actions Workflows (Efficient Strategy)
- **Release Workflow** (`.github/workflows/release.yml`): Builds and publishes on tag push only
- **Build Test Workflow** (`.github/workflows/build-test.yml`): Manual trigger + PR testing (no automatic builds on commits)

### ✅ Build Configuration
- Windows x64 target with NSIS installer
- Desktop shortcuts and start menu integration
- Proper app metadata and branding
- Local build optimization (excludes Linux/Mac unless needed)

## 🚀 How to Create Your First Release

### Step 1: Create a Version Tag
From your project directory, run one of these commands:

```bash
# For patch releases (0.1.0 → 0.1.1)
npm run version-patch

# For minor releases (0.1.0 → 0.2.0)  
npm run version-minor

# For major releases (0.1.0 → 1.0.0)
npm run version-major
```

This will:
1. Increment the version in `package.json`
2. Create a Git tag (e.g., `v0.1.1`)
3. Push the tag to GitHub
4. Automatically trigger the GitHub Actions build

### Step 2: Monitor the Build
1. Go to your GitHub repository
2. Click **Actions** tab
3. Watch the "Build and Release" workflow
4. Build takes ~10-15 minutes on GitHub's Windows runners

### Step 3: Download Your Release
1. Go to **Releases** section in your GitHub repository
2. Find your new release (e.g., `v0.1.1`)
3. Download the `.exe` installer file
4. Run on your Windows machine to test

## 🔧 Manual Release (Alternative)

If you prefer manual control:

```bash
# Build locally (for testing - won't work on WSL)
npm run dist

# Or trigger GitHub Actions manually
# Go to Actions → Build and Release → Run workflow
```

## 📦 What Gets Built

Your release will include:
- **`My Case Files Setup X.X.X.exe`** - Windows installer (NSIS)
- **`My-Case-Files-X.X.X-win.zip`** - Portable version (optional)
- **`latest.yml`** - Update metadata (for future auto-updates)

## 🎯 Installation Experience

Users installing your app will get:
- **Standard Windows installer** with options for installation directory
- **Desktop shortcut** created automatically
- **Start menu entry** under "My Case Files"
- **Uninstaller** available in Windows Settings

## 🔒 Security & Privacy

### Private Repository Access
- GitHub Actions automatically have access to build and create releases
- Users need GitHub account access to download from private repository
- Consider making repository public for wider distribution

### Code Signing (Future Enhancement)
- Current releases will show "Unknown publisher" warnings
- For production, consider purchasing code signing certificate
- Users can still install by clicking "More info" → "Run anyway"

### Manual Testing
```bash
# Build without publishing
npm run dist

# Build and publish to GitHub
npm run dist-publish
```

## 🎯 Efficient Build Strategy

### When Builds Trigger
- ✅ **Version tags**: Automatic release builds (`npm run version-patch`)
- ✅ **Manual trigger**: Go to Actions → Build Test → Run workflow  
- ✅ **Pull requests**: Automatic builds for code review
- ❌ **Regular commits**: No automatic builds (saves GitHub Actions minutes)

### Development Workflow
```bash
# Daily development - no builds triggered
git add .
git commit -m "Feature updates"
git push origin master  # ← No build triggered

# When you want to test a build
# Go to GitHub → Actions → Build Test → Run workflow

# When ready for release
npm run version-patch  # ← Triggers release build automatically
```

## 🛠️ Troubleshooting

### Build Fails
1. Check **Actions** tab for detailed error logs
2. Common issues:
   - Node.js version mismatch (workflow uses Node 18)
   - Missing dependencies
   - Icon file issues

### Release Not Created
1. Verify tag was pushed: `git tag -l`
2. Check workflow was triggered in **Actions** tab
3. Ensure `GITHUB_TOKEN` has proper permissions

### No Test Builds Triggering
- **Expected behavior**: Test builds are manual-only to save GitHub Actions minutes
- **To trigger**: Go to Actions → Build Test → Run workflow
- **Alternative**: Create a pull request (auto-triggers build)

### Local Build Issues (WSL/Linux)
- Windows builds require Wine on Linux/WSL
- Install Wine: `sudo apt install wine`
- Or rely on GitHub Actions for building (recommended)

## 📋 Development Workflow

### Daily Development
```bash
# Your normal development (unchanged)
npm run dev-electron
```

### Testing Builds
```bash
# Test on GitHub Actions (recommended)
git push origin master  # Triggers build-test workflow

# Download test build from Actions → Artifacts
```

### Creating Releases
```bash
# When ready for release
npm run version-patch  # or minor/major
# Automatically triggers release build
```

## 🔄 Version Management

### Semantic Versioning
- **Patch** (0.1.0 → 0.1.1): Bug fixes, small improvements
- **Minor** (0.1.0 → 0.2.0): New features, enhancements  
- **Major** (0.1.0 → 1.0.0): Breaking changes, major redesigns

### Pre-release Versions
For beta/alpha releases:
```bash
npm version prerelease --preid=beta  # 0.1.0 → 0.1.1-beta.0
git push origin master --tags
```

## 🎯 Next Steps

### Immediate
1. **Test First Release**: Run `npm run version-patch` to create v0.1.1
2. **Download & Install**: Test the installer on Windows machine
3. **Verify Functionality**: Ensure all features work in installed version

### Future Enhancements
1. **Auto-Updates**: Implement electron-updater (see AUTO_UPDATE_IMPLEMENTATION.md)
2. **Code Signing**: Purchase certificate for trusted installations
3. **Multi-Platform**: Add macOS and Linux support
4. **Beta Channel**: Separate beta releases for testing

## 📚 Additional Resources

- [electron-builder Documentation](https://www.electron.build/)
- [GitHub Actions for Electron](https://docs.github.com/en/actions)
- [NSIS Installer Options](https://www.electron.build/configuration/nsis)

---

## 🎉 Success Metrics

Once setup is complete, you should be able to:
- ✅ Create releases with a single command (`npm run version-patch`)
- ✅ Automatically build Windows installers via GitHub Actions
- ✅ Download and install on Windows machines
- ✅ Distribute to users via GitHub Releases (private repo)
- ✅ Track versions and manage updates systematically

**Ready to create your first release? Run `npm run version-patch` and watch the magic happen!** 🚀