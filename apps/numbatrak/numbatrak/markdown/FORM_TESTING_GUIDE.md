# Form Testing Guide

## 🧪 Testing Form Changes Before Pushing

This guide helps you test changes to `embed.js` and `embed.css` locally before deploying to production.

## 📁 Files That Affect Form Rendering

### Key Parts in `embed.js`:

1. **`FormRenderer.renderForm()`** (lines ~372-449)
   - Main form rendering logic
   - Creates the form container and structure
   - Renders all fields and submit button

2. **`FormRenderer.renderField()`** (lines ~451-614)
   - Renders individual form fields
   - Handles: text, email, phone, number, textarea, select
   - Routes radio-group fields to `renderRadioGroup()`

3. **`FormRenderer.renderRadioGroup()`** (lines ~616-750)
   - **Most important for radio buttons**
   - Creates radio input elements
   - Handles product associations
   - Styling and layout of radio options

4. **`ApiClient.fetchFormSchema()`** (lines ~190-281)
   - Fetches form data from Supabase
   - Fetches product names for radio groups
   - Returns form schema and products

5. **`FormState.selectRadioOption()`** (lines ~173-183)
   - Handles radio option selection
   - Updates product quantities

### Key Parts in `embed.css`:

- All styles for `.crm-form-*` classes
- Radio group styling (`.crm-form-radio-group`, `.crm-form-radio-option`)
- Form input styling
- Submit button styling

## 🚀 Testing Workflow

### Step 1: Make Changes

Edit the source files:

- `scripts/embed.js` - JavaScript logic
- `scripts/embed.css` - CSS styles

### Step 2: Copy to Public Folder

```bash
# Copy updated files to public folder
cp scripts/embed.js public/embed.js
cp scripts/embed.css public/embed.css
```

### Step 3: Test Locally

1. **Open `test-form-local.html` in your browser**
   - This loads from `public/embed.js` and `public/embed.css`
   - Update the form token and Supabase key in the HTML file
   - Test all form functionality

2. **Check Browser Console**
   - Look for SDK version logs
   - Check for any JavaScript errors
   - Verify form fields render correctly
   - Test radio groups specifically

### Step 4: Test Production (After Push)

1. **Push to Git**

   ```bash
   git add public/embed.js public/embed.css
   git commit -m "Update embed SDK"
   git push
   ```

2. **Wait for Vercel Deployment**
   - Check Vercel dashboard for deployment status
   - Usually takes 1-2 minutes

3. **Open `test-form-production.html`**
   - This loads from `https://mail9ja.vercel.app/embed.js`
   - Verify production version works
   - Compare with local version

## 📝 Test HTML Files

### `test-form-local.html`

- Loads from `./public/embed.js` and `./public/embed.css`
- Use this for **local testing** before pushing
- Update form token and Supabase key before testing

### `test-form-production.html`

- Loads from `https://mail9ja.vercel.app/embed.js`
- Use this to **verify production deployment**
- Same setup as WordPress sites

## 🔧 Quick Test Commands

```bash
# Copy files for testing
cp scripts/embed.js public/embed.js
cp scripts/embed.css public/embed.css

# Open local test file
open test-form-local.html
# Or
python3 -m http.server 8000
# Then visit http://localhost:8000/test-form-local.html
```

## ✅ What to Test

1. **Form Loading**
   - Form appears without errors
   - Loading state shows correctly
   - Error messages display if form not found

2. **Field Rendering**
   - All field types render correctly
   - Labels and placeholders show
   - Required fields marked with \*

3. **Radio Groups** (Critical)
   - Radio buttons appear and are clickable
   - Radio buttons are visible (not hidden)
   - Product names display correctly (if configured)
   - Selection updates product quantities

4. **Form Submission**
   - Validation works
   - Submit button triggers submission
   - Success/error messages display

5. **Styling**
   - Form looks correct
   - Radio buttons styled properly
   - Responsive on mobile

## 🐛 Common Issues

### Radio Buttons Not Showing

- Check `renderRadioGroup()` method
- Verify `document.createElement('input')` sets `type="radio"`
- Check CSS for visibility issues

### Form Not Loading

- Check browser console for errors
- Verify Supabase URL and key
- Check form token is correct

### Changes Not Reflecting

- Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- Verify you copied files to `public/` folder
- Check you're testing the right file (local vs production)

## 📋 Pre-Push Checklist

- [ ] Made changes to `scripts/embed.js` or `scripts/embed.css`
- [ ] Copied files to `public/` folder
- [ ] Tested locally with `test-form-local.html`
- [ ] All form fields render correctly
- [ ] Radio groups work properly
- [ ] Form submission works
- [ ] No console errors
- [ ] Ready to commit and push
