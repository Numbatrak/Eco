module.exports = {
  apps: [
    {
      name: 'numbatrak-api',
      script: './apps/api/dist/index.js',
      cwd: '/home/ubuntu/Eco',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
	DATABASE_URL: 'postgresql://neondb_owner:npg_dO4BEbiJ7CWI@ep-shy-resonance-axmk2imy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
	REDIS_URL: 'rediss://default_ro:ggAAAAAAAi0cAAIgcDIjWzeY66OaXIebaMF37kspLVK98CCNgA_G4bShxroMRw@oriented-goshawk-142620.upstash.io:6379',
	PUBLIC_APP_URL: '',
	BETTER_AUTH_SECRET:"<base64-or-random-secret>",
	SECRET_ENCRYPTION_KEY:"<base64-32-bytes>",
	PORT:3000,
	EMAIL_FROM:"noreply@yourdomain.com",
	BETTER_AUTH_URL: 'https://api-dev.numbatrak.com/'
      },
    },
  ],
};
