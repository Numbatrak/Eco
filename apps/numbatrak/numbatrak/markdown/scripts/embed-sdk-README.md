# CRM Form Embed SDK

Lightweight JavaScript SDK for embedding dynamic forms in WordPress and other websites.

## Features

✅ **Schema-Driven Rendering** - Fetches form schema from API and renders dynamically  
✅ **Product Selectors** - Quantity controls for products with min/max validation  
✅ **Incentive Support** - Displays and handles incentive products  
✅ **Abandoned Cart Detection** - Fires event after 30 seconds of inactivity  
✅ **Secure Submission** - Submits orders to Supabase Edge Function  
✅ **Validation** - Client-side validation for required fields  
✅ **Error Handling** - Graceful error handling and user feedback  
✅ **Lightweight** - No dependencies, vanilla JavaScript  
✅ **Cross-Browser** - Works in all modern browsers  

## Installation

### Option 1: Direct Script Include

```html
<!-- In your WordPress page/post or theme -->
<div id="crm-form" data-form-token="form_live_98Fh3ksd"></div>

<link rel="stylesheet" href="https://app.numbatrak.io/embed.css">
<script>
  window.CRM_SUPABASE_URL = 'https://tgyetavhkukcclnwrroz.supabase.co';
  window.CRM_SUPABASE_ANON_KEY = 'your-anon-key';
</script>
<script src="https://app.numbatrak.io/embed.js"></script>
```

### Option 2: WordPress Plugin

The WordPress plugin should enqueue these files:

```php
wp_enqueue_style('crm-form-embed', 'https://app.numbatrak.io/embed.css');
wp_enqueue_script('crm-form-embed', 'https://app.numbatrak.io/embed.js', [], '1.0.0', true);
wp_localize_script('crm-form-embed', 'crmFormConfig', [
    'supabaseUrl' => 'https://tgyetavhkukcclnwrroz.supabase.co',
    'supabaseAnonKey' => 'your-anon-key'
]);
```

## Configuration

Set these global variables before loading the script:

```javascript
window.CRM_SUPABASE_URL = 'https://tgyetavhkukcclnwrroz.supabase.co';
window.CRM_SUPABASE_ANON_KEY = 'your-anon-key';
window.CRM_DEBUG = true; // Optional: Enable debug logging
```

## Usage

### Basic Usage

```html
<div id="crm-form" data-form-token="form_live_98Fh3ksd"></div>
```

### Multiple Forms on Same Page

```html
<div id="crm-form" data-form-token="form_live_98Fh3ksd"></div>
<div id="crm-form" data-form-token="form_live_abc123"></div>
```

The SDK automatically finds all containers with `data-form-token` attribute.

## How It Works

### 1. Initialization

When the page loads, the SDK:
- Finds all form containers with `data-form-token`
- Fetches form schema from Supabase
- Renders form fields dynamically
- Sets up event listeners

### 2. Form Schema Fetching

```javascript
GET /rest/v1/forms?form_token=eq.{token}&select=*
GET /rest/v1/form_products?form_id=eq.{id}&select=*,products(*)&order=display_order
GET /rest/v1/form_incentives?form_id=eq.{id}&select=*,products(*)&order=display_order
```

### 3. Dynamic Rendering

The SDK renders:
- **Form Fields**: Based on `schema.fields` array
  - Text inputs
  - Email inputs
  - Phone inputs
  - Number inputs
  - Textareas
  - Select dropdowns

- **Products**: From `form_products` table
  - Product name and price
  - Quantity selector (respects min/max)
  - Required indicator

- **Incentives**: From `form_incentives` table
  - Auto-applied incentives
  - Conditional incentives

### 4. Abandoned Cart Detection

- Starts 30-second timer when user interacts with form
- Resets timer on each interaction
- Fires abandoned cart event if no submission after 30s
- Sends data to `abandoned_carts` table

**Abandoned Cart Event:**
```json
{
  "form_id": "form_live_98Fh3ksd",
  "page_url": "https://example.com/page",
  "filled_fields": ["name", "phone"],
  "field_values": {
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "selected_products": [
    {"product_id": "uuid", "quantity": 2}
  ],
  "abandoned_at": "2024-01-15T10:30:00Z"
}
```

### 5. Order Submission

When form is submitted:
- Validates required fields
- Collects all field values
- Prepares order items from selected products
- Submits to Edge Function: `POST /functions/v1/create-order-from-form`
- Shows success/error message

**Submission Payload:**
```json
{
  "form_token": "form_live_98Fh3ksd",
  "customer_name": "John Doe",
  "customer_phone": "+1234567890",
  "field_values": {
    "email": "john@example.com",
    "address": "123 Main St"
  },
  "items": [
    {"product_id": "uuid", "quantity": 2}
  ]
}
```

## Form Schema Structure

The form schema (stored in `forms.schema` JSONB column) should follow this structure:

```typescript
interface FormSchema {
  fields: FormField[];
  validation?: ValidationRules;
  submitButton?: {
    text: string;
    loadingText?: string;
  };
}

interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  validation?: FieldValidation;
  options?: Array<{value: string, label: string}>; // For select fields
}
```

**Example Schema:**
```json
{
  "fields": [
    {
      "id": "name",
      "type": "text",
      "label": "Full Name",
      "name": "customer_name",
      "required": true,
      "placeholder": "Enter your name"
    },
    {
      "id": "email",
      "type": "email",
      "label": "Email Address",
      "name": "email",
      "required": true,
      "placeholder": "your@email.com"
    },
    {
      "id": "phone",
      "type": "phone",
      "label": "Phone Number",
      "name": "phone",
      "required": true,
      "placeholder": "+1234567890"
    }
  ],
  "submitButton": {
    "text": "Place Order",
    "loadingText": "Processing..."
  }
}
```

## Styling

The SDK includes default styles in `embed.css`. You can override any class:

```css
.crm-form-container {
  /* Your custom styles */
}

.crm-form-submit {
  /* Custom button styles */
}
```

### CSS Classes

- `.crm-form-container` - Main container
- `.crm-form` - Form element
- `.crm-form-field` - Field wrapper
- `.crm-form-products` - Products section
- `.crm-form-product` - Individual product
- `.crm-form-incentives` - Incentives section
- `.crm-form-totals` - Totals display
- `.crm-form-submit` - Submit button
- `.crm-form-loading` - Loading state
- `.crm-form-error` - Error state
- `.crm-form-success` - Success state

## Events

The SDK dispatches custom events:

### `crm:totals-updated`

Fired when product quantities change:

```javascript
document.addEventListener('crm:totals-updated', (e) => {
  console.log('Products updated:', e.detail.products);
});
```

## Error Handling

The SDK handles various error scenarios:

- **Form Not Found**: Shows error message
- **Form Not Active**: Shows error message
- **Network Errors**: Shows error message
- **Validation Errors**: Highlights invalid fields
- **Submission Errors**: Shows error alert

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security

- ✅ Uses Supabase anon key (public, safe for client-side)
- ✅ Form tokens are public (scoped to organization)
- ✅ All validation happens server-side
- ✅ No secrets exposed to frontend
- ✅ CORS handled by Supabase

## Debugging

Enable debug mode:

```javascript
window.CRM_DEBUG = true;
```

This will log all SDK operations to the console.

## API Requirements

The SDK requires these Supabase tables and endpoints:

### Tables
- `forms` - Form definitions
- `form_products` - Products attached to forms
- `form_incentives` - Incentives for forms
- `products` - Product catalog
- `abandoned_carts` - Abandoned cart tracking

### Endpoints
- `GET /rest/v1/forms` - Fetch form schema
- `GET /rest/v1/form_products` - Fetch form products
- `GET /rest/v1/form_incentives` - Fetch form incentives
- `POST /rest/v1/abandoned_carts` - Submit abandoned cart
- `POST /functions/v1/create-order-from-form` - Submit order

### RLS Policies Required

```sql
-- Forms: Public read access for schema
CREATE POLICY "Forms are accessible by token"
  ON forms FOR SELECT
  USING (true);

-- Abandoned carts: Public insert
CREATE POLICY "Public can insert abandoned carts"
  ON abandoned_carts FOR INSERT
  TO anon
  WITH CHECK (true);
```

## Troubleshooting

### Form Not Loading

1. Check browser console for errors
2. Verify `CRM_SUPABASE_URL` and `CRM_SUPABASE_ANON_KEY` are set
3. Verify form token is correct
4. Check network tab for API calls

### Abandoned Cart Not Firing

1. Enable debug mode: `window.CRM_DEBUG = true`
2. Check console for timer logs
3. Verify form has been interacted with
4. Check RLS policies for `abandoned_carts` table

### Order Submission Failing

1. Check browser console for error messages
2. Verify all required fields are filled
3. Verify at least one product is selected
4. Check Edge Function logs in Supabase dashboard

## License

This SDK is part of the CRM system and follows the same license as the main project.
