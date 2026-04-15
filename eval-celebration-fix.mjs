// eval-celebration-fix.mjs
// Regression tests for the "premature celebration" bug.
// T1: sign up (blank goal) → /goals → no confetti
// T2: sign up (blank goal) → /goals edit current=65 target=65 (leave start blank) → score=0, no confetti
// T3: sign up with start=80 current=80 target=65 → edit current=65 → REAL confetti fires
// T4: after T3, edit current=60 then back to 65 → no re-confetti
// T5: hard reload after T3 → no re-confetti
// T6: second incognito member joins same team → sees leader is done, but NO confetti for them
//
// Usage: ensure `cd app && npm run dev` is running at http://localhost:5173
// Then from C:\myunji\sd_gym run: node eval-celebration-fix.mjs

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = { passed: [], failed: [], notes: [] };

function pass(k, msg) { console.log(`PASS [${k}] ${msg}`); results.passed.push(`[${k}] ${msg}`); }
function fail(k, msg) { console.log(`FAIL [${k}] ${msg}`); results.failed.push(`[${k}] ${msg}`); }
function note(k, msg) { console.log(`      [${k}] ${msg}`); results.notes.push(`[${k}] ${msg}`); }

const browser = await chromium.launch({ headless: true });

function uniqCode(prefix = 'EV') {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${n}`;
}

async function newSession() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const confettiCalls = { count: 0 };
  // Patch canvas-confetti detection: we hook into canvas creation because
  // canvas-confetti injects a <canvas> element on first call.
  await page.addInitScript(() => {
    window.__confettiFired = 0;
    const origAppend = Element.prototype.appendChild;
    Element.prototype.appendChild = function (node) {
      if (node && node.tagName === 'CANVAS' && node.style && node.style.position === 'fixed') {
        window.__confettiFired = (window.__confettiFired || 0) + 1;
      }
      return origAppend.call(this, node);
    };
  });
  page.on('console', (m) => {
    if (m.type() === 'error') note('console', m.text());
  });
  page.on('pageerror', (e) => note('pageerror', e.message));
  return { ctx, page, confettiCalls };
}

async function confettiCount(page) {
  // Celebration modal is the definitive signal (uses the same criteria as confetti)
  const modal = await page.locator('[role="dialog"][aria-labelledby="celebration-title"]').count();
  return modal;
}

async function waitSettle(page, ms = 900) {
  await page.waitForTimeout(ms);
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
  // Wait for either the "created" screen (normal) OR direct transition.
  await page.waitForTimeout(1500);
  // If there's an error banner, log it.
  const errTxt = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  if (errTxt) note('createTeam', 'error: ' + errTxt);
  // Click "다음 — 가입하기" if visible
  const nextBtn = page.getByRole('button', { name: /가입하기/ });
  if (await nextBtn.count()) {
    await nextBtn.click();
  }
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

async function joinExistingTeam(page, code) {
  await page.goto(BASE + '/team', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /팀 코드로 참여하기/ }).click();
  await page.getByPlaceholder(/ABC234/i).fill(code);
  await page.getByRole('button', { name: /참여하기/ }).click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

async function signupBlankGoal(page, name, password = 'pw1234') {
  // LoginPage defaults to signup when no members exist
  await page.waitForSelector('#login-name');
  // Ensure "signup" mode
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

async function signupWithGoal(page, name, password, { start, current, target, goalType = 'weight' }) {
  await page.waitForSelector('#login-name');
  const signupTab = page.getByRole('tab', { name: '회원가입' });
  if (await signupTab.count()) await signupTab.click();
  await page.locator('#login-name').fill(name);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-password-confirm').fill(password);
  // expand "목표 미리 설정"
  await page.locator('summary', { hasText: '목표 미리 설정' }).click();
  const nums = page.locator('details input[type="number"]');
  // ordering: 시작치, 현재치, 목표치
  await nums.nth(0).fill(String(start));
  await nums.nth(1).fill(String(current));
  await nums.nth(2).fill(String(target));
  await page.getByRole('button', { name: /회원가입/ }).click();
  await page.waitForURL(BASE + '/', { timeout: 8000 });
  await page.waitForTimeout(600);
  await dismissTour(page);
}

async function editGoal(page, { start, current, target }) {
  await page.goto(BASE + '/goals', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^수정$/ }).click();
  await page.waitForTimeout(200);
  // Find the 4 number inputs in the edit form: 시작치, 현재치, 목표치, 단위(text)
  const numInputs = page.locator('input[type="number"]');
  if (start === null) {
    await numInputs.nth(0).fill('');
  } else if (start !== undefined) {
    await numInputs.nth(0).fill(String(start));
  }
  if (current !== undefined) {
    await numInputs.nth(1).fill(String(current));
  }
  if (target !== undefined) {
    await numInputs.nth(2).fill(String(target));
  }
  await page.getByRole('button', { name: /^저장$/ }).click();
  await waitSettle(page, 1200);
}

async function getMyGoalScore(page) {
  // The text "목표 {n}점" in the goals page MyMemberRow
  const txt = await page.locator('main').first().textContent();
  const m = txt && txt.match(/목표\s+(\d+)점/);
  return m ? Number(m[1]) : null;
}

async function run() {
  const code = uniqCode();
  const teamName = `EvalTeam-${code}`;

  // ======================================================================
  // T1: signup (blank goal) → /goals → no confetti
  // ======================================================================
  let leaderCtx, leaderPage;
  try {
    const s1 = await newSession();
    leaderCtx = s1.ctx; leaderPage = s1.page;
    await createTeam(leaderPage, teamName, code);
    await signupBlankGoal(leaderPage, 'Leader');
    await waitSettle(leaderPage, 1000);
    await leaderPage.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    await waitSettle(leaderPage, 800);
    const modals = await confettiCount(leaderPage);
    const fired = await leaderPage.evaluate(() => window.__confettiFired || 0);
    if (modals === 0 && fired === 0) pass('T1', 'No celebration after blank signup');
    else fail('T1', `Unexpected celebration: modal=${modals} confetti=${fired}`);
  } catch (e) {
    fail('T1', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T2: in /goals, edit to start=blank, current=65, target=65 → NO confetti, score=0
  // ======================================================================
  try {
    // reuse leaderPage from T1 (still logged in as Leader)
    await editGoal(leaderPage, { start: null, current: 65, target: 65 });
    const modals = await confettiCount(leaderPage);
    const fired = await leaderPage.evaluate(() => window.__confettiFired || 0);
    const score = await getMyGoalScore(leaderPage);
    note('T2', `modal=${modals} confetti=${fired} score=${score}`);
    if (modals === 0 && fired === 0) pass('T2', `No premature confetti (score=${score})`);
    else fail('T2', `Premature celebration fired (modal=${modals} confetti=${fired})`);
  } catch (e) {
    fail('T2', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T3: sign up fresh user with start=80, current=80, target=65 → edit
  //     current to 65 → REAL confetti must fire
  // ======================================================================
  // Need a clean slate: new team + new user.
  const code3 = uniqCode();
  let achieverCtx, achieverPage;
  try {
    const s3 = await newSession();
    achieverCtx = s3.ctx; achieverPage = s3.page;
    await createTeam(achieverPage, `Ach-${code3}`, code3);
    await signupWithGoal(achieverPage, 'Champ', 'pw1234', { start: 80, current: 80, target: 65 });
    await waitSettle(achieverPage, 1000);
    // initial score should be 0 (current == start)
    await achieverPage.goto(BASE + '/goals', { waitUntil: 'networkidle' });
    const initialScore = await getMyGoalScore(achieverPage);
    const preFired = await achieverPage.evaluate(() => window.__confettiFired || 0);
    note('T3', `initial score=${initialScore} preFired=${preFired}`);

    // Now edit current → 65 (real transition to 100)
    await achieverPage.getByRole('button', { name: /^수정$/ }).click();
    await achieverPage.waitForTimeout(200);
    const numInputs = achieverPage.locator('input[type="number"]');
    await numInputs.nth(1).fill('65');
    await achieverPage.getByRole('button', { name: /^저장$/ }).click();
    await waitSettle(achieverPage, 1500);

    const modals = await confettiCount(achieverPage);
    const fired = await achieverPage.evaluate(() => window.__confettiFired || 0);
    note('T3', `after edit modal=${modals} confetti=${fired}`);
    if (modals >= 1 && fired - preFired >= 1) pass('T3', 'Real achievement confetti fired');
    else fail('T3', `Real achievement did NOT fire (modal=${modals} confetti=${fired})`);

    // Close the modal
    if (modals >= 1) {
      await achieverPage.getByRole('button', { name: /^확인$/ }).click();
      await waitSettle(achieverPage, 500);
    }
  } catch (e) {
    fail('T3', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T4: after T3 achievement, edit current=60 then back=65 → no re-fire
  // ======================================================================
  try {
    if (!achieverPage) throw new Error('achieverPage missing');
    const before = await achieverPage.evaluate(() => window.__confettiFired || 0);
    // edit to 60 (score stays 100 due to clamp) then back to 65
    await achieverPage.getByRole('button', { name: /^수정$/ }).click();
    await achieverPage.waitForTimeout(150);
    let nums = achieverPage.locator('input[type="number"]');
    await nums.nth(1).fill('60');
    await achieverPage.getByRole('button', { name: /^저장$/ }).click();
    await waitSettle(achieverPage, 1000);
    await achieverPage.getByRole('button', { name: /^수정$/ }).click();
    await achieverPage.waitForTimeout(150);
    nums = achieverPage.locator('input[type="number"]');
    await nums.nth(1).fill('65');
    await achieverPage.getByRole('button', { name: /^저장$/ }).click();
    await waitSettle(achieverPage, 1500);

    const after = await achieverPage.evaluate(() => window.__confettiFired || 0);
    const modals = await confettiCount(achieverPage);
    note('T4', `before=${before} after=${after} modal=${modals}`);
    if (after === before && modals === 0) pass('T4', 'No re-fire after re-edits');
    else fail('T4', `Re-fire detected (delta=${after - before}, modal=${modals})`);
  } catch (e) {
    fail('T4', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T5: hard reload on achieverPage → no re-fire
  // ======================================================================
  try {
    if (!achieverPage) throw new Error('achieverPage missing');
    // Reset __confettiFired by full reload (init script re-runs, counter resets)
    await achieverPage.reload({ waitUntil: 'networkidle' });
    await waitSettle(achieverPage, 2000);
    const fired = await achieverPage.evaluate(() => window.__confettiFired || 0);
    const modals = await confettiCount(achieverPage);
    if (fired === 0 && modals === 0) pass('T5', 'No celebration on reload');
    else fail('T5', `Celebration re-fired on reload (confetti=${fired} modal=${modals})`);
  } catch (e) {
    fail('T5', 'Exception: ' + e.message);
  }

  // ======================================================================
  // T6: a second browser joins the ACHIEVER team → sees leader at 100
  //     but no celebration on THEIR screen
  // ======================================================================
  try {
    const s6 = await newSession();
    const page2 = s6.page;
    await joinExistingTeam(page2, code3);
    await signupBlankGoal(page2, 'Buddy');
    await waitSettle(page2, 2000);
    // They are at / (RankingPage). Leader "Champ" should show with 100% goal
    // but NO celebration for Buddy.
    const fired = await page2.evaluate(() => window.__confettiFired || 0);
    const modals = await confettiCount(page2);
    if (fired === 0 && modals === 0) pass('T6', 'Second-device member gets no confetti for leader achievement');
    else fail('T6', `Second-device incorrectly fired (confetti=${fired} modal=${modals})`);
    await s6.ctx.close();
  } catch (e) {
    fail('T6', 'Exception: ' + e.message);
  }

  if (leaderCtx) await leaderCtx.close();
  if (achieverCtx) await achieverCtx.close();
  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log(`PASSED: ${results.passed.length}`);
  for (const p of results.passed) console.log('  ' + p);
  console.log(`FAILED: ${results.failed.length}`);
  for (const f of results.failed) console.log('  ' + f);
  process.exit(results.failed.length === 0 ? 0 : 1);
}

await run();
