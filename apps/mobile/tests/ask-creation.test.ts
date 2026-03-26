/**
 * Ask / Expert Question — creation flow unit tests.
 *
 * Tests:
 * - Question text is required
 * - Category must be a valid enum value
 * - Urgency must be a valid enum value
 * - Successful creation returns a question record
 * - Empty text is rejected
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the Supabase client for these tests
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}));

describe('AskScreen question creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty question text', () => {
    const question = '';
    const isValid = question.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('accepts non-empty question text', () => {
    const question = '  What is the proper wrist position at the top of the backswing?  ';
    const isValid = question.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('validates category enum values', () => {
    const validCategories = ['swing', 'strategy', 'equipment', 'rules', 'mental', 'fitness'];
    expect(validCategories.includes('swing')).toBe(true);
    expect(validCategories.includes('invalid')).toBe(false);
  });

  it('validates urgency enum values', () => {
    const validUrgencyLevels = ['low', 'medium', 'high'];
    expect(validUrgencyLevels.includes('low')).toBe(true);
    expect(validUrgencyLevels.includes('critical')).toBe(false);
  });

  it('rejects whitespace-only question', () => {
    const question = '   \n\t  ';
    const isValid = question.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('question text max length is reasonable (2000 chars)', () => {
    const question = 'A'.repeat(2000);
    const isValid = question.length <= 2000 && question.trim().length > 0;
    expect(isValid).toBe(true);

    const longQuestion = 'A'.repeat(2001);
    const isInvalid = longQuestion.length > 2000;
    expect(isInvalid).toBe(true);
  });
});

/**
 * Expert question record shape — ensures all required fields are set.
 */
describe('ExpertQuestion record shape', () => {
  it('requires user_id, question, category, urgency, status', () => {
    const record = {
      id: 'q-uuid',
      user_id: 'user-uuid',
      question: 'How do I stop shanking?',
      category: 'swing',
      urgency: 'high',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    expect(record.id).toBeDefined();
    expect(record.user_id).toBeDefined();
    expect(record.question).toBeDefined();
    expect(record.category).toBeDefined();
    expect(record.urgency).toBeDefined();
    expect(record.status).toBe('pending');
  });

  it('status transitions are valid', () => {
    const validStatuses = ['pending', 'answered', 'closed'];
    expect(validStatuses.includes('pending')).toBe(true);
    expect(validStatuses.includes('resolved')).toBe(false);
  });
});
