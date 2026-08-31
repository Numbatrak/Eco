# Embed SDK Hosting Guide

This guide explains how to host the embed SDK files (`embed.js` and `embed.css`) so they can be accessed from WordPress and other external sites.

## ✅ What's Already Set Up

1. **Files Created**: 
   - `public/embed.js` - JavaScript SDK
   - `public/embed.css` - CSS styles

2. **Vercel Configuration**: 
   - CORS headers configured in `vercel.json`
   - Files will be served at: `https://your-vercel-domain.com/embed.js` and `https://your-vercel-domain.com/embed.css`

## 🚀 Deployment Steps

### Option 1: Deploy to Vercel (Recommended)

1. **Commit and Push**:
   ```bash
   git add public/embed.js public/embed.css vercel.json
   git commit -m "Add embed SDK files for hosting"
   git push
   ```

2. **Deploy to Vercel**:
   - If you haven't connected your repo to Vercel:
     - Go to [vercel.com](https://vercel.com)
     - Import your repository
     - Vercel will auto-detect Vite and deploy
   
   - If already connected:
     - Push to your main branch (auto-deploys)
     - Or manually deploy from Vercel dashboard

3. **Get Your URLs**:
   After deployment, your files will be available at:
   - `https://app.numbatrak.io/embed.js`
   - `https://app.numbatrak.io/embed.css`
   
   Or if you have a custom domain:
   - `https://yourdomain.com/embed.js`
   - `https://yourdomain.com/embed.css`

4. **Test Access**:
   ```bash
   curl https://app.numbatrak.io/embed.js
   curl https://app.numbatrak.io/embed.css
   ```
   
   You should see the file contents. Check for CORS headers:
   ```bash
   curl -I https://app.numbatrak.io/embed.js
   ```
   
   Should include: `Access-Control-Allow-Origin: *`

### Option 2: Alternative Hosting Options

If you prefer not to use Vercel, here are other options:

#### A. Cloudflare Pages
1. Connect your repo to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `build`
4. Add CORS headers via Cloudflare Workers or `_headers` file

#### B. Netlify
1. Connect your repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `build`
4. Create `public/_headers` file:
   ```
   /embed.js
     Access-Control-Allow-Origin: *
     Content-Type: application/javascript
   
   /embed.css
     Access-Control-Allow-Origin: *
     Content-Type: text/css
   ```

#### C. AWS S3 + CloudFront
1. Upload files to S3 bucket
2. Enable static website hosting
3. Configure CloudFront distribution
4. Add CORS headers in S3 bucket policy

#### D. GitHub Pages
1. Build your project: `npm run build`
2. Copy `build/embed.js` and `build/embed.css` to `docs/` folder
3. Enable GitHub Pages in repo settings
4. Note: GitHub Pages doesn't support custom headers, so CORS might be limited

## 🔧 Configuration

### CORS Headers

The files are configured with these CORS headers (in `vercel.json`):
- `Access-Control-Allow-Origin: *` - Allows any domain to access
- `Content-Type` - Proper MIME types
- `Cache-Control` - Long-term caching for performance

### Updating Files

When you update `scripts/embed.js` or `scripts/embed.css`:

1. Copy updated files to `public/`:
   ```bash
   cp scripts/embed.js public/embed.js
   cp scripts/embed.css public/embed.css
   ```

2. Commit and push:
   ```bash
   git add public/embed.js public/embed.css
   git commit -m "Update embed SDK"
   git push
   ```

3. Vercel will auto-deploy the changes

## ✅ Testing

### 1. Test File Access
```bash
# Test JavaScript file
curl https://app.numbatrak.io/embed.js

# Test CSS file
curl https://app.numbatrak.io/embed.css

# Test CORS headers
curl -I https://app.numbatrak.io/embed.js
```

### 2. Test in Browser
Create a test HTML file:
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://app.numbatrak.io/embed.css">
</head>
<body>
  <div id="crm-form" data-form-token="your-form-token"></div>
  
  <script>
    window.CRM_SUPABASE_URL = 'https://tgyetavhkukcclnwrroz.supabase.co';
    window.CRM_SUPABASE_ANON_KEY = 'your-anon-key';
  </script>
  <script src="https://app.numbatrak.io/embed.js"></script>
</body>
</html>
```

Open in browser and check:
- No CORS errors in console
- Form loads correctly
- Network tab shows files loaded successfully

### 3. Test from WordPress
1. Install WordPress plugin
2. Configure embed URLs:
   - JS URL: `https://app.numbatrak.io/embed.js`
   - CSS URL: `https://app.numbatrak.io/embed.css`
3. Create test page with form shortcode
4. Verify form loads without errors

## 🐛 Troubleshooting

### CORS Errors
- **Symptom**: Browser console shows CORS error
- **Solution**: 
  - Verify `Access-Control-Allow-Origin: *` header is present
  - Check `vercel.json` configuration
  - Ensure files are deployed correctly

### 404 Not Found
- **Symptom**: Files return 404
- **Solution**:
  - Verify files exist in `public/` directory
  - Check build output includes files
  - Verify Vercel deployment succeeded
  - Check file paths are correct (case-sensitive)

### Files Not Updating
- **Symptom**: Changes not reflected after deployment
- **Solution**:
  - Clear browser cache
  - Check deployment logs in Vercel
  - Verify files were committed and pushed
  - Add cache-busting query params: `?v=2`

## 📝 Next Steps

After hosting is set up:

1. ✅ Update WordPress plugin configuration with your embed URLs
2. ✅ Test form submission end-to-end
3. ✅ Monitor Vercel deployment logs
4. ✅ Set up custom domain (optional but recommended)

## 🔗 Related Files

- Embed SDK: `scripts/embed.js` and `scripts/embed.css`
- Documentation: `scripts/embed-sdk-README.md`
- Vercel Config: `vercel.json`
- Quick Start: `QUICK_START_CHECKLIST.md`
