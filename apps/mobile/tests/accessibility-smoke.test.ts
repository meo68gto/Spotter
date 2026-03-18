import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');

const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('accessibility smoke', () => {
  it('button component sets accessibility role and label', () => {
    const content = read('apps/mobile/src/components/Button.tsx');
    expect(content).toContain('accessibilityRole="button"');
    expect(content).toContain('accessibilityLabel={accessibilityLabel ?? title}');
  });

  it('critical auth inputs expose accessibility labels', () => {
    const login = read('apps/mobile/src/screens/auth/LoginScreen.tsx');
    const signUp = read('apps/mobile/src/screens/auth/SignUpScreen.tsx');
    expect(login).toContain('accessibilityLabel="Email address"');
    expect(login).toContain('accessibilityLabel="Password"');
    expect(signUp).toContain('accessibilityLabel="Email address"');
    expect(signUp).toContain('accessibilityLabel="Password"');
  });

  it('high traffic inbox/home controls expose accessibility labels', () => {
    const home = read('apps/mobile/src/screens/dashboard/HomeScreen.tsx');
    const inbox = read('apps/mobile/src/screens/dashboard/inbox/ConversationsListScreen.tsx');
    expect(home).toContain('accessibilityLabel={`Open ${action.label}`}');
    expect(inbox).toContain('accessibilityLabel={`Open ${thread.threadType} conversation ${thread.title}`}');
  });
});
