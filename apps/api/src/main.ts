import { configFromEnv, createApp } from './server';

const cfg = configFromEnv();
createApp(cfg).listen(cfg.port, '0.0.0.0', () => {
  console.log(
    `KCNA API listening on :${cfg.port} provider=${cfg.provider.name} model=${cfg.provider.model} static=${cfg.staticDir ?? '(none)'} origins=${cfg.allowedOrigins.join(',')}`,
  );
});
