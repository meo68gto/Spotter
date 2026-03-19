describe('inbox chat smoke', () => {
  it('opens inbox list shell', async () => {
    await element(by.text('Inbox')).tap();
    await expect(element(by.text('Notifications'))).toBeVisible();
  });
});
