describe('auth and onboarding', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows welcome and allows auth entry', async () => {
    await expect(element(by.text('SPOTTER'))).toBeVisible();
    await expect(element(by.text('Log In'))).toBeVisible();
  });
});
