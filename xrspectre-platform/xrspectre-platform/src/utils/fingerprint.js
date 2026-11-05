export function generateFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('XRSpectre', 2, 15);
  }
  const canvasData = canvas.toDataURL ? canvas.toDataURL() : '';

  const components = [
    canvasData,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    screen.pixelDepth,
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency || '',
    navigator.deviceMemory || '',
    navigator.maxTouchPoints || '',
    window.devicePixelRatio || '',
    !!window.indexedDB,
    !!window.sessionStorage,
    !!window.localStorage,
  ];

  let hash = 0;
  const str = components.join('|||');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}
