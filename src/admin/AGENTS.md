# Console access
- Validate console identity server-side with requirePropertyAdmin for hostel operations and requireSuperAdmin for cross-property settings, restaurant controls and payment activation; never infer authorization from navigation or browser storage.
- Keep booking records property-tagged and enforce matching property RLS on their child rows and invoices; the hostel operator must not access another property's records, even through direct API calls.

- Preserve existing console URLs and carry the selected property in validated search state; generate property-specific check-in QR URLs from the shared canonical-domain helper, and use shared catalogue/meal facts for console summaries so public content remains unchanged.
