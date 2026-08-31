# Fix: Vercel Not Reflecting embed.js Changes

## Problem
Changes to `embed.js` weren't showing up on Vercel because of aggressive caching.

## Solutions Applied

### 1. Fixed Cache Headers in `vercel.json`
Changed from:
```json
"Cache-Control": "public, max-age=31536000, immutable"
```

To:
```json
"Cache-Control": "public, max-age=3600, must-revalidate"
```

**What this does:**
- `max-age=3600`: Cache for 1 hour (still good performance)
- `must-revalidate`: Browser must check with server after cache expires
- Removed `immutable`: Allows files to be updated

### 2. Verified Vite Build Configuration
- Added `copyPublicDir: true` to ensure `public/` folder is copied
- Added `publicDir: 'public'` to explicitly set the public directory

## Deployment Steps

### Step 1: Copy Updated Files
```bash
# Make sure your changes are in scripts/embed.js
cp scripts/embed.js public/embed.js
cp scripts/embed.css public/embed.css
```

### Step 2: Commit and Push
```bash
git add public/embed.js public/embed.css vercel.json vite.config.ts
git commit -m "Fix cache headers and build config for embed.js updates"
git push
```

### Step 3: Wait for Vercel Deployment
1. Go to Vercel dashboard
2. Wait for deployment to complete (usually 1-2 minutes)
3. Check deployment logs to ensure files are copied

### Step 4: Clear Browser Cache
After deployment:
- **Hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache completely

### Step 5: Verify Changes
```bash
# Check if new file is deployed
curl -I https://app.numbatrak.io/embed.js

# Should see:
# Cache-Control: public, max-age=3600, must-revalidate
```

## Alternative: Add Versioning (Recommended for Production)

For better cache control, you can add versioning to the filename:

### Option A: Query Parameter (Easiest)
In your WordPress plugin or HTML:
```html
<script src="https://app.numbatrak.io/embed.js?v=2"></script>
```

Update the version number when you deploy changes.

### Option B: Filename Versioning (Better)
Use build process to add hash to filename:
```javascript
// In vite.config.ts
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'embed.[hash].js',
      assetFileNames: 'embed.[hash].[ext]'
    }
  }
}
```

Then update your WordPress plugin to use the hashed filename.

## Testing Locally

1. **Test build output**:
   ```bash
   npm run build
   ls -la build/embed.js  # Should exist
   ```

2. **Test locally**:
   ```bash
   npm run dev
   # Visit http://localhost:3000/embed.js
   ```

3. **Test production**:
   ```bash
   curl https://app.numbatrak.io/embed.js | head -20
   ```

## Troubleshooting

### Still seeing old version?

1. **Check deployment status**:
   - Go to Vercel dashboard
   - Verify latest deployment completed successfully
   - Check build logs for errors

2. **Verify file in build output**:
   ```bash
   npm run build
   cat build/embed.js | head -20  # Check if your changes are there
   ```

3. **Force cache clear**:
   - Add `?v=NEW_VERSION` to embed.js URL
   - Or use incognito/private browsing mode

4. **Check CDN cache**:
   - Vercel uses CDN caching
   - May take a few minutes to propagate globally
   - Try accessing from different location/VPN

### Build not copying files?

1. **Check public folder exists**:
   ```bash
   ls -la public/embed.js
   ```

2. **Verify vite.config.ts**:
   - `publicDir: 'public'` should be set
   - `copyPublicDir: true` in build config

3. **Check build output**:
   ```bash
   npm run build
   ls -la build/embed.js  # Should exist
   ```

## Best Practices Going Forward

1. **Always copy files before committing**:
   ```bash
   cp scripts/embed.js public/embed.js
   ```

2. **Use version numbers**:
   - Update version in WordPress plugin when deploying
   - Or use query parameters: `?v=2`, `?v=3`, etc.

3. **Test locally first**:
   - Use `test-form-local.html` to test changes
   - Verify before pushing to production

4. **Monitor deployments**:
   - Check Vercel dashboard after each push
   - Verify build logs show no errors
