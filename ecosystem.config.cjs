module.exports = {
  apps: [
    {
      name: 'truyen24h-web',
      script: '.next/standalone/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '800M',
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
