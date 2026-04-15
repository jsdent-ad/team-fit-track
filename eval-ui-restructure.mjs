// eval-ui-restructure.mjs
// Smoke tests for the UI restructure (ranking-first, member detail, calendar).
// T1: after signup at `/`, the "전체 순위" block sits above the "주간 차트" block.
// T2: clicking a name in the ranking navigates to /member/:id and shows that name.
// T3: `/records` exposes a "달력" / "리스트" toggle and switches rendering.
// T4: `/certify` today's cert thumbnails show a label containing `/` (e.g. "04/15").
//
// Usage: ensure `cd app && npm run dev` is running at http://localhost:5173
// Then from C:\myunji\sd_gym run: node eval-ui-restructure.mjs

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = { passed: [], failed: [], notes: [] };

function pass(k, msg) { console.log(`PASS [${k}] ${msg}`); results.passed.push(`[${k}] ${msg}`); }
function fail(k, msg) { console.log(`FAIL [${k}] ${msg}`); results.failed.push(`[${k}] ${msg}`); }
function note(k, msg) { console.log(`      [${k}] ${msg}`); results.notes.push(`[${k}] ${msg}`); }

function uniqCode(prefix = 'UI') {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${n}`;
}

async function dismissTour(page) {
  const skip = page.getByRole('button', { name: /건너뛰기/ });
  if (await skip.count()) {
    try { await skip.click({ timeout: 2000 }); } catch {}
    await page.waitForTimeout(300);
  }
}

async function createTeam(page, teamName, code) {
  await page.goto(BASE + '/team', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /\+ 새 팀 만들기/ }).click();
  await page.getByPlaceholder('우리 크루').fill(teamName);
  await page.getByPlaceholder(/예: CREW2026/).fill(code);
  await page.getByRole('button', { name: '팀 만들기', exact: true }).click();
  await page.waitForTimeout(1500);
  const nextBtn = page.getByRole('button', { name: /가입하기/ });
  if (await nextBtn.count()) await nextBtn.click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

async function signup(page, name, password = 'pw1234') {
  await page.waitForSelector('#login-name');
  const signupTab = page.getByRole('tab', { name: '회원가입' });
  if (await signupTab.count()) await signupTab.click();
  await page.locator('#login-name').fill(name);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-password-confirm').fill(password);
  await page.getByRole('button', { name: /회원가입/ }).click();
  await page.waitForURL(BASE + '/', { timeout: 8000 });
  await page.waitForTimeout(600);
  await dismissTour(page);
}

async function uploadTinyCert(page) {
  // Navigate to /certify
  await page.goto(BASE + '/certify', { waitUntil: 'networkidle' });
  // Create a tiny PNG buffer
  const fileInput = page.locator('input[type="file"]');
  // 1x1 transparent PNG
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  await fileInput.setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: buf,
  });
  await page.waitForTimeout(800);
  const submit = page.getByRole('button', { name: /인증 등록/ });
  await submit.click();
  await page.waitForTimeout(1500);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note('pageerror', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') note('console', m.text());
  });

  const code = uniqCode();
  const teamName = `UITeam-${code}`;

  try {
    await createTeam(page, teamName, code);
    await signup(page, 'Tester');
    await page.waitForURL(BASE + '/', { timeout: 8000 });
    await page.waitForTimeout(600);
  } catch (e) {
    fail('setup', e.message);
    await browser.close();
    printSummary();
    return;
  }

  // ======================================================================
  // T1: DOM order — ranking section is above the weekly chart
  // ======================================================================
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await dismissTour(page);
    const rankY = await page
      .getByRole('heading', { name: /전체 순위/ })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    const chartY = await page
      .getByRole('heading', { name: /주간 인증 추이/ })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    note('T1', `rankY=${Math.round(rankY)} chartY=${Math.round(chartY)}`);
    if (rankY < chartY) pass('T1', 'Overall ranking appears above weekly chart');
    else fail('T1', `Wrong order: rankY=${rankY} chartY=${chartY}`);
  } catch (e) {
    fail('T1', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T2: click ranking name → /member/:id shows that name
  // ======================================================================
  try {
    // the full-ranking button has aria-label "Tester 상세 보기"
    const btn = page.getByRole('button', { name: /Tester 상세 보기/ }).first();
    await btn.click();
    await page.waitForURL(/\/member\/[^/]+$/, { timeout: 5000 });
    const url = page.url();
    const nameVisible = await page
      .getByRole('heading', { name: /Tester/ })
      .first()
      .isVisible();
    note('T2', `url=${url} nameVisible=${nameVisible}`);
    if (/\/member\/[0-9a-f-]{6,}$/i.test(url) && nameVisible) {
      pass('T2', 'Member detail route loads with member name');
    } else {
      fail('T2', `URL or name mismatch (url=${url}, name=${nameVisible})`);
    }
  } catch (e) {
    fail('T2', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T3: /records has 달력/리스트 toggle and it switches
  // ======================================================================
  try {
    await page.goto(BASE + '/records', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const calTab = page.getByRole('tab', { name: '달력' });
    const listTab = page.getByRole('tab', { name: '리스트' });
    const calCount = await calTab.count();
    const listCount = await listTab.count();
    note('T3', `calCount=${calCount} listCount=${listCount}`);
    if (calCount < 1 || listCount < 1) {
      fail('T3', 'Tabs missing');
    } else {
      const calSelectedBefore = await calTab.getAttribute('aria-selected');
      await listTab.click();
      await page.waitForTimeout(300);
      const listSelectedAfter = await listTab.getAttribute('aria-selected');
      await calTab.click();
      await page.waitForTimeout(300);
      const calSelectedFinal = await calTab.getAttribute('aria-selected');
      if (
        calSelectedBefore === 'true' &&
        listSelectedAfter === 'true' &&
        calSelectedFinal === 'true'
      ) {
        pass('T3', 'Toggle switches between 달력 and 리스트');
      } else {
        fail(
          'T3',
          `aria-selected chain: cal=${calSelectedBefore} list=${listSelectedAfter} cal=${calSelectedFinal}`
        );
      }
    }
  } catch (e) {
    fail('T3', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T4: /certify today's cert shows "MM/DD HH:mm"-ish label with a "/"
  // ======================================================================
  try {
    await uploadTinyCert(page);
    await page.waitForTimeout(800);
    // Today section: find the 오늘의 내 인증 heading, then its sibling list
    const todayHeading = page.locator('h2', { hasText: '오늘의 내 인증' }).first();
    await todayHeading.waitFor({ timeout: 4000 });
    // Find the label near a thumbnail; check any text node in the section contains "/"
    // Use a scoped locator under the section.
    const section = todayHeading.locator('xpath=..'); // parent section
    const textSnapshot = await section.innerText();
    note('T4', `section text: ${textSnapshot.slice(0, 200).replace(/\n/g, ' | ')}`);
    // Accept any "MM/DD" pattern (two digits / two digits)
    if (/\b\d{2}\/\d{2}\b/.test(textSnapshot)) {
      pass('T4', 'Today thumbnails render an MM/DD label');
    } else {
      fail('T4', 'No MM/DD label found under 오늘의 내 인증');
    }
  } catch (e) {
    fail('T4', 'Exception: ' + e.message);
  }

  await ctx.close();
  await browser.close();
  printSummary();
}

function printSummary() {
  console.log('\n=== SUMMARY ===');
  console.log(`PASSED: ${results.passed.length}`);
  for (const p of results.passed) console.log('  ' + p);
  console.log(`FAILED: ${results.failed.length}`);
  for (const f of results.failed) console.log('  ' + f);
  if (results.notes.length) {
    console.log(`NOTES: ${results.notes.length}`);
    for (const n of results.notes) console.log('  ' + n);
  }
  process.exit(results.failed.length === 0 ? 0 : 1);
}

await run();
