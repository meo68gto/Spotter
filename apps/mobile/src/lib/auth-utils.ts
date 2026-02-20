export const extractOAuthCode = (callbackUrl: string | undefined): string | null => {
  if (!callbackUrl) return null;
  try {
    const parsed = new URL(callbackUrl);
    return parsed.searchParams.get('code');
  } catch {
    return null;
  }
};
