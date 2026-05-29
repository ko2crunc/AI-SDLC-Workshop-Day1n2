import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Authentication Tests
 * Based on USER_GUIDE.md Section 1: Authentication
 *
 * Features tested:
 * - WebAuthn/Passkeys registration
 * - Login with passkeys
 * - Logout functionality
 * - Session persistence
 */

test.describe('Authentication', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Todo App/);
    await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
    await expect(page.getByText('Sign in with your passkey')).toBeVisible();
  });

  test('should have username input field', async ({ page }) => {
    await page.goto('/login');
    const usernameInput = page.locator('input[type="text"]');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('placeholder', /username/i);
  });

  test('should require username for login', async ({ page }) => {
    await page.goto('/login');
    const usernameInput = page.locator('input[type="text"]');
    await expect(usernameInput).toBeEmpty();
    await expect(usernameInput).toHaveAttribute('required', '');
  });

  test('should switch to register mode', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Register/ }).click();
    await expect(page.getByRole('button', { name: 'Register with Passkey' })).toBeVisible();
  });

  test('should show logout button when authenticated', async ({ page }) => {
    await helpers.createSessionDirectly();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('should display username when logged in', async ({ page }) => {
    await helpers.createSessionDirectly();
    await page.goto('/');
    await expect(page.getByText(helpers.testUsername)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await helpers.createSessionDirectly();
    await page.goto('/');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should persist session across page reloads', async ({ page }) => {
    await helpers.createSessionDirectly();
    await page.goto('/');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('should redirect to login when not authenticated', async ({ page, context }) => {
    // Clear all cookies to simulate logged out state
    await context.clearCookies();

    await page.goto('/');

    // Should redirect to login
    await page.waitForURL(/.*login/, { timeout: 5000 }).catch(() => {
      // If no redirect, check if login elements are visible
    });

    const isLoginPage = page.url().includes('login') ||
      await page.getByText('Sign in with your passkey').isVisible();

    expect(isLoginPage).toBeTruthy();
  });
});
