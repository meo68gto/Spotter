describe('dashboard core', () => {
  it('renders primary tabs after session', async () => {
    await expect(element(by.text('Home'))).toBeVisible();
    await expect(element(by.text('Discover'))).toBeVisible();
    await expect(element(by.text('Inbox'))).toBeVisible();
  });
});
