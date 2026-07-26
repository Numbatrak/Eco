# Form Minimum Requirements

## Overview

To ensure that form responses can always extract constants (phone number, package name, customer name), every form **must** include minimum required fields. This document explains what fields are required and how the system validates them.

## Required Fields

Every form must have at least one field from each category below:

### 1. Customer Name (Required)

**At least one of:**
- `customer_name` - Full customer name
- `name` - Full name
- `first_name` + `last_name` - First and last name (both required if using this option)

**Examples:**
```json
// Option 1: Single field
{
  "name": "customer_name",
  "type": "text",
  "label": "Full Name",
  "required": true
}

// Option 2: Split fields
{
  "name": "first_name",
  "type": "text",
  "label": "First Name",
  "required": true
},
{
  "name": "last_name",
  "type": "text",
  "label": "Last Name",
  "required": true
}
```

### 2. Phone Number (Required)

**At least one of:**
- `customer_phone` - Customer phone number
- `phone_number` - Phone number
- `whatsapp_number` - WhatsApp number
- `phone` - Phone

**Examples:**
```json
{
  "name": "customer_phone",
  "type": "phone",
  "label": "Phone Number",
  "required": true
}
```

### 3. Package Name (Required)

**At least one of:**
- `package_name` - Package name
- `selected_package` - Selected package
- `package` - Package
- `package_type` - Package type
- **OR** a `radio-group` field for package selection

**Examples:**
```json
// Option 1: Text/Select field
{
  "name": "package_type",
  "type": "select",
  "label": "Select Package",
  "options": [
    { "value": "premium", "label": "Premium" },
    { "value": "standard", "label": "Standard" }
  ],
  "required": true
}

// Option 2: Radio group (recommended for package selection)
{
  "name": "package_selection",
  "type": "radio-group",
  "label": "Select Package",
  "required": true,
  "radioOptions": [
    {
      "label": "Premium Package",
      "value": "premium",
      "products": [...]
    }
  ]
}
```

## Validation

### Frontend Validation (Form Builder)

When saving a form in the Form Builder, the system validates that all required fields exist:

```typescript
import { validateFormSchema } from '@/utils/formValidation';

const validation = validateFormSchema(schema);
if (!validation.isValid) {
  // Show error with missing fields
  console.error('Missing fields:', validation.missingFields);
}
```

**Error Message Example:**
```
Form is missing required fields:
• Customer name field (customer_name, name, or first_name + last_name)
• Phone number field (customer_phone, phone_number, whatsapp_number, or phone)
• Package name field (package_name, selected_package, package, package_type) or radio group for package selection
```

### Backend Validation (Edge Function)

The Edge Function also validates that submitted forms include the required fields in `field_values`:

```typescript
// In create-order-from-form Edge Function
const hasCustomerName = 
  fieldValues.customer_name ||
  fieldValues.name ||
  (fieldValues.first_name && fieldValues.last_name);

if (!hasCustomerName) {
  return error("Missing customer name");
}
```

### Database Validation (Optional)

A database function can validate form schemas at the database level:

```sql
-- Validate a form schema
SELECT validate_form_schema_minimum_fields(form.schema)
FROM forms
WHERE id = 'form-id';

-- Enable trigger to validate on insert/update (optional)
CREATE TRIGGER validate_form_schema_trigger
  BEFORE INSERT OR UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION validate_form_before_save();
```

## Field Name Mapping

The system automatically maps various field names to constants:

### Customer Name Mapping
1. `customer_name` → `customer_name`
2. `name` → `customer_name`
3. `first_name` + `last_name` → `customer_name` (concatenated)

### Phone Number Mapping
1. `customer_phone` → `phone_number`
2. `phone_number` → `phone_number`
3. `whatsapp_number` → `phone_number`
4. `phone` → `phone_number`

### Package Name Mapping
1. `package_name` → `package_name`
2. `selected_package` → `package_name`
3. `package` → `package_name`
4. `package_type` → `package_name`
5. Radio group selection → `package_name` (from selected option)

## Example: Complete Form Schema

```json
{
  "fields": [
    {
      "id": "name",
      "type": "text",
      "name": "customer_name",
      "label": "Full Name",
      "required": true,
      "placeholder": "Enter your full name"
    },
    {
      "id": "phone",
      "type": "phone",
      "name": "customer_phone",
      "label": "Phone Number",
      "required": true,
      "placeholder": "+2348012345678"
    },
    {
      "id": "package",
      "type": "radio-group",
      "name": "package_selection",
      "label": "Select Package",
      "required": true,
      "radioOptions": [
        {
          "label": "Premium Package",
          "value": "premium",
          "products": [
            { "product_id": "...", "quantity": 2 }
          ]
        },
        {
          "label": "Standard Package",
          "value": "standard",
          "products": [
            { "product_id": "...", "quantity": 1 }
          ]
        }
      ]
    },
    {
      "id": "location",
      "type": "text",
      "name": "delivery_address",
      "label": "Delivery Address",
      "required": false,
      "placeholder": "Enter delivery address"
    }
  ],
  "submitButton": {
    "text": "Place Order",
    "loadingText": "Processing..."
  }
}
```

## Why These Fields Are Required

1. **Customer Name**: Needed for order identification and customer communication
2. **Phone Number**: Required for order follow-up, delivery coordination, and customer contact
3. **Package Name**: Essential for profit calculation, order processing, and inventory management

Without these fields, the system cannot:
- Extract constants for easy querying
- Calculate profit accurately
- Track orders properly
- Contact customers for follow-up

## Best Practices

1. **Use Standard Field Names**: Prefer `customer_name`, `customer_phone`, and `package_type` for consistency
2. **Make Fields Required**: Mark required fields as `required: true` in the form schema
3. **Use Radio Groups for Packages**: Radio groups with products are the recommended way to handle package selection
4. **Validate Early**: Check form schema in the Form Builder before saving
5. **Test Submissions**: Test form submissions to ensure constants are extracted correctly

## Troubleshooting

### "Form is missing required fields" Error

**Solution**: Add the missing fields to your form schema. Check the error message for which fields are missing.

### Constants Not Extracted After Submission

**Possible Causes:**
1. Field names don't match expected patterns
2. Fields are not included in `field_values` during submission
3. Database trigger didn't run

**Solution**: 
- Verify field names match one of the accepted patterns
- Check that fields are included in form submission payload
- Verify database triggers are enabled

### Phone Number Not Extracted

**Check:**
- Field name matches: `customer_phone`, `phone_number`, `whatsapp_number`, or `phone`
- Field value is included in `field_values` during submission
- Database trigger ran successfully

### Package Name Not Extracted

**Check:**
- Field name matches one of the package name patterns
- OR radio group is properly configured with products
- Selected radio option value is included in `field_values`
