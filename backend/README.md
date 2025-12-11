# LogisticsPro API

## Development

```bash
# Install dependencies at repo root
npm install

# Push schema to MongoDB (update DATABASE_URL)
npx prisma db push

# Start API in watch mode
npm run dev:api
```

Environment variables:

- `DATABASE_URL` - MongoDB connection string
- `JWT_SECRET` - secret for JWT signing
- `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` - optional, for OTP emails
- `UPLOADS_DIR` - directory for persisted documents (defaults to `uploads/`)
- `ENABLE_SWAGGER` - set to `false` to disable the interactive API docs (defaults to `true`)

## API docs

Once the API is running, the OpenAPI docs are served at `http://localhost:3000/docs` and the raw JSON at `http://localhost:3000/docs-json`. The UI supports JWT bearer authentication through the `Authorize` button.
