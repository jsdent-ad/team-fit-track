import { chromium } from 'playwright';
import fs from 'fs';

const SHOT_DIR = 'C:/myunji/sd_gym/docs/harness/screenshots/round1';
const BASE = 'http://localhost:5173';
const results = { passed: [], failed: [], consoleErrors: [], pageErrors: [], notes: [] };

function log(k, msg) { console.log(`[${k}] ${msg}`); results.notes.push(`[${k}] ${msg}`); }
function pass(k, msg) { console.log(`PASS [${k}] ${msg}`); results.passed.push(`[${k}] ${msg}`); }
function fail(k, msg) { console.log(`FAIL [${k}] ${msg}`); results.failed.push(`[${k}] ${msg}`); }

const browser = await chromium.launch({ headless: true });

async function newSession(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  return { ctx, page, errs };
}

// Make a small PNG buffer for upload — 100x100 solid red PNG
function makePngBuffer() {
  // 100x100 solid red (IHDR + IDAT)
  // Using a valid pre-generated PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAUklEQVR4nO3RMQ0AAAjAMMC/5yFjRxMnXXtnZtZhMQzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAzDMAx7Fhs2AAEjxUVBAAAAAElFTkSuQmCC',
    'base64'
  );
}

try {
  // === T1: Login ===
  {
    log('T1', 'Starting login tests');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SHOT_DIR}/01-login-mobile.png`, fullPage: true });

    // 1.1 empty submit
    await page.getByRole('button', { name: /로그인/ }).click();
    const err1 = await page.locator('[role="alert"]').textContent().catch(() => null);
    if (err1 && err1.includes('이름')) pass('T1.1', 'empty name shows error: ' + err1);
    else fail('T1.1', 'no error for empty name: ' + err1);

    // 1.2 wrong password
    await page.locator('#login-password').fill('wrong');
    await page.locator('#login-name').fill('Alice');
    await page.getByRole('button', { name: /로그인/ }).click();
    const err2 = await page.locator('[role="alert"]').textContent().catch(() => null);
    if (err2 && err2.includes('비밀번호')) pass('T1.2', 'wrong password error: ' + err2);
    else fail('T1.2', 'no wrong password error: ' + err2);

    // 1.3 correct
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('Alice');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 }).catch(() => {});
    if (page.url() === BASE + '/') pass('T1.3', 'login redirected to /');
    else fail('T1.3', 'login did not redirect, at ' + page.url());

    // 1.4 localStorage check
    const lsRaw = await page.evaluate(() => localStorage.getItem('teamfit-v1'));
    if (lsRaw && lsRaw.includes('Alice')) pass('T1.5', 'localStorage currentUser persisted');
    else fail('T1.5', 'localStorage missing currentUser: ' + lsRaw);

    // 1.4 re-access /login
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    if (page.url() === BASE + '/') pass('T1.4', '/login redirects to / when logged in');
    else fail('T1.4', '/login did not redirect, at ' + page.url());

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T2: Members / Goals ===
  {
    log('T2', 'Starting member/goal tests');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('Alice');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 });

    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SHOT_DIR}/05-goals-empty-mobile.png`, fullPage: true });

    const emptyText = await page.locator('text=아직 팀원이 없어요').count();
    if (emptyText > 0) pass('T2.1', 'empty state shown');
    else fail('T2.1', 'no empty state');

    // Add Alice: target 70 current 60
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('Alice');
    await page.locator('input[placeholder="0"]').fill('60');
    await page.locator('input[placeholder="100"]').fill('70');
    // Unit default is kg
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);
    const aliceVisible = await page.locator('text=Alice').count();
    if (aliceVisible > 0) pass('T2.2', 'Alice added');
    else fail('T2.2', 'Alice not visible');

    // Add Bob: 50 / 50
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('Bob');
    await page.locator('input[placeholder="0"]').fill('50');
    await page.locator('input[placeholder="100"]').fill('50');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    // Add Carol: 10 / 100
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('Carol');
    await page.locator('input[placeholder="0"]').fill('10');
    await page.locator('input[placeholder="100"]').fill('100');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    const bobCount = await page.locator('text=Bob').count();
    const carolCount = await page.locator('text=Carol').count();
    if (bobCount > 0 && carolCount > 0) pass('T2.3', 'Bob and Carol added');
    else fail('T2.3', `missing: Bob=${bobCount} Carol=${carolCount}`);

    await page.screenshot({ path: `${SHOT_DIR}/06-goals-filled-mobile.png`, fullPage: true });

    // Verify scores from localStorage
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const members = ls.state?.members ?? [];
    const alice = members.find(m => m.name === 'Alice');
    if (alice && alice.goalTarget === 70 && alice.goalCurrent === 60) pass('T2.4', 'Alice values stored correctly');
    else fail('T2.4', 'Alice data wrong: ' + JSON.stringify(alice));

    // Edit Bob: change goalCurrent to 40
    const bobArticle = page.locator('article').filter({ hasText: 'Bob' });
    await bobArticle.getByRole('button', { name: '수정' }).click();
    await page.waitForTimeout(200);
    // Use nth based targeting - first number input inside is 현재치
    const bobEditInputs = bobArticle.locator('input[type="number"]');
    // first = current, second = target
    await bobEditInputs.nth(0).fill('40');
    await bobArticle.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(300);
    const ls2 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const bobAfter = ls2.state?.members?.find(m => m.name === 'Bob');
    if (bobAfter && bobAfter.goalCurrent === 40) pass('T2.5', 'Bob edit saved: current=' + bobAfter.goalCurrent);
    else fail('T2.5', 'Bob edit not saved: ' + JSON.stringify(bobAfter));

    // Delete Carol
    const carolArticle = page.locator('article').filter({ hasText: 'Carol' });
    await carolArticle.getByRole('button', { name: '삭제' }).click();
    await page.waitForTimeout(200);
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    if (dialogVisible) pass('T2.6a', 'confirm dialog shown for delete');
    else fail('T2.6a', 'no confirm dialog');
    // Click confirm in dialog
    await page.locator('[role="dialog"] button', { hasText: '삭제' }).last().click();
    await page.waitForTimeout(300);
    const carolStillThere = await page.locator('article').filter({ hasText: 'Carol' }).count();
    if (carolStillThere === 0) pass('T2.6b', 'Carol removed');
    else fail('T2.6b', 'Carol still present');

    // Validation: add with target=0
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('Dan');
    await page.locator('input[placeholder="0"]').fill('5');
    await page.locator('input[placeholder="100"]').fill('0');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(200);
    const valErr = await page.locator('[role="alert"]').textContent().catch(() => '');
    if (valErr && valErr.includes('0보다 커')) pass('T2.7', 'validation rejects target=0: ' + valErr);
    else fail('T2.7', 'no validation for target=0: ' + valErr);
    // Close the add form
    await page.getByRole('button', { name: /닫기/ }).click();

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T3: Photo upload + WebP ===
  {
    log('T3', 'Starting photo upload tests');
    const { ctx, page, errs } = await newSession();
    // Persist is retained because same browser storage? No — each context has its own storage.
    // Need to login again and recreate Alice.
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('Alice');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 });

    // Create Alice in goals
    await page.goto(BASE + '/goals');
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('Alice');
    await page.locator('input[placeholder="0"]').fill('60');
    await page.locator('input[placeholder="100"]').fill('70');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    await page.goto(BASE + '/certify', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SHOT_DIR}/03-certify-mobile.png`, fullPage: true });

    // Generate a valid PNG via page canvas, then write to disk for upload.
    const pngBase64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(50, 50, 100, 100);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const buf = await blob.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    });
    const pngBuf = Buffer.from(pngBase64, 'base64');
    await page.setInputFiles('input[type=file]', { name: 't.png', mimeType: 'image/png', buffer: pngBuf });
    // Wait for preview to appear
    await page.waitForSelector('img[alt="선택한 사진 미리보기"]', { timeout: 10000 }).catch(() => {
      log('T3', 'preview not appearing, checking errors');
    });
    await page.waitForTimeout(500);

    // Check for UI errors
    const uiErr = await page.locator('[role="alert"]').textContent().catch(() => null);
    if (uiErr) log('T3', 'UI error: ' + uiErr);

    // Preview image src should be data:image/webp
    const src = await page.locator('img[alt="선택한 사진 미리보기"]').getAttribute('src').catch(() => null);
    if (src && src.startsWith('data:image/webp')) pass('T3.1', 'preview is WebP dataURL');
    else fail('T3.1', 'preview not WebP: ' + (src ? src.slice(0, 40) : 'null'));

    // Click 인증 등록
    await page.getByRole('button', { name: /인증 등록/ }).click();
    await page.waitForTimeout(500);

    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const certs = ls.state?.certifications ?? [];
    if (certs.length === 1) pass('T3.2', 'certification saved');
    else fail('T3.2', `certs count=${certs.length}`);
    if (certs[0]?.imageDataUrl?.startsWith('data:image/webp')) pass('T3.3', 'saved dataURL is WebP');
    else fail('T3.3', 'stored not WebP');

    // Go to ranking and check Alice score
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOT_DIR}/02-ranking-mobile.png`, fullPage: true });

    // Alice: goal = round(60/70*100) = 86, cert = 10, total = 96
    const myTotal = await page.locator('text=내 종합 점수').locator('..').locator('p.text-3xl').textContent();
    if (myTotal && myTotal.trim() === '96') pass('T3.4/T4.3', 'total=96 correct');
    else fail('T3.4/T4.3', 'total=' + myTotal);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T4: Ranking - order check with multiple members ===
  {
    log('T4', 'Starting ranking test');
    const { ctx, page, errs } = await newSession();
    // Pre-seed localStorage
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const data = {
        state: {
          currentUser: 'Alice',
          members: [
            { id: 'a', name: 'Alice', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
            { id: 'b', name: 'Bob', goalTarget: 50, goalCurrent: 50, goalUnit: 'kg' },
            { id: 'c', name: 'Carol', goalTarget: 100, goalCurrent: 10, goalUnit: 'km' },
          ],
          certifications: [
            { id: 'c1', memberId: 'a', imageDataUrl: 'data:image/webp;base64,AAAA', createdAt: new Date().toISOString() },
          ],
        },
        version: 0,
      };
      localStorage.setItem('teamfit-v1', JSON.stringify(data));
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    // Bob: goal=100 + 0 = 100; Alice: 86+10 = 96; Carol: 10+0 = 10
    const top3Names = await page.locator('ul').first().locator('li').allTextContents();
    // Too coarse. Let's parse more directly:
    const allArticles = await page.locator('article').allTextContents();
    log('T4', 'articles: ' + JSON.stringify(allArticles.slice(0, 5)));

    // Top 3 cards should contain Bob(100), Alice(96), Carol(10) in that order
    const topText = await page.locator('[aria-labelledby="top3"]').textContent();
    // Verify order: find index of Bob, Alice, Carol
    const iBob = topText.indexOf('Bob');
    const iAlice = topText.indexOf('Alice');
    const iCarol = topText.indexOf('Carol');
    if (iBob >= 0 && iAlice > iBob && iCarol > iAlice) pass('T4.1', 'Top3 order Bob > Alice > Carol');
    else fail('T4.1', `order wrong: Bob=${iBob}, Alice=${iAlice}, Carol=${iCarol}`);

    // Empty state test
    await page.evaluate(() => localStorage.removeItem('teamfit-v1'));
    await page.goto(BASE + '/login');
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('TestUser');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 });
    await page.waitForTimeout(200);
    const emptyMsg = await page.locator('text=아직 팀원이 없어요').count();
    if (emptyMsg > 0) pass('T4.4', 'empty state on ranking');
    else fail('T4.4', 'no empty state on ranking');

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T5: Records ===
  {
    log('T5', 'Starting records tests');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const data = {
        state: {
          currentUser: 'Alice',
          members: [
            { id: 'a', name: 'Alice', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
          ],
          certifications: [
            { id: 'c1', memberId: 'a', imageDataUrl: 'data:image/webp;base64,AAAA', caption: 'old caption', createdAt: new Date(Date.now() - 60000).toISOString() },
            { id: 'c2', memberId: 'a', imageDataUrl: 'data:image/webp;base64,AAAA', caption: 'newer', createdAt: new Date().toISOString() },
          ],
        },
        version: 0,
      };
      localStorage.setItem('teamfit-v1', JSON.stringify(data));
    });
    await page.goto(BASE + '/records', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT_DIR}/04-records-mobile.png`, fullPage: true });

    const all = await page.locator('article').count();
    if (all === 2) pass('T5.1', 'shows 2 records');
    else fail('T5.1', 'count=' + all);

    // Check order: 'newer' should appear before 'old caption'
    const firstArticleText = await page.locator('article').first().textContent();
    if (firstArticleText.includes('newer')) pass('T5.2', 'newest first');
    else fail('T5.2', 'order wrong: ' + firstArticleText.slice(0, 80));

    // Edit caption of first record
    const firstArticle = page.locator('article').first();
    await firstArticle.getByLabel('캡션 수정').click();
    await page.waitForTimeout(200);
    const ta = firstArticle.locator('textarea');
    await ta.fill('EDITED CAPTION');
    await firstArticle.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(300);
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1')));
    const edited = ls.state.certifications.find(c => c.caption === 'EDITED CAPTION');
    if (edited) pass('T5.3', 'caption edited');
    else fail('T5.3', 'caption not persisted');

    // Delete first record
    const beforeCerts = ls.state.certifications.length;
    await firstArticle.getByLabel('인증 삭제').click();
    await page.waitForTimeout(200);
    const confirmOk = await page.locator('[role="dialog"]').isVisible();
    if (confirmOk) pass('T5.4a', 'confirm dialog shown');
    else fail('T5.4a', 'no confirm');
    await page.locator('[role="dialog"] button', { hasText: '삭제' }).last().click();
    await page.waitForTimeout(300);
    const ls2 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1')));
    if (ls2.state.certifications.length === beforeCerts - 1) pass('T5.4b', 'record removed from store');
    else fail('T5.4b', 'count: ' + ls2.state.certifications.length);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T6: Persistence ===
  {
    log('T6', 'Starting persistence tests');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('Persist');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 });

    await page.goto(BASE + '/goals');
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.locator('input[placeholder="홍길동"]').fill('PersistMember');
    await page.locator('input[placeholder="0"]').fill('5');
    await page.locator('input[placeholder="100"]').fill('10');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const persisted = await page.locator('text=PersistMember').count();
    if (persisted > 0) pass('T6', 'data persisted through reload');
    else fail('T6', 'member not persisted');

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T7: Bottom tabs ===
  {
    log('T7', 'Starting bottom tabs tests');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.locator('#login-password').fill('fittrack2026');
    await page.locator('#login-name').fill('Tabber');
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(BASE + '/', { timeout: 3000 });

    for (const { label, path } of [
      { label: '인증', path: '/certify' },
      { label: '기록', path: '/records' },
      { label: '목표', path: '/goals' },
      { label: '랭킹', path: '/' },
    ]) {
      await page.locator(`nav a:has-text("${label}")`).click();
      await page.waitForTimeout(200);
      const u = page.url().replace(BASE, '') || '/';
      const expected = path;
      if (u === expected) pass('T7.' + label, `nav to ${path}`);
      else fail('T7.' + label, `expected ${expected}, got ${u}`);
    }

    // Active style: check color
    await page.locator('nav a:has-text("목표")').click();
    await page.waitForTimeout(200);
    const color = await page.locator('nav a:has-text("목표")').evaluate(el =>
      getComputedStyle(el).color
    );
    // accent #0066FF = rgb(0, 102, 255)
    if (color.includes('0, 102, 255') || color.includes('rgb(0, 102, 255)')) pass('T7.active', 'active tab has accent color');
    else fail('T7.active', 'active color: ' + color);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // === T8: Design - font + screenshots ===
  {
    log('T8', 'Starting design check');
    const { ctx, page, errs } = await newSession();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const fontFam = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    if (fontFam.includes('Pretendard')) pass('T8.font', 'Pretendard applied: ' + fontFam);
    else fail('T8.font', 'font: ' + fontFam);

    // Desktop screenshots
    const { ctx: ctx2, page: p2, errs: e2 } = await newSession({ width: 1280, height: 800 });
    await p2.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p2.screenshot({ path: `${SHOT_DIR}/01-login-desktop.png`, fullPage: true });

    await p2.locator('#login-password').fill('fittrack2026');
    await p2.locator('#login-name').fill('Alice');
    await p2.getByRole('button', { name: /로그인/ }).click();
    await p2.waitForURL(BASE + '/', { timeout: 3000 });
    await p2.evaluate(() => {
      const data = {
        state: {
          currentUser: 'Alice',
          members: [
            { id: 'a', name: 'Alice', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
            { id: 'b', name: 'Bob', goalTarget: 50, goalCurrent: 50, goalUnit: 'kg' },
            { id: 'c', name: 'Carol', goalTarget: 100, goalCurrent: 10, goalUnit: 'km' },
          ],
          certifications: [
            { id: 'c1', memberId: 'a', imageDataUrl: 'data:image/webp;base64,AAAA', caption: 'Hello', createdAt: new Date().toISOString() },
          ],
        },
        version: 0,
      };
      localStorage.setItem('teamfit-v1', JSON.stringify(data));
    });
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(500);
    await p2.screenshot({ path: `${SHOT_DIR}/02-ranking-desktop.png`, fullPage: true });
    await p2.goto(BASE + '/certify');
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: `${SHOT_DIR}/03-certify-desktop.png`, fullPage: true });
    await p2.goto(BASE + '/records');
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: `${SHOT_DIR}/04-records-desktop.png`, fullPage: true });
    await p2.goto(BASE + '/goals');
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: `${SHOT_DIR}/05-goals-desktop.png`, fullPage: true });

    results.consoleErrors.push(...e2);
    await ctx2.close();
    results.consoleErrors.push(...errs);
    await ctx.close();
  }

} catch (e) {
  console.error('FATAL', e);
  fail('FATAL', e.message);
} finally {
  await browser.close();
  console.log('\n=== Summary ===');
  console.log('Passed:', results.passed.length);
  console.log('Failed:', results.failed.length);
  console.log('Console errors:', results.consoleErrors.length);
  if (results.consoleErrors.length) console.log(results.consoleErrors.slice(0, 20).join('\n'));
  fs.writeFileSync('C:/myunji/sd_gym/eval-round1-results.json', JSON.stringify(results, null, 2));
}
