# Contributing Guide

Guidelines for contributing to the Spotter project.

## Overview

Thank you for your interest in contributing to Spotter! This guide covers:
- Development workflow
- Code standards
- Pull request process
- Testing requirements

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local Supabase)
- iOS Simulator / Android Emulator

### Setup Steps

```bash
# Clone repository
git clone https://github.com/spotter-golf/spotter.git
cd spotter

# Install dependencies
pnpm install

# Start local Supabase
pnpm local:up

# Run smoke tests
pnpm smoke:local

# Start mobile app
pnpm mobile:dev
```

## Development Workflow

### Branch Naming

Format: `<type>/<description>`

Types:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation

Examples:
```
feature/tier-upgrade-flow
bugfix/connection-race-condition
hotfix/stripe-webhook-security
docs/api-authentication
```

### Commit Messages

Use conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

Examples:
```
feat(tier): add summit tier benefits
fix(connection): handle duplicate requests
docs(api): update authentication examples
refactor(profile): simplify profile update flow
```

### Making Changes

1. **Create branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes:**
   - Write code
   - Add/update tests
   - Update documentation

3. **Run tests:**
```bash
pnpm test
pnpm smoke:local
```

4. **Commit:**
```bash
git add .
git commit -m "feat(scope): description"
```

5. **Push:**
```bash
git push origin feature/your-feature-name
```

## Code Standards

### TypeScript

```typescript
// Good
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

function getUser(id: string): Promise<UserProfile> {
  // implementation
}

// Bad
function getUser(id) {
  // implementation
}
```

### React Components

```typescript
// Good - Functional component with types
interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function Button({ title, onPress, disabled }: ButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}

// Bad - No types, implicit returns
function Button(props) {
  return <button>{props.title}</button>;
}
```

### Edge Functions

```typescript
// Good - Proper error handling
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  try {
    const body = await req.json();
    // validation
    // processing
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Database

```sql
-- Good - Commented, typed, constrained
-- User profile extensions for networking
CREATE TABLE user_professional_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  years_experience INTEGER CHECK (years_experience >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user UNIQUE (user_id)
);

-- Index for performance
CREATE INDEX idx_professional_user ON user_professional_identities(user_id);

-- RLS policy
CREATE POLICY professional_identity_select_own 
ON user_professional_identities
FOR SELECT USING (auth.uid() = user_id);
```

## Testing Requirements

### Coverage Requirements

- **Unit Tests:** Minimum 80% coverage
- **Integration Tests:** Required for all API endpoints
- **E2E Tests:** Required for critical user flows

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('when condition', () => {
    it('should behave like this', () => {
      // test
    });
    
    it('should handle edge case', () => {
      // test
    });
  });
});
```

## Pull Request Process

### Before Submitting

- [ ] Branch is up-to-date with main
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Lint checks pass
- [ ] Documentation updated
- [ ] Self-reviewed

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots
<!-- If applicable -->

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console warnings
```

### Review Process

1. Automated checks run (tests, lint, build)
2. Code review by maintainer
3. Approval required from 1+ maintainer
4. Squash and merge to main

## Documentation

### When to Update Docs

- New features
- Changed behavior
- API changes
- New environment variables

### Doc Files

- `docs/api/` - API documentation
- `docs/guides/` - User guides
- `docs/dev/` - Developer docs
- `README.md` - Project overview

## Performance Guidelines

### Database

- Add indexes for query patterns
- Use connection pooling
- Implement pagination
- Avoid N+1 queries

### Mobile

- Use React.memo for expensive components
- Optimize images
- Lazy load screens
- Minimize re-renders

### Edge Functions

- Keep under 20MB bundle size
- Use streaming for large responses
- Implement caching where appropriate
- Return quickly (under 5s)

## Security

### Required Practices

- Validate all inputs
- Use parameterized queries
- Never commit secrets
- Enable RLS policies
- Sanitize user content

### Reporting Security Issues

Email: security@spotter.golf

Do NOT open public issues for security vulnerabilities.

## Release Process

### Version Numbers

Follow [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Creating a Release

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create Git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. CI/CD creates release automatically

## Questions?

- Development: dev@spotter.golf
- General: hello@spotter.golf

## Code of Conduct

- Be respectful
- Welcome newcomers
- Focus on constructive feedback
- Respect differing viewpoints

## License

By contributing, you agree that your contributions will be licensed under the project license.
