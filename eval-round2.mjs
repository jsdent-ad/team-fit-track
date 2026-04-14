import { chromium } from 'playwright';
import fs from 'fs';

const SHOT_DIR = 'C:/myunji/sd_gym/docs/harness/screenshots/round2';
const BASE = 'http://localhost:5173';
const results = {
  passed: [],
  failed: [],
  consoleErrors: [],
  pageErrors: [],
  notes: [],
};

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

async function clearStorage(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
}

async function loginAs(page, name) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('#login-password').fill('fittrack2026');
  await page.locator('#login-name').fill(name);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL(BASE + '/', { timeout: 4000 }).catch(() => {});
}

// Seed utilities
async function seedState(page, state) {
  await page.evaluate((s) => {
    localStorage.setItem('teamfit-v1', JSON.stringify({ state: s, version: 2 }));
  }, state);
}

try {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  // =========================================================================
  // T1: Regression — Login + members with diff goalTypes + upload + delete
  // =========================================================================
  {
    log('T1', 'Regression + multi-goalType tests');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);
    await loginAs(page, 'Alice');

    // Alice auto-created by ensureMemberForUser — check goalType='weight'
    await page.waitForTimeout(300);
    const ls0 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    // Note: RankingPage doesn't auto-create. Only goals page requires explicit add.
    log('T1', 'after login members=' + JSON.stringify(ls0.state?.members));

    // Add 3 members manually with different goalTypes
    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });

    // Alice → weight
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.waitForTimeout(150);
    await page.locator('input[placeholder="홍길동"]').fill('Alice');
    // GoalTypeSelect radio — click first (weight) is default already. But select explicitly.
    await page.locator('[role="radio"]').nth(0).click();
    await page.locator('input[placeholder="0"]').fill('60');
    await page.locator('input[placeholder="100"]').fill('70');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(200);

    // Bob → bodyFat
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.waitForTimeout(150);
    await page.locator('input[placeholder="홍길동"]').fill('Bob');
    await page.locator('[role="radio"]').nth(1).click();
    await page.locator('input[placeholder="0"]').fill('5');
    await page.locator('input[placeholder="100"]').fill('50');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(200);

    // Carol → skeletalMuscle
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.waitForTimeout(150);
    await page.locator('input[placeholder="홍길동"]').fill('Carol');
    await page.locator('[role="radio"]').nth(2).click();
    await page.locator('input[placeholder="0"]').fill('30');
    await page.locator('input[placeholder="100"]').fill('30');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(200);

    const ls1 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const members = ls1.state?.members ?? [];
    const alice = members.find(m => m.name === 'Alice');
    const bob = members.find(m => m.name === 'Bob');
    const carol = members.find(m => m.name === 'Carol');
    if (alice?.goalType === 'weight') pass('T1.gt.a', 'Alice goalType=weight');
    else fail('T1.gt.a', 'Alice goalType=' + alice?.goalType);
    if (bob?.goalType === 'bodyFat') pass('T1.gt.b', 'Bob goalType=bodyFat');
    else fail('T1.gt.b', 'Bob goalType=' + bob?.goalType);
    if (carol?.goalType === 'skeletalMuscle') pass('T1.gt.c', 'Carol goalType=skeletalMuscle');
    else fail('T1.gt.c', 'Carol goalType=' + carol?.goalType);

    // Photo upload — Alice is currentUser; upload produces cert for Alice? The CertifyPage uses ensureMemberForUser based on currentUser.
    await page.goto(BASE + '/certify', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const pngBase64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0066FF';
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
    await page.waitForSelector('img[alt="선택한 사진 미리보기"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    const src = await page.locator('img[alt="선택한 사진 미리보기"]').getAttribute('src').catch(() => null);
    if (src && src.startsWith('data:image/webp')) pass('T1.webp', 'preview WebP dataURL');
    else fail('T1.webp', 'preview not WebP: ' + (src ? src.slice(0, 40) : 'null'));

    await page.getByRole('button', { name: /인증 등록/ }).click();
    await page.waitForTimeout(400);
    const ls2 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const certs2 = ls2.state?.certifications ?? [];
    if (certs2.length === 1 && certs2[0].imageDataUrl.startsWith('data:image/webp')) {
      pass('T1.cert.add', 'certification saved as WebP');
    } else fail('T1.cert.add', 'certs count=' + certs2.length);

    // Delete via /records → confirm → count=0
    await page.goto(BASE + '/records', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const delBtn = page.getByLabel('인증 삭제').first();
    if (await delBtn.count() > 0) {
      await delBtn.click();
      await page.waitForTimeout(200);
      await page.locator('[role="dialog"] button').filter({ hasText: '삭제' }).last().click();
      await page.waitForTimeout(300);
      const ls3 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
      if ((ls3.state?.certifications ?? []).length === 0) pass('T1.cert.del', 'cert removed');
      else fail('T1.cert.del', 'cert still present: ' + (ls3.state?.certifications ?? []).length);
    } else {
      fail('T1.cert.del', 'no delete button found');
    }

    // Reload persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const ls4 = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const m4 = ls4.state?.members ?? [];
    const stillHave = m4.length === 3 && m4.find(x => x.name === 'Bob')?.goalType === 'bodyFat';
    if (stillHave) pass('T1.persist', 'members + goalType survived reload');
    else fail('T1.persist', 'reload lost data: ' + JSON.stringify(m4.map(m => [m.name, m.goalType])));

    // Bottom tabs — navigate 4
    const tabTests = [
      { label: '인증', path: '/certify' },
      { label: '기록', path: '/records' },
      { label: '목표', path: '/goals' },
      { label: '랭킹', path: '/' },
    ];
    for (const t of tabTests) {
      await page.locator(`nav a:has-text("${t.label}")`).click();
      await page.waitForTimeout(200);
      const u = page.url().replace(BASE, '') || '/';
      if (u === t.path) pass('T1.tab.' + t.label, 'nav to ' + t.path);
      else fail('T1.tab.' + t.label, `expected ${t.path}, got ${u}`);
    }

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T2: F2 — Goal Type UI + migration
  // =========================================================================
  {
    log('T2', 'F2 goalType tests');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);
    await loginAs(page, 'Tester');
    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.waitForTimeout(150);

    // UI: 3 radios
    const radios = page.locator('[role="radio"]');
    const radioCount = await radios.count();
    if (radioCount === 3) pass('T2.1', 'goalType radios=3');
    else fail('T2.1', 'radio count=' + radioCount);

    const texts = await radios.allTextContents();
    log('T2', 'radio texts: ' + JSON.stringify(texts));
    const hasAll = texts.some(t => /체중/.test(t)) && texts.some(t => /체지방량/.test(t)) && texts.some(t => /골격근량/.test(t));
    if (hasAll) pass('T2.2', '체중/체지방량/골격근량 all labels present');
    else fail('T2.2', 'missing labels: ' + texts.join(','));

    // Select bodyFat
    await radios.nth(1).click();
    const ariaChecked = await radios.nth(1).getAttribute('aria-checked');
    if (ariaChecked === 'true') pass('T2.3', 'bodyFat radio selected');
    else fail('T2.3', 'aria-checked=' + ariaChecked);

    // Fill and save
    await page.locator('input[placeholder="홍길동"]').fill('BodyFatUser');
    await page.locator('input[placeholder="0"]').fill('10');
    await page.locator('input[placeholder="100"]').fill('20');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    // Member card should display type badge '체지방량'
    const cardText = await page.locator('article').filter({ hasText: 'BodyFatUser' }).textContent();
    if (cardText && cardText.includes('체지방량')) pass('T2.4', 'badge visible on member card');
    else fail('T2.4', 'card text: ' + cardText);

    // Ranking page should show type badge
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const rankText = await page.locator('section[aria-labelledby="overall-ranking"]').textContent();
    if (rankText && rankText.includes('체지방량')) pass('T2.5', 'badge visible in overall ranking');
    else fail('T2.5', 'ranking text: ' + rankText);

    // Migration test — seed legacy data (no goalType, version 1)
    await page.evaluate(() => {
      const data = {
        state: {
          currentUser: 'Legacy',
          members: [
            { id: 'x', name: 'Legacy', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
          ],
          certifications: [],
        },
        version: 1,
      };
      localStorage.setItem('teamfit-v1', JSON.stringify(data));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const lsMig = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const legacy = lsMig.state?.members?.[0];
    if (legacy?.goalType === 'weight') pass('T2.6', 'legacy member migrated with goalType=weight');
    else fail('T2.6', 'migration failed: ' + JSON.stringify(legacy));

    // DOM check: badge '체중'
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const legacyRank = await page.locator('section[aria-labelledby="overall-ranking"]').textContent();
    if (legacyRank && legacyRank.includes('체중')) pass('T2.7', 'migrated member shows 체중 badge');
    else fail('T2.7', 'no 체중 badge: ' + legacyRank);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T3: F4 — Overall Ranking section
  // =========================================================================
  {
    log('T3', 'F4 overall ranking');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);

    // Screenshot login mobile
    await page.screenshot({ path: `${SHOT_DIR}/login-mobile.png`, fullPage: true });

    // Login as TestEmpty → ranking empty
    await loginAs(page, 'TestEmpty');
    await page.waitForTimeout(300);
    const emptyRank = await page.locator('text=아직 팀원이 없어요').count();
    if (emptyRank > 0) pass('T3.empty', 'empty state on ranking when no members');
    else fail('T3.empty', 'no empty message');
    await page.screenshot({ path: `${SHOT_DIR}/ranking-empty-mobile.png`, fullPage: true });

    // Seed 3 members: Carol=100, Alice=86, Bob=10
    await seedState(page, {
      currentUser: 'Alice',
      members: [
        { id: 'a', name: 'Alice', goalType: 'weight', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
        { id: 'b', name: 'Bob', goalType: 'bodyFat', goalTarget: 50, goalCurrent: 5, goalUnit: 'kg' },
        { id: 'c', name: 'Carol', goalType: 'skeletalMuscle', goalTarget: 30, goalCurrent: 30, goalUnit: 'kg' },
      ],
      certifications: [
        { id: 'c1', memberId: 'a', imageDataUrl: 'data:image/webp;base64,AAA', createdAt: new Date().toISOString() },
      ],
      celebratedMemberIds: ['c'], // prevent celebration popup from blocking
      teamChallenge: null,
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // Scores: Alice goal = round(60/70*100)=86, cert=10 → 96
    // Bob goal = round(5/50*100)=10 → 10
    // Carol goal = 100 → 100
    // Order: Carol(100) > Alice(96) > Bob(10)

    // Check overall ranking section exists
    const ovCount = await page.locator('section[aria-labelledby="overall-ranking"]').count();
    if (ovCount === 1) pass('T3.section', 'overall ranking section exists');
    else fail('T3.section', 'section count=' + ovCount);

    // Number badges 1, 2, 3
    const rankItems = page.locator('section[aria-labelledby="overall-ranking"] ul > li');
    const rankCount = await rankItems.count();
    if (rankCount === 3) pass('T3.count', '3 ranking rows');
    else fail('T3.count', 'rows=' + rankCount);

    // Verify order (1=Carol, 2=Alice, 3=Bob)
    const row1 = await rankItems.nth(0).textContent();
    const row2 = await rankItems.nth(1).textContent();
    const row3 = await rankItems.nth(2).textContent();
    log('T3', 'row1=' + row1);
    log('T3', 'row2=' + row2);
    log('T3', 'row3=' + row3);
    if (/1.*Carol.*100/s.test(row1)) pass('T3.ord1', '1=Carol/100');
    else fail('T3.ord1', 'row1=' + row1);
    if (/2.*Alice.*96/s.test(row2)) pass('T3.ord2', '2=Alice/96');
    else fail('T3.ord2', 'row2=' + row2);
    if (/3.*Bob.*10/s.test(row3)) pass('T3.ord3', '3=Bob/10');
    else fail('T3.ord3', 'row3=' + row3);

    // Top 3 medals (🥇🥈🥉) — check section top3
    const top3Text = await page.locator('section[aria-labelledby="top3"]').textContent();
    log('T3', 'top3 text: ' + top3Text);
    const hasMedals = /🥇|🥈|🥉/.test(top3Text || '');
    if (hasMedals) pass('T3.medals', 'medals present in top3');
    else fail('T3.medals', 'no medals in top3');

    // Current user (Alice) row highlight — check border-accent on that row's div
    const aliceRow = rankItems.nth(1);
    const className = await aliceRow.locator('> div').first().getAttribute('class');
    if (className && className.includes('border-accent')) pass('T3.highlight', 'Alice row has accent border');
    else fail('T3.highlight', 'Alice class=' + className);

    // Verify computed border color is #0066FF
    const borderColor = await aliceRow.locator('> div').first().evaluate(el => getComputedStyle(el).borderColor);
    if (borderColor.includes('0, 102, 255') || borderColor.toLowerCase().includes('rgb(0, 102, 255)')) {
      pass('T3.accent', 'border color is accent #0066FF');
    } else {
      log('T3', 'border color=' + borderColor);
      fail('T3.accent', 'border not accent: ' + borderColor);
    }

    await page.screenshot({ path: `${SHOT_DIR}/ranking-filled-mobile.png`, fullPage: true });

    // 1-member case
    await seedState(page, {
      currentUser: 'Solo',
      members: [
        { id: 's', name: 'Solo', goalType: 'weight', goalTarget: 70, goalCurrent: 30, goalUnit: 'kg' },
      ],
      certifications: [],
      celebratedMemberIds: [],
      teamChallenge: null,
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const soloItems = await page.locator('section[aria-labelledby="overall-ranking"] ul > li').count();
    if (soloItems === 1) pass('T3.solo', 'single member renders 1 row');
    else fail('T3.solo', 'count=' + soloItems);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T4: F10 — Celebration Modal
  // =========================================================================
  {
    log('T4', 'F10 celebration modal');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);

    // Seed a member NOT at 100% first
    await seedState(page, {
      currentUser: 'Star',
      members: [
        { id: 's1', name: 'Star', goalType: 'weight', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
      ],
      certifications: [],
      celebratedMemberIds: [],
      teamChallenge: null,
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const modalBefore = await page.locator('[role="dialog"][aria-labelledby="celebration-title"]').count();
    if (modalBefore === 0) pass('T4.nopre', 'no celebration when < 100%');
    else fail('T4.nopre', 'modal showed prematurely');

    // Now update via goals page to 100 (60→70)
    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    const article = page.locator('article').filter({ hasText: 'Star' });
    await article.getByRole('button', { name: '수정' }).click();
    await page.waitForTimeout(200);
    // First number input = 현재치
    const inputs = article.locator('input[type="number"]');
    await inputs.nth(0).fill('70');
    await article.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(600);

    // Modal should appear
    const modal = page.locator('[role="dialog"][aria-labelledby="celebration-title"]');
    const modalVisible = await modal.isVisible().catch(() => false);
    if (modalVisible) pass('T4.show', 'celebration modal visible');
    else fail('T4.show', 'modal not visible after achieving 100%');

    if (modalVisible) {
      const mtxt = await modal.textContent();
      log('T4', 'modal text: ' + mtxt);
      if (mtxt && mtxt.includes('목표 달성')) pass('T4.title', '목표 달성 text');
      else fail('T4.title', 'no title');
      if (mtxt && mtxt.includes('Star')) pass('T4.name', 'name displayed');
      else fail('T4.name', 'name missing');
      if (mtxt && mtxt.includes('체중')) pass('T4.type', 'goalType label displayed');
      else fail('T4.type', 'no goalType label');
      if (mtxt && mtxt.includes('70') && mtxt.includes('kg')) pass('T4.nums', 'numbers displayed');
      else fail('T4.nums', 'no numbers');

      await page.screenshot({ path: `${SHOT_DIR}/celebration-modal.png`, fullPage: true });

      // Canvas-confetti: check if a canvas was inserted
      const canvasCount = await page.locator('canvas').count();
      if (canvasCount >= 1) pass('T4.canvas', 'confetti canvas inserted (count=' + canvasCount + ')');
      else fail('T4.canvas', 'no canvas found');

      // Click 확인 to close
      await modal.getByRole('button', { name: '확인' }).click();
      await page.waitForTimeout(300);
      const stillVisible = await modal.isVisible().catch(() => false);
      if (!stillVisible) pass('T4.close', 'modal closed on 확인');
      else fail('T4.close', 'modal still visible');
    }

    // localStorage celebratedMemberIds contains s1
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const celebIds = ls.state?.celebratedMemberIds ?? [];
    if (celebIds.includes('s1')) pass('T4.marked', 'celebratedMemberIds has id');
    else fail('T4.marked', 'celeb list=' + JSON.stringify(celebIds));

    // No duplicate on re-mount: reload page, modal should NOT appear
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const modalAgain = await page.locator('[role="dialog"][aria-labelledby="celebration-title"]').count();
    if (modalAgain === 0) pass('T4.nodup', 'no duplicate celebration on reload');
    else fail('T4.nodup', 'modal reappeared');

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T5: F11 — Weekly chart
  // =========================================================================
  {
    log('T5', 'F11 weekly chart');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);

    const now = new Date();
    const isoNow = () => new Date().toISOString();
    // Seed several certifications today
    await seedState(page, {
      currentUser: 'Charter',
      members: [
        { id: 'm1', name: 'Charter', goalType: 'weight', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
        { id: 'm2', name: 'Teammate', goalType: 'weight', goalTarget: 60, goalCurrent: 50, goalUnit: 'kg' },
      ],
      certifications: [
        { id: 'c1', memberId: 'm1', imageDataUrl: 'data:image/webp;base64,AAA', createdAt: isoNow() },
        { id: 'c2', memberId: 'm1', imageDataUrl: 'data:image/webp;base64,AAA', createdAt: isoNow() },
        { id: 'c3', memberId: 'm2', imageDataUrl: 'data:image/webp;base64,AAA', createdAt: isoNow() },
        { id: 'c4', memberId: 'm2', imageDataUrl: 'data:image/webp;base64,AAA', createdAt: isoNow() },
      ],
      celebratedMemberIds: [],
      teamChallenge: null,
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Section exists
    const sec = await page.locator('section[aria-labelledby="weekly-chart"]').count();
    if (sec === 1) pass('T5.sec', 'weekly chart section exists');
    else fail('T5.sec', 'section count=' + sec);

    // Title
    const title = await page.locator('#weekly-chart').textContent();
    if (title && /주간/.test(title)) pass('T5.title', 'title: ' + title);
    else fail('T5.title', 'title=' + title);

    // SVG rendered
    const svgCount = await page.locator('section[aria-labelledby="weekly-chart"] svg').count();
    if (svgCount >= 1) pass('T5.svg', 'chart svg rendered (count=' + svgCount + ')');
    else fail('T5.svg', 'no svg');

    // X axis: 7 day labels — each day has weekday + mmdd. Let's count tspan-like text
    const xLabels = await page.locator('section[aria-labelledby="weekly-chart"] svg text').allTextContents();
    log('T5', 'chart texts: ' + JSON.stringify(xLabels));
    // We should find 7 weekday entries (일월화수목금토)
    const weekdayChars = '일월화수목금토';
    const weekdayCount = xLabels.filter(t => t.length === 1 && weekdayChars.includes(t)).length;
    if (weekdayCount === 7) pass('T5.days', '7 weekday labels');
    else fail('T5.days', 'weekday labels=' + weekdayCount + ' texts=' + JSON.stringify(xLabels));

    await page.screenshot({ path: `${SHOT_DIR}/weekly-chart.png`, fullPage: true });

    // Empty state
    await seedState(page, {
      currentUser: 'Charter',
      members: [
        { id: 'm1', name: 'Charter', goalType: 'weight', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
      ],
      certifications: [],
      celebratedMemberIds: [],
      teamChallenge: null,
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const emptyMsg = await page.locator('section[aria-labelledby="weekly-chart"]').textContent();
    if (emptyMsg && /이번 주 기록이 없어요/.test(emptyMsg)) pass('T5.empty', 'empty state message');
    else fail('T5.empty', 'empty msg: ' + emptyMsg);

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T6: F12 — Team Challenge
  // =========================================================================
  {
    log('T6', 'F12 team challenge');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);
    await loginAs(page, 'Chal');
    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    // Section exists with title
    const sec = await page.locator('section[aria-labelledby="team-challenge"]').count();
    if (sec === 1) pass('T6.sec', 'team-challenge section exists');
    else fail('T6.sec', 'section=' + sec);

    // Start button
    const startBtn = page.getByRole('button', { name: /챌린지 시작하기/ });
    if (await startBtn.count() > 0) pass('T6.start', 'start button present');
    else fail('T6.start', 'no start button');

    await startBtn.click();
    await page.waitForTimeout(200);

    // Form fields
    const titleInput = page.locator('input[placeholder="4월 오운완 300건 도전"]');
    const hasTitle = await titleInput.count() > 0;
    if (hasTitle) pass('T6.form', 'challenge form appeared');
    else fail('T6.form', 'no title input');

    await titleInput.fill('테스트 챌린지');
    // Target count already 100 default
    // Click 챌린지 시작
    await page.getByRole('button', { name: /^챌린지 시작$/ }).click();
    await page.waitForTimeout(300);

    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    const ch = ls.state?.teamChallenge;
    if (ch && ch.title === '테스트 챌린지' && ch.targetCount === 100) pass('T6.save', 'challenge saved');
    else fail('T6.save', 'saved=' + JSON.stringify(ch));

    // Progress bar visible
    const progBar = await page.locator('section[aria-labelledby="team-challenge"] [role="progressbar"]').count();
    if (progBar >= 1) pass('T6.progress', 'progress bar rendered');
    else fail('T6.progress', 'no progress bar');

    // Number text
    const card = await page.locator('section[aria-labelledby="team-challenge"]').textContent();
    if (card && /0 \/ 100건/.test(card)) pass('T6.nums', 'count/target shown: 0/100');
    else fail('T6.nums', 'card=' + card);

    await page.screenshot({ path: `${SHOT_DIR}/goals-with-challenge.png`, fullPage: true });

    // Add a certification (via direct store)
    // First create the member Chal
    // But ensureMemberForUser only runs on CertifyPage. Let's add via goals form manually.
    await page.getByRole('button', { name: /\+ 추가/ }).click();
    await page.waitForTimeout(150);
    await page.locator('input[placeholder="홍길동"]').fill('Chal');
    await page.locator('input[placeholder="0"]').fill('10');
    await page.locator('input[placeholder="100"]').fill('70');
    await page.getByRole('button', { name: /팀원 추가/ }).click();
    await page.waitForTimeout(300);

    // Upload one cert via certify page
    await page.goto(BASE + '/certify', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const pngBase64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const buf = await blob.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    });
    const pngBuf = Buffer.from(pngBase64, 'base64');
    await page.setInputFiles('input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: pngBuf });
    await page.waitForSelector('img[alt="선택한 사진 미리보기"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /인증 등록/ }).click();
    await page.waitForTimeout(500);

    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const card2 = await page.locator('section[aria-labelledby="team-challenge"]').textContent();
    if (card2 && /1 \/ 100건/.test(card2)) pass('T6.inc', 'progress incremented to 1');
    else fail('T6.inc', 'card2=' + card2);

    // Badge on ranking page
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const badge = await page.locator('section[aria-labelledby="current-challenge"]').count();
    if (badge === 1) pass('T6.badge', 'challenge badge on ranking');
    else fail('T6.badge', 'badge count=' + badge);

    // Delete challenge with confirm
    await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const delBtn = page.locator('section[aria-labelledby="team-challenge"]').getByRole('button', { name: /^삭제$/ });
    await delBtn.click();
    await page.waitForTimeout(200);
    const confirmShown = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (confirmShown) pass('T6.confirm', 'confirm dialog shown');
    else fail('T6.confirm', 'no confirm');
    await page.locator('[role="dialog"] button').filter({ hasText: '삭제' }).last().click();
    await page.waitForTimeout(300);
    const lsDel = await page.evaluate(() => JSON.parse(localStorage.getItem('teamfit-v1') || '{}'));
    if (lsDel.state?.teamChallenge === null) pass('T6.del', 'challenge deleted');
    else fail('T6.del', 'still present: ' + JSON.stringify(lsDel.state?.teamChallenge));

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T7: N3 — 404 page
  // =========================================================================
  {
    log('T7', 'N3 404 page');
    const { ctx, page, errs } = await newSession();
    await clearStorage(page);
    await loginAs(page, 'Nav');

    await page.goto(BASE + '/nonexistent', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const body = await page.locator('main').textContent();
    if (body && body.includes('페이지를 찾을 수 없어요')) pass('T7.msg', '404 message shown');
    else fail('T7.msg', 'body=' + body);

    const homeLink = page.getByRole('link', { name: /홈으로 돌아가기/ });
    if (await homeLink.count() > 0) pass('T7.link', 'home link present');
    else fail('T7.link', 'no home link');

    await page.screenshot({ path: `${SHOT_DIR}/not-found.png`, fullPage: true });

    await homeLink.click();
    await page.waitForTimeout(400);
    if (page.url() === BASE + '/') pass('T7.nav', 'nav to / on click');
    else fail('T7.nav', 'at ' + page.url());

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

  // =========================================================================
  // T8: N1 — Desktop layout (side-by-side)
  // =========================================================================
  {
    log('T8', 'N1 desktop layout');
    const { ctx, page, errs } = await newSession({ width: 1280, height: 800 });
    await clearStorage(page);

    await page.screenshot({ path: `${SHOT_DIR}/login-desktop.png`, fullPage: true });

    // Seed for ranking
    await seedState(page, {
      currentUser: 'Alice',
      members: [
        { id: 'a', name: 'Alice', goalType: 'weight', goalTarget: 70, goalCurrent: 60, goalUnit: 'kg' },
        { id: 'b', name: 'Bob', goalType: 'bodyFat', goalTarget: 50, goalCurrent: 5, goalUnit: 'kg' },
        { id: 'c', name: 'Carol', goalType: 'skeletalMuscle', goalTarget: 30, goalCurrent: 30, goalUnit: 'kg' },
      ],
      certifications: [],
      celebratedMemberIds: ['c'],
      teamChallenge: null,
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Verify my-score and top3 sections are side-by-side
    const myRect = await page.locator('section[aria-labelledby="my-score"]').boundingBox();
    const topRect = await page.locator('section[aria-labelledby="top3"]').boundingBox();
    log('T8', 'my=' + JSON.stringify(myRect));
    log('T8', 'top=' + JSON.stringify(topRect));
    if (myRect && topRect && Math.abs(myRect.y - topRect.y) < 20 && topRect.x > myRect.x + myRect.width - 50) {
      pass('T8.sbs', 'My Score and Top3 side-by-side on desktop');
    } else {
      fail('T8.sbs', `not side-by-side: myY=${myRect?.y}, topY=${topRect?.y}, myX=${myRect?.x}, topX=${topRect?.x}`);
    }

    // Overall ranking full-width (below)
    const ovRect = await page.locator('section[aria-labelledby="overall-ranking"]').boundingBox();
    if (ovRect && ovRect.y > (myRect?.y || 0) + (myRect?.height || 0) - 10) {
      pass('T8.full', 'ranking below row');
    } else {
      fail('T8.full', `ovY=${ovRect?.y}`);
    }

    await page.screenshot({ path: `${SHOT_DIR}/ranking-filled-desktop.png`, fullPage: true });

    results.consoleErrors.push(...errs);
    await ctx.close();
  }

} catch (e) {
  console.error('FATAL', e);
  fail('FATAL', e.message + '\n' + e.stack);
} finally {
  await browser.close();
  console.log('\n=== Summary ===');
  console.log('Passed:', results.passed.length);
  console.log('Failed:', results.failed.length);
  console.log('Console errors:', results.consoleErrors.length);
  if (results.consoleErrors.length) console.log(results.consoleErrors.slice(0, 30).join('\n'));
  if (results.failed.length) console.log('\nFailures:\n' + results.failed.join('\n'));
  fs.writeFileSync('C:/myunji/sd_gym/eval-round2-results.json', JSON.stringify(results, null, 2));
}
