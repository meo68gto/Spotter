describe('coaching booking smoke', () => {
  it('opens coaching tab shell', async () => {
    await element(by.text('Coaching')).tap();
    await expect(element(by.text('Coaching'))).toBeVisible();
  });
});
