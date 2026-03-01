# Bitespeed Identity Reconciliation

A web service that identifies and tracks customer identity across multiple purchases.

## Endpoint
POST `/identify`

### Request
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

### Response
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@email.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Hosted URL
`(will add after deployment)`

## Tech Stack
- Node.js + TypeScript
- Express.js
- Prisma ORM
- SQLite (local) / PostgreSQL (production)
