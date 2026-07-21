# Form Rendering Reference

## 🎯 Key Parts That Affect Form Rendering

### 1. **FormRenderer.renderForm()** - Lines ~372-449

**What it does:** Main entry point for rendering the entire form

- Creates the form container
- Loops through all fields and calls `renderField()`
- Renders the submit button
- Handles form submission

**When to edit:**

- Changing overall form structure
- Modifying submit button
- Adding form-level features

---

### 2. **FormRenderer.renderField()** - Lines ~451-614

**What it does:** Renders individual form fields based on type

- Handles: `text`, `email`, `phone`, `number`, `textarea`, `select`
- Routes `radio-group` to `renderRadioGroup()`
- Creates labels, inputs, and error containers

**When to edit:**

- Adding new field types
- Changing input styling
- Modifying field validation
- Updating label/placeholder logic

---

### 3. **FormRenderer.renderRadioGroup()** - Lines ~616-750 ⭐ **MOST IMPORTANT FOR RADIO BUTTONS**

**What it does:** Renders radio group fields with options

- Creates radio input elements
- Handles product associations
- Styles radio options
- Manages selection state

**Key code sections:**

```javascript
// Line ~668-680: Creates radio input element
const radio = document.createElement("input");
radio.type = "radio";
radio.name = field.name;
radio.value = option.value;
radio.id = `${field.id}_${option.id}`;
radio.required = field.required;
// ... styling and attributes

// Line ~650-666: Creates option container (label)
const optionContainer = createElement("label", {
  className: "crm-form-radio-option",
  htmlFor: `${field.id}_${option.id}`,
  // ... styling
});
```

**When to edit:**

- Radio buttons not showing → Check this method
- Radio button styling → Modify container styles
- Product display → Update product lookup logic
- Selection behavior → Modify event handlers

---

### 4. **ApiClient.fetchFormSchema()** - Lines ~190-281

**What it does:** Fetches form data from Supabase

- Gets form schema from database
- Fetches product names for radio groups
- Returns form data with products array

**When to edit:**

- Changing API endpoints
- Modifying product fetching logic
- Adding cache-busting
- Error handling improvements

---

### 5. **FormState.selectRadioOption()** - Lines ~173-183

**What it does:** Handles radio option selection

- Updates form field value
- Sets product quantities from selected option

**When to edit:**

- Changing how radio selection works
- Modifying product quantity logic

---

## 📍 Quick Location Guide

| What You Want to Change | File        | Line Range                 |
| ----------------------- | ----------- | -------------------------- |
| Radio button appearance | `embed.js`  | ~616-750                   |
| Radio button creation   | `embed.js`  | ~668-680                   |
| Form structure          | `embed.js`  | ~372-449                   |
| Input fields            | `embed.js`  | ~451-614                   |
| Form styling            | `embed.css` | All                        |
| Radio group styling     | `embed.css` | Search `.crm-form-radio-*` |
| Product fetching        | `embed.js`  | ~232-271                   |
| Form submission         | `embed.js`  | ~442-445, ~750-850         |

---

## 🔍 Finding Specific Code

### Radio Button Creation

```bash
# Search for radio input creation
grep -n "document.createElement('input')" scripts/embed.js
grep -n "radio.type = 'radio'" scripts/embed.js
```

### Radio Group Rendering

```bash
# Search for renderRadioGroup method
grep -n "renderRadioGroup" scripts/embed.js
```

### Form Field Rendering

```bash
# Search for renderField method
grep -n "renderField" scripts/embed.js
```

---

## 🧪 Testing Checklist

After editing any of these sections:

1. **Copy to public folder:**

   ```bash
   cp scripts/embed.js public/embed.js
   ```

2. **Open test file:**
   - `test-form-local.html` (loads from `public/embed.js`)

3. **Check browser console:**
   - Look for SDK version log
   - Check for errors
   - Verify form renders

4. **Test specific feature:**
   - If editing radio groups → Test radio buttons
   - If editing fields → Test all field types
   - If editing styling → Check appearance

---

## 💡 Common Edits

### Making Radio Buttons Bigger

**Location:** `renderRadioGroup()` around line ~680

```javascript
radio.style.width = "1.5rem"; // Change from 1.25rem
radio.style.height = "1.5rem"; // Change from 1.25rem
```

### Changing Radio Button Color

**Location:** `renderRadioGroup()` around line ~680

```javascript
radio.style.accentColor = "#your-color"; // Change from "#111"
```

### Adding Product Names to Radio Options

**Location:** `renderRadioGroup()` around line ~690-720

- Look for product lookup logic
- Add product name display if needed

### Changing Form Width

**Location:** `renderForm()` around line ~385

```javascript
style: {
  maxWidth: "800px", // Change from "600px"
  // ...
}
```

---

## 🚨 Important Notes

1. **Always copy to `public/` folder** after editing `scripts/`
2. **Test locally first** with `test-form-local.html`
3. **Check browser console** for errors
4. **Radio buttons** are created with `document.createElement('input')` directly
5. **Product names** are fetched separately and stored in `this.allProducts`
