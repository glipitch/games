import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

let server;
const env = { ...process.env };
async function run(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} failed (${code})`)));
  });
}
try {
  await run(['--test', ...(await readdir('tests')).filter(file => file.endsWith('.test.js')).map(file => 'tests/' + file)]);
  if (!env.TEST_URL) {
    server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
    env.TEST_URL = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server did not start')), 10000);
      server.on('error', error => { clearTimeout(timer); reject(error); });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited: ' + code)); });
      server.stdout.on('data', data => { const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (url) { clearTimeout(timer); resolve(url[0] + '/'); } });
    });
  }
  for (const file of ['browser.mjs', 'usability.mjs', 'recognition.mjs', 'automatic.mjs', 'datasets.mjs']) await run(['tests/' + file]);
  console.log('All sudoku checks passed, including all 65 dataset photographs.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { server?.kill(); }
