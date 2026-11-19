// Preloaded into the Functions emulator's workers during `npm run coverage`. The emulator kills its
// workers without a clean exit, so V8 never writes their coverage; flush it to disk regularly.
const v8 = require('node:v8');

if (process.env.NODE_V8_COVERAGE) {
  setInterval(() => v8.takeCoverage(), 500).unref();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      v8.takeCoverage();
      process.kill(process.pid, signal);
    });
  }
}
