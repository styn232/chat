module.exports = {
  apps: [
    {
      name: 'heart',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
  ],
};
