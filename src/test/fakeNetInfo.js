/* global jest */
/** In-memory @react-native-community/netinfo for tests. */
const listeners = new Set();
let state = { isConnected: true, isInternetReachable: true };

const fakeNetInfo = {
  __esModule: true,
  default: {
    addEventListener: jest.fn((l) => {
      listeners.add(l);
      l(state);
      return () => listeners.delete(l);
    }),
    fetch: jest.fn(async () => state),
  },
};

/** Changes the connection and tells every listener. */
function setConnection(isConnected, isInternetReachable = isConnected) {
  state = { isConnected, isInternetReachable };
  for (const l of [...listeners]) l(state);
}

function resetNetInfo() {
  state = { isConnected: true, isInternetReachable: true };
  listeners.clear();
}

module.exports = { fakeNetInfo, setConnection, resetNetInfo };
