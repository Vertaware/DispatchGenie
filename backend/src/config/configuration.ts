export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY ?? '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@example.com',
  },
  uploads: {
    directory: process.env.UPLOADS_DIR ?? 'uploads',
  },
});
