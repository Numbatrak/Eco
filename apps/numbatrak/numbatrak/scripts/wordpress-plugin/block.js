/**
 * Gutenberg Block for CRM Form Embed
 * 
 * Optional: Only loads if Gutenberg is available
 */

(function() {
    const { registerBlockType } = wp.blocks;
    const { InspectorControls } = wp.blockEditor;
    const { PanelBody, TextControl } = wp.components;
    const { __ } = wp.i18n;

    registerBlockType('crm-form-embed/form', {
        title: __('CRM Form', 'crm-form-embed'),
        icon: 'feedback',
        category: 'embed',
        attributes: {
            formToken: {
                type: 'string',
                default: '',
            },
        },
        edit: function(props) {
            const { attributes, setAttributes } = props;
            const { formToken } = attributes;

            return [
                wp.element.createElement(InspectorControls, { key: 'inspector' },
                    wp.element.createElement(PanelBody, {
                        title: __('Form Settings', 'crm-form-embed'),
                        initialOpen: true
                    },
                        wp.element.createElement(TextControl, {
                            label: __('Form Token', 'crm-form-embed'),
                            value: formToken,
                            onChange: (value) => setAttributes({ formToken: value }),
                            placeholder: 'form_live_98Fh3ksd',
                            help: __('Enter the form token from your CRM dashboard.', 'crm-form-embed')
                        })
                    )
                ),
                wp.element.createElement('div', {
                    key: 'preview',
                    className: 'crm-form-block-preview',
                    style: {
                        padding: '20px',
                        border: '1px dashed #ccc',
                        borderRadius: '4px',
                        textAlign: 'center'
                    }
                },
                    wp.element.createElement('div', {
                        style: { marginBottom: '10px' }
                    },
                        wp.element.createElement('strong', null, __('CRM Form', 'crm-form-embed'))
                    ),
                    formToken ? (
                        wp.element.createElement('div', {
                            style: { color: '#666', fontSize: '14px' }
                        },
                            __('Form Token:', 'crm-form-embed'),
                            ' ',
                            wp.element.createElement('code', null, formToken)
                        )
                    ) : (
                        wp.element.createElement('div', {
                            style: { color: '#999', fontSize: '14px', fontStyle: 'italic' }
                        },
                            __('Enter a form token in the block settings.', 'crm-form-embed')
                        )
                    )
                )
            ];
        },
        save: function() {
            // Render handled by PHP callback
            return null;
        },
    });
})();
