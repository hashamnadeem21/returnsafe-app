#!/usr/bin/env bash
# Coverage for functions/src across both kinds of test: unit tests that import src/ directly, and
# the triggers, callables and webhook running inside the Functions emulator. Both run the compiled
# lib/ with raw V8 coverage on; scripts/merge-coverage.mjs maps it back to src/ and checks 80%.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf coverage lib
npm run build >/dev/null

NODE_V8_COVERAGE="$PWD/coverage/raw" \
NODE_OPTIONS="--require $PWD/scripts/coverage-flush.cjs" \
FUNCTIONS_TEST_COMPILED=1 \
  ../node_modules/.bin/firebase emulators:exec --project returnsafe-app --only auth,firestore,storage,functions \
  "npx vitest run"

node scripts/merge-coverage.mjs
