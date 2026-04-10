module.exports = {
  apps: [
    {
      name: 'heart',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
  ],
};
