# Required Fields Protection

## Overview

The Form Builder now automatically includes and protects required fields that are essential for order processing. These fields cannot be deleted and have limited editing capabilities to ensure form responses can always extract constants (phone number, package name, customer name).

## Auto-Added Required Fields

When creating a **new form**, the following fields are automatically added:

1. **Customer Name** (`customer_name`)
   - Type: Text
   - Label: "Full Name"
   - Required: Yes
   - Placeholder: "Enter your full name"

2. **Phone Number** (`customer_phone`)
   - Type: Phone
   - Label: "Phone Number"
   - Required: Yes
   - Placeholder: "+2348012345678"

3. **Package Selection** (`package_selection`)
   - Type: Radio Group
   - Label: "Select Package"
   - Required: Yes
   - Options: Empty (to be configured)

## Protection Rules

### Cannot Be Deleted

Required fields **cannot be deleted** from forms. Attempting to delete them will:
- Show an error message
- Disable the delete button
- Display a "SYSTEM" badge on the field

### Limited Editing

Required fields have **limited editing** capabilities:

#### ✅ Can Be Changed:
- **Label** - The display label can be customized
- **Placeholder** - The placeholder text can be customized
- **Required checkbox** - Can be toggled (though it's recommended to keep it required)
- **Position** - Fields can be moved/reordered using drag-and-drop

#### ❌ Cannot Be Changed:
- **Field Name** - The field name (e.g., `customer_name`, `customer_phone`) cannot be changed
- **Field Type** - The field type cannot be changed (e.g., phone field must stay as phone type)
- **Deletion** - The field cannot be removed from the form

### Visual Indicators

Required fields are marked with visual indicators:

1. **"SYSTEM" Badge** - Blue badge showing the field is a system field
2. **Locked Icon** - 🔒 icon on field name and type inputs
3. **Disabled Delete Button** - Delete button is grayed out and shows "Locked" text
4. **Disabled Inputs** - Field name and type inputs are disabled and grayed out

## Field Name Requirements

The following field names are recognized as required fields:

### Customer Name
- `customer_name`
- `name`
- `first_name` + `last_name` (both required)

### Phone Number
- `customer_phone`
- `phone_number`
- `whatsapp_number`
- `phone`

### Package Name
- `package_name`
- `selected_package`
- `package`
- `package_type`
- OR any field with type `radio-group`

## Automatic Field Addition

### New Forms

When creating a new form, required fields are automatically added to the schema.

### Existing Forms

When loading an existing form, the system checks if required fields exist. If any are missing, they are automatically added to ensure the form is valid.

## User Experience

### Desktop View

- Required fields show a "SYSTEM" badge next to the "REQUIRED" badge
- Delete button is disabled with tooltip explaining why
- Field name and type inputs are disabled with lock icon
- Fields can still be reordered via drag-and-drop

### Mobile View

- Required fields show a blue banner: "🔒 SYSTEM FIELD - Required for order processing"
- Delete button shows "Locked" instead of "Remove"
- Field name and type inputs are disabled
- Fields can still be reordered

## Error Messages

When attempting to delete or modify a required field:

- **Delete Attempt**: "Cannot delete required field '[field name]'. Required fields (customer name, phone number, package selection) cannot be deleted but can be moved."
- **Name Change Attempt**: "Cannot change field name for required system fields. This field name is needed for order processing."
- **Type Change Attempt**: "Cannot change field type for required system fields. This field type is needed for order processing."

## Best Practices

1. **Keep Required Fields**: Don't try to work around the protection - these fields are essential
2. **Customize Labels**: Use the label field to customize how fields appear to users
3. **Add Custom Fields**: You can add additional fields beyond the required ones
4. **Reorder Fields**: Use drag-and-drop to organize fields in the order you prefer
5. **Configure Radio Groups**: For package selection, configure radio options with products

## Technical Details

### Detection Logic

A field is considered "required" if:
- Its `name` matches one of the required field name patterns, OR
- Its `type` is `radio-group` (for package selection)

### Validation

The system validates forms at multiple levels:
1. **Frontend**: Form Builder prevents deletion and modification
2. **Backend**: Edge Function validates required fields exist in submissions
3. **Database**: Optional trigger can validate form schemas

### Auto-Recovery

If a required field is somehow missing (e.g., from old forms or manual database edits), the system automatically adds it when:
- Loading a form in the Form Builder
- Validating a form before saving

## Migration Notes

### Existing Forms

Existing forms will automatically get required fields added when:
- They are opened in the Form Builder
- They are validated before saving

### Custom Field Names

If you have forms with custom field names that serve the same purpose (e.g., `client_name` instead of `customer_name`), you may need to:
1. Rename the field to match a required field name pattern, OR
2. Add a new field with the required name and hide/remove the old one

The system will recognize fields that match any of the required field name patterns.
