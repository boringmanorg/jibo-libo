# Console access
- Validate console identity server-side with requirePropertyAdmin for hostel operations and requireSuperAdmin for cross-property settings, restaurant controls and payment activation; never infer authorization from navigation or browser storage.
- Keep booking records property-tagged and enforce matching property RLS on their child rows and invoices; the hostel operator must not access another property's records, even through direct API calls.
