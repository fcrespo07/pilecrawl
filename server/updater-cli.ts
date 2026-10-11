// Punto de entrada del CronJob (`node updater.mjs`). Ver updater.ts.
import { readFileSync } from 'node:fs';
import { checkUpdate } from './updater';

const SA = '/var/run/secrets/kubernetes.io/serviceaccount';

checkUpdate({
  fetch,
  token: readFileSync(`${SA}/token`, 'utf8').trim(),
  namespace: process.env.NAMESPACE ?? readFileSync(`${SA}/namespace`, 'utf8').trim(),
  deployment: process.env.DEPLOYMENT ?? 'blockrogue',
  log: (m) => console.log(m),
}).catch((e) => {
  console.error(`fallo al comprobar la imagen: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
