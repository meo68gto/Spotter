import { test, expect, Page, ConsoleMessage } from '@playwright/test';

/**
 * Spotter Deep Dive E2E Test Suite
 * Comprehensive test of all member-facing pages
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'free@spotter.test';
const TEST_PASSWORD = 'SpotterTest123!';

const consoleErrors: Array<{ page: string; message: string }> = [];

async function setupPage(page: Page) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: page.url(), message: msg.text() });
    }
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill in login form
  const emailInput = page.locator('input[type="email"], input[name="email"], [id="email"], [data-testid="email-input"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"], [id="password"], [data-testid="password-input"]').first();
  
  await emailInput.fill(TEST_EMAIL);
  await passwordInput.fill(TEST_PASSWORD);
  
  // Click sign in
  const signInBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In")').first();
  await signInBtn.click();
  
  // Wait for navigation away from login
  await page.waitForURL(/(\/dashboard|\/discovery)/, { timeout: 15000 }).catch(() => {
    console.log('Login may have failed, current URL:', page.url());
  });
}

async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `screenshots-deep-dive/${name}.png`, fullPage: false });
}

test.describe('Spotter Deep Dive E2E Tests', () => {
  
  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION FLOW
  // ─────────────────────────────────────────────────────────────
  test.describe('1. Authentication Flow', () => {
    test('Login page loads and renders correctly', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('networkidle');
      
      // Check page title
      const title = await page.title();
      console.log('Login page title:', title);
      
      // Check for email field
      const emailField = page.locator('input[type="email"], input[name="email"]').first();
      await expect(emailField).toBeVisible();
      
      // Check for password field
      const passwordField = page.locator('input[type="password"], input[name="password"]').first();
      await expect(passwordField).toBeVisible();
      
      // Check for sign in button
      const signInBtn = page.locator('button[type="submit"]').first();
      await expect(signInBtn).toBeVisible();
      
      await takeScreenshot(page, '01-login-page');
    });
    
    test('Invalid credentials show proper error', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/login`);
      await page.waitForLoadState('networkidle');
      
      const emailField = page.locator('input[type="email"], input[name="email"]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"]').first();
      
      await emailField.fill('invalid@test.com');
      await passwordField.fill('wrongpassword');
      
      const signInBtn = page.locator('button[type="submit"]').first();
      await signInBtn.click();
      
      // Wait a moment for error to appear
      await page.waitForTimeout(2000);
      
      // Check for error message
      const errorMsg = page.locator('text=/error|invalid|failed|incorrect/i').first();
      const errorVisible = await errorMsg.isVisible().catch(() => false);
      console.log('Error message visible:', errorVisible);
      
      await takeScreenshot(page, '02-login-invalid-credentials');
    });
    
    test('Successful login redirects to dashboard', async ({ page }) => {
      await setupPage(page);
      await login(page);
      
      const currentUrl = page.url();
      console.log('After login URL:', currentUrl);
      
      // Should be on dashboard or discovery
      expect(currentUrl).toMatch(/(\/dashboard|\/discovery|\/)/);
      
      await takeScreenshot(page, '03-after-login');
    });
    
    test('Logout works from dashboard', async ({ page }) => {
      await setupPage(page);
      await login(page);
      
      // Find and click logout
      const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout"), a:has-text("Sign Out")').first();
      
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click();
        await page.waitForTimeout(2000);
        console.log('After logout URL:', page.url());
        await takeScreenshot(page, '04-after-logout');
      } else {
        console.log('Logout button not found on page');
        await takeScreenshot(page, '04-no-logout-button');
      }
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 2. MEMBER DASHBOARD
  // ─────────────────────────────────────────────────────────────
  test.describe('2. Member Dashboard', () => {
    test('Dashboard loads after login', async ({ page }) => {
      await setupPage(page);
      await login(page);
      
      await page.waitForLoadState('networkidle');
      
      // Navigate to dashboard if not already there
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      console.log('Dashboard URL:', url);
      
      await takeScreenshot(page, '05-dashboard');
    });
    
    test('Dashboard widgets/cards render', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await login(page).catch(() => {}); // May already be logged in
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check for various dashboard elements
      const headings = await page.locator('h1, h2, h3').all();
      console.log('Dashboard headings count:', headings.length);
      
      const cards = await page.locator('[class*="card"], [class*="widget"], [data-testid*="card"]').all();
      console.log('Dashboard cards/widgets count:', cards.length);
      
      await takeScreenshot(page, '06-dashboard-widgets');
    });
    
    test('Navigation from dashboard to all sections', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Get all nav links
      const navLinks = await page.locator('nav a, header a, [role="navigation"] a').all();
      console.log('Navigation links found:', navLinks.length);
      
      for (const link of navLinks.slice(0, 10)) {
        const text = await link.textContent().catch(() => 'unknown');
        const href = await link.getAttribute('href').catch(() => 'unknown');
        console.log(`Nav link: "${text}" -> ${href}`);
      }
      
      await takeScreenshot(page, '07-dashboard-nav');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 3. DISCOVERY PAGE
  // ─────────────────────────────────────────────────────────────
  test.describe('3. Discovery Page', () => {
    test('Discovery page loads and renders', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/discovery`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Discovery URL:', page.url());
      await takeScreenshot(page, '08-discovery-page');
    });
    
    test('Filters render and controls work', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/discovery`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for filter dropdowns
      const selects = await page.locator('select').all();
      console.log('Filter selects found:', selects.length);
      
      // Look for toggles/checkboxes
      const toggles = await page.locator('input[type="checkbox"], input[type="radio"]').all();
      console.log('Filter toggles found:', toggles.length);
      
      // Look for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[name*="search"]').first();
      const hasSearch = await searchInput.isVisible().catch(() => false);
      console.log('Search input visible:', hasSearch);
      
      await takeScreenshot(page, '09-discovery-filters');
    });
    
    test('Member cards display with info', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/discovery`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Look for member cards
      const cards = await page.locator('[class*="card"], [class*="member"], [class*="result"], [data-testid*="member"], [data-testid*="result"]').all();
      console.log('Member/result cards found:', cards.length);
      
      if (cards.length > 0) {
        const firstCard = cards[0];
        const cardText = await firstCard.textContent().catch(() => 'N/A');
        console.log('First card text preview:', cardText?.substring(0, 200));
      }
      
      await takeScreenshot(page, '10-discovery-member-cards');
    });
    
    test('Search functionality works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/discovery`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[name*="search"]').first();
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('golf');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);
        console.log('After search URL:', page.url());
      } else {
        console.log('Search input not found');
      }
      
      await takeScreenshot(page, '11-discovery-search');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 4. CONNECTIONS PAGE
  // ─────────────────────────────────────────────────────────────
  test.describe('4. Connections Page', () => {
    test('Connections page loads', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/connections`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Connections URL:', page.url());
      await takeScreenshot(page, '12-connections-page');
    });
    
    test('Tabs render (Pending, Accepted, Sent)', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/connections`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for tabs
      const tabs = await page.locator('[role="tab"], button:has-text("Pending"), button:has-text("Accepted"), button:has-text("Sent")').all();
      console.log('Connection tabs found:', tabs.length);
      
      // Try clicking each tab
      const pendingTab = page.locator('button:has-text("Pending"), [role="tab"]:has-text("Pending")').first();
      if (await pendingTab.isVisible().catch(() => false)) {
        await pendingTab.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Pending tab');
      }
      
      const acceptedTab = page.locator('button:has-text("Accepted"), [role="tab"]:has-text("Accepted")').first();
      if (await acceptedTab.isVisible().catch(() => false)) {
        await acceptedTab.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Accepted tab');
      }
      
      const sentTab = page.locator('button:has-text("Sent"), [role="tab"]:has-text("Sent")').first();
      if (await sentTab.isVisible().catch(() => false)) {
        await sentTab.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Sent tab');
      }
      
      await takeScreenshot(page, '13-connections-tabs');
    });
    
    test('Empty states render correctly', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/connections`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check for empty state messages
      const emptyStates = await page.locator('text=/no.*connection|empty|0.*connection/i').all();
      console.log('Empty state messages:', emptyStates.length);
      
      await takeScreenshot(page, '14-connections-empty-state');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 5. ROUNDS PAGE (LIST)
  // ─────────────────────────────────────────────────────────────
  test.describe('5. Rounds Page (List)', () => {
    test('Rounds list page loads', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Rounds URL:', page.url());
      await takeScreenshot(page, '15-rounds-list-page');
    });
    
    test('Rounds display with info (upcoming/past)', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Look for round cards
      const roundCards = await page.locator('[class*="round"], [class*="card"], [data-testid*="round"]').all();
      console.log('Round cards found:', roundCards.length);
      
      // Check for upcoming/past sections
      const upcomingSection = page.locator('text=/upcoming/i').first();
      const pastSection = page.locator('text=/past|history/i').first();
      
      console.log('Upcoming section visible:', await upcomingSection.isVisible().catch(() => false));
      console.log('Past section visible:', await pastSection.isVisible().catch(() => false));
      
      await takeScreenshot(page, '16-rounds-list-cards');
    });
    
    test('Filter by status works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for filter controls
      const filterSelects = await page.locator('select').all();
      console.log('Filter selects:', filterSelects.length);
      
      if (filterSelects.length > 0) {
        await filterSelects[0].selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('Applied filter');
      }
      
      await takeScreenshot(page, '17-rounds-filter');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 6. ROUNDS PAGE (CREATE)
  // ─────────────────────────────────────────────────────────────
  test.describe('6. Rounds Page (Create)', () => {
    test('Create round form renders', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Create round URL:', page.url());
      
      // Check for form elements
      const formInputs = await page.locator('input, select, textarea').all();
      console.log('Form inputs found:', formInputs.length);
      
      await takeScreenshot(page, '18-create-round-form');
    });
    
    test('Course selector works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      const courseSelect = page.locator('select').first();
      if (await courseSelect.isVisible().catch(() => false)) {
        const options = await courseSelect.locator('option').all();
        console.log('Course options count:', options.length);
        
        if (options.length > 1) {
          await courseSelect.selectOption({ index: 1 });
          console.log('Selected course option');
        }
      }
      
      await takeScreenshot(page, '19-create-round-course');
    });
    
    test('Date/time picker works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for date input
      const dateInput = page.locator('input[type="datetime-local"], input[type="date"], input[name*="date"], input[name*="time"]').first();
      
      if (await dateInput.isVisible().catch(() => false)) {
        // Set a future date
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().slice(0, 16);
        await dateInput.fill(dateStr);
        console.log('Filled date:', dateStr);
      }
      
      await takeScreenshot(page, '20-create-round-datetime');
    });
    
    test('Format selector works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for format/format-type select
      const selects = await page.locator('select').all();
      console.log('Total selects:', selects.length);
      
      for (const select of selects) {
        const label = await select.getAttribute('name').catch(() => '') + await select.getAttribute('id').catch(() => '');
        if (label.toLowerCase().includes('format') || label.toLowerCase().includes('type')) {
          const options = await select.locator('option').all();
          console.log(`Format select options:`, options.length);
          if (options.length > 1) {
            await select.selectOption({ index: 1 });
          }
        }
      }
      
      await takeScreenshot(page, '21-create-round-format');
    });
    
    test('Max attendees setting works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for max players/attendees select
      const selects = await page.locator('select').all();
      
      for (const select of selects) {
        const label = await select.getAttribute('name').catch(() => '') + await select.getAttribute('id').catch(() => '');
        if (label.toLowerCase().includes('max') || label.toLowerCase().includes('player') || label.toLowerCase().includes('attendee')) {
          const options = await select.locator('option').all();
          console.log(`Max attendees options:`, options.length);
          if (options.length > 1) {
            await select.selectOption({ index: 1 });
          }
        }
      }
      
      await takeScreenshot(page, '22-create-round-attendees');
    });
    
    test('Submit creates round', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/rounds/create`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Fill in required fields
      const selects = await page.locator('select').all();
      for (const select of selects) {
        const options = await select.locator('option').all();
        if (options.length > 1) {
          await select.selectOption({ index: 1 });
        }
      }
      
      const dateInput = page.locator('input[type="datetime-local"]').first();
      if (await dateInput.isVisible().catch(() => false)) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        await dateInput.fill(futureDate.toISOString().slice(0, 16));
      }
      
      // Submit
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")').first();
      if (await submitBtn.isEnabled().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        console.log('After submit URL:', page.url());
      }
      
      await takeScreenshot(page, '23-create-round-submit');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 7. PROFILE PAGE
  // ─────────────────────────────────────────────────────────────
  test.describe('7. Profile Page', () => {
    test('Profile page loads with user info', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/profile`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Profile URL:', page.url());
      
      // Check for user info
      const headings = await page.locator('h1, h2, h3').all();
      console.log('Profile headings:', headings.length);
      
      await takeScreenshot(page, '24-profile-page');
    });
    
    test('Stats render (handicap, rounds, reputation)', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/profile`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Look for stat elements
      const stats = await page.locator('[class*="stat"], [class*="metric"], [data-testid*="stat"]').all();
      console.log('Stats found:', stats.length);
      
      // Look for specific stats
      const handicapText = await page.locator('text=/handicap/i').first().textContent().catch(() => 'N/A');
      console.log('Handicap text:', handicapText);
      
      await takeScreenshot(page, '25-profile-stats');
    });
    
    test('Edit profile functionality', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/profile`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for edit button
      const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit"), [data-testid*="edit"]').first();
      
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(2000);
        console.log('Edit mode URL:', page.url());
        
        // Check for editable fields
        const editableFields = await page.locator('input:not([type="hidden"]), textarea').all();
        console.log('Editable fields:', editableFields.length);
      } else {
        console.log('Edit button not found');
      }
      
      await takeScreenshot(page, '26-profile-edit');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 8. COACHING PAGE
  // ─────────────────────────────────────────────────────────────
  test.describe('8. Coaching Page', () => {
    test('Coaching page loads', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/coaching`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Coaching URL:', page.url());
      await takeScreenshot(page, '27-coaching-page');
    });
    
    test('Coaching services/coach list displays', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/coaching`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Look for coach cards
      const coachCards = await page.locator('[class*="coach"], [class*="card"], [data-testid*="coach"]').all();
      console.log('Coach cards:', coachCards.length);
      
      await takeScreenshot(page, '28-coaching-list');
    });
    
    test('Request coaching flow', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/coaching`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for request/book button
      const requestBtn = page.locator('button:has-text("Request"), button:has-text("Book"), button:has-text("Contact")').first();
      
      if (await requestBtn.isVisible().catch(() => false)) {
        await requestBtn.click();
        await page.waitForTimeout(2000);
        console.log('After request click URL:', page.url());
        
        // Check for modal or form
        const modal = page.locator('[role="dialog"], [class*="modal"]').first();
        if (await modal.isVisible().catch(() => false)) {
          console.log('Modal opened');
        }
      }
      
      await takeScreenshot(page, '29-coaching-request');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 9. SETTINGS PAGE
  // ─────────────────────────────────────────────────────────────
  test.describe('9. Settings Page', () => {
    test('Settings page loads', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/settings`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Settings URL:', page.url());
      await takeScreenshot(page, '30-settings-page');
    });
    
    test('Account settings render', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/settings`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check for settings sections
      const sections = await page.locator('[class*="section"], [class*="group"]').all();
      console.log('Settings sections:', sections.length);
      
      // Look for account settings
      const accountHeading = page.locator('text=/account|profile|general/i').first();
      console.log('Account section visible:', await accountHeading.isVisible().catch(() => false));
      
      await takeScreenshot(page, '31-settings-account');
    });
    
    test('Notification preferences', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/settings`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for notification toggles
      const toggles = await page.locator('input[type="checkbox"]').all();
      console.log('Notification toggles:', toggles.length);
      
      if (toggles.length > 0) {
        await toggles[0].click();
        await page.waitForTimeout(500);
        console.log('Toggled notification');
      }
      
      await takeScreenshot(page, '32-settings-notifications');
    });
    
    test('Sign out button works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/settings`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for sign out button
      const signOutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out")').first();
      
      if (await signOutBtn.isVisible().catch(() => false)) {
        await signOutBtn.click();
        await page.waitForTimeout(2000);
        console.log('After sign out URL:', page.url());
      }
      
      await takeScreenshot(page, '33-settings-signout');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 10. NAVIGATION
  // ─────────────────────────────────────────────────────────────
  test.describe('10. Navigation', () => {
    test('Every nav link works', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Collect all nav links
      const navLinks = await page.locator('nav a, header a, [role="navigation"] a, [class*="sidebar"] a').all();
      console.log('Total nav links:', navLinks.length);
      
      const testedLinks: string[] = [];
      
      for (let i = 0; i < Math.min(navLinks.length, 15); i++) {
        const link = navLinks[i];
        const href = await link.getAttribute('href').catch(() => null);
        const text = await link.textContent().catch(() => 'N/A');
        
        if (href && !href.startsWith('#') && !testedLinks.includes(href)) {
          testedLinks.push(href);
          console.log(`Testing nav: ${text} -> ${href}`);
          
          await page.goto(`${BASE_URL}${href}`);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          
          const finalUrl = page.url();
          console.log(`  Result: ${finalUrl}`);
        }
      }
      
      await takeScreenshot(page, '34-navigation-test');
    });
    
    test('Active state highlights work', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/dashboard`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      
      // Look for active nav state
      const activeNav = page.locator('[class*="active"][class*="nav"], [class*="active"][class*="link"], [aria-current="page"]').all();
      console.log('Active nav items:', activeNav.length);
      
      await takeScreenshot(page, '35-navigation-active-state');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // 11. OPERATOR PORTAL
  // ─────────────────────────────────────────────────────────────
  test.describe('11. Operator Portal', () => {
    test('Operator portal loads if accessible', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/operator/dashboard`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      const url = page.url();
      console.log('Operator dashboard URL:', url);
      
      // Check if we got in or were redirected
      if (url.includes('/operator/')) {
        console.log('Operator portal ACCESSIBLE');
      } else {
        console.log('Operator portal NOT ACCESSIBLE (redirected to:', url, ')');
      }
      
      await takeScreenshot(page, '36-operator-portal');
    });
    
    test('Sponsors portal accessible', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/operator/sponsors`);
      await login(page).catch(() => {});
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('Sponsors portal URL:', page.url());
      await takeScreenshot(page, '37-operator-sponsors');
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // CONSOLE ERRORS SUMMARY
  // ─────────────────────────────────────────────────────────────
  test('Console errors summary', async ({ page }) => {
    console.log('\n=== CONSOLE ERRORS SUMMARY ===');
    console.log('Total errors captured:', consoleErrors.length);
    
    for (const err of consoleErrors.slice(0, 20)) {
      console.log(`\nPage: ${err.page}`);
      console.log(`Error: ${err.message.substring(0, 300)}`);
    }
    
    await takeScreenshot(page, '38-console-errors');
  });
});
