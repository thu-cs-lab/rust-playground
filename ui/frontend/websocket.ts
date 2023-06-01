async function reportWebSocketError() {
  try {
    await fetch(process.env.PUBLIC_URL + '/nowebsocket', {
      method: 'post',
      headers: {
        'Content-Length': '0',
      },
    });
  } catch (e) {
    console.log('Error:', e);
  }
}

export default function openWebSocket(currentLocation: Location) {
  try {
    const wsProtocol = currentLocation.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUri = [wsProtocol, currentLocation.host, process.env.PUBLIC_URL, '/websocket'].join('');
    const ws = new WebSocket(wsUri);
    ws.addEventListener('error', () => reportWebSocketError());
    return ws;
  } catch {
    // WebSocket URL error or WebSocket is not supported by browser.
    // Assume it's the second case since URL error is easy to notice.
    reportWebSocketError();
    return null;
  }
}
