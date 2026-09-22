import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Acceptance checks for the voice module in the real browser, at mobile width and desktop.
 * The dev server runs in DEMO_MODE, so the talk page uses the built-in call simulation and no
 * external service is contacted.
 */

async function mintTalkLink(request: APIRequestContext): Promise<{ talkUrl: string; sessionId: string; leadId: string }> {
  const sessions = await request.get('/api/voice/talk-sessions?limit=1');
  expect(sessions.ok()).toBeTruthy();
  const leadId: string = (await sessions.json()).sessions[0].lead_id;

  const invite = await request.post('/api/voice/talk-invite', { data: { lead_id: leadId, channel: 'EMAIL' } });
  expect(invite.ok()).toBeTruthy();
  const json = await invite.json();
  return { talkUrl: json.talk_url as string, sessionId: json.talk_session_id as string, leadId };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('Talk page (/talk/[token])', () => {
  test('shows the AI disclosure, requires consent, and completes a simulated call', async ({ page, request }) => {
    const { talkUrl, sessionId } = await mintTalkLink(request);
    const path = new URL(talkUrl).pathname;

    await page.goto(path);
    await expect(page.getByText('Statutory AI Voice Disclosure')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const start = page.getByRole('button', { name: 'Start Voice Call (WebRTC)' });
    await expect(start).toBeVisible();
    await expect(start).toBeDisabled();

    // The CTA must be reachable without scrolling sideways at 375px.
    const box = await start.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

    await page.getByRole('checkbox').check();
    await expect(start).toBeEnabled();
    await start.click();

    // In-call UI appears (simulation), then we hang up.
    const endCall = page.getByRole('button', { name: 'End Call' });
    await expect(endCall).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Namaste .*Apex AI SDR/)).toBeVisible({ timeout: 20_000 });
    await endCall.click();

    await expect(page.getByRole('heading', { name: 'Call Concluded' })).toBeVisible({ timeout: 15_000 });

    // The server recorded the call against the session (the completion event is posted asynchronously).
    await expect
      .poll(
        async () => {
          const after = await request.get('/api/voice/talk-sessions?status=COMPLETED&limit=200');
          const completed = (await after.json()).sessions as Array<{ id: string; call_count: number }>;
          return completed.find((s) => s.id === sessionId)?.call_count ?? 0;
        },
        { message: 'session should be COMPLETED with call_count >= 1', timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(1);
  });

  test('an unknown token shows the inactive-link page instead of an error', async ({ page }) => {
    await page.goto('/talk/not-a-real-token');
    await expect(page.getByRole('heading', { name: 'Link Inactive or Expired' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Voice Settings (/settings/voice)', () => {
  test('renders the provider-cost banner and the eight-point PSTN gate', async ({ page }) => {
    await page.goto('/settings/voice');
    await expect(page.getByTestId('provider-cost-banner')).toContainText('Provider cost not included');
    await expect(page.getByTestId('pstn-gate')).toBeVisible();
    await expect(page.getByTestId('pstn-gate').locator('li')).toHaveCount(8);
    await expect(page.getByTestId('pstn-gate-status')).toContainText(/READY|BLOCKED/);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Campaigns and dashboard', () => {
  test('a TALK_INVITE step is visible in the campaign sequence', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByText('TALK_INVITE · {{talk_link}}').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('the dashboard shows the voice analytics cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('voice-card-links')).toBeVisible();
    await expect(page.getByTestId('voice-card-meetings')).toBeVisible();
    await expect(page.getByTestId('voice-card-cost')).toContainText('₹');
    await expectNoHorizontalOverflow(page);
  });
});
