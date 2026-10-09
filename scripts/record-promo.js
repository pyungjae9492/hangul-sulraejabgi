// design/promo.html을 페이지 시계를 직접 넘기며 30fps로 한 프레임씩 찍고 mp4로 묶는다.
// 실행: node scripts/record-promo.js  →  design/jamojump-promo.mp4 (1080x1920)
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || (process.env.HOME + '/.nvm/versions/node/v22.20.0/lib/node_modules/@playwright/cli/node_modules/playwright'));
const root = path.join(__dirname, '..');
const FPS = 30;
const framesDir = path.join(root, 'design/promo-frames');
const out = path.join(root, 'design/jamojump-promo.mp4');

const clock = () => {
  let T = 0, seq = 1;
  const base = Date.now();
  let timers = [];
  const add = (fn, ms, a, every) => { const id = seq++; timers.push({ id, at: T + Math.max(0, Number(ms) || 0), fn, a, every }); return id; };
  window.setTimeout = (fn, ms, ...a) => add(fn, ms, a, 0);
  window.setInterval = (fn, ms, ...a) => add(fn, ms, a, Math.max(1, Number(ms) || 1));
  window.clearTimeout = window.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.requestAnimationFrame = (fn) => add(() => fn(T), 0, [], 0);
  window.cancelAnimationFrame = window.clearTimeout;
  performance.now = () => T;
  Date.now = () => base + T;
  const flush = async () => { for (let i = 0; i < 20; i++) await null; };
  const sync = () => {
    for (const a of document.getAnimations()) {
      if (a.__t0 == null) { a.__t0 = T; try { a.pause(); } catch (e) {} }
      try { a.currentTime = T - a.__t0; } catch (e) {}
    }
  };
  window.__tick = async (dt) => {
    const end = T + dt;
    for (;;) {
      timers.sort((x, y) => x.at - y.at || x.id - y.id);
      const t = timers[0];
      if (!t || t.at > end) break;
      T = Math.max(T, t.at);
      if (t.every) t.at = T + t.every; else timers.shift();
      try { typeof t.fn === 'function' ? t.fn(...t.a) : null; } catch (e) { console.error(e); }
      await flush();
      sync();
    }
    T = end;
    sync();
    return T;
  };
};

(async () => {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const pg = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
  pg.on('pageerror', (e) => console.error('pageerror', e.message));
  await pg.addInitScript(clock);
  await pg.goto('file://' + path.join(root, 'design/promo.html'));
  await pg.waitForFunction(() => document.fonts.status === 'loaded');
  for (let i = 0; i < 200 && !(await pg.evaluate(() => window.__ready)); i++) await pg.evaluate(() => window.__tick(20));
  await pg.evaluate(() => { window.__go = true; });
  let n = 0;
  while (!(await pg.evaluate(() => window.__done)) && n < FPS * 40) {
    await pg.evaluate((dt) => window.__tick(dt), 1000 / FPS);
    await pg.screenshot({ path: path.join(framesDir, String(n).padStart(5, '0') + '.png') });
    n++;
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1), out);
})();

