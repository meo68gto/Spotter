import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';
import { palette, radius, shadows, spacing } from '../theme/design';

type QuestionCategory = 'swing' | 'strategy' | 'equipment' | 'rules' | 'mental' | 'fitness';
type UrgencyLevel = 'low' | 'medium' | 'high';

type Expert = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  specialty: string;
  rating: number;
};

type MyQuestion = {
  id: string;
  question: string;
  category: QuestionCategory;
  urgency: UrgencyLevel;
  status: 'pending' | 'answered' | 'closed';
  createdAt: string;
  answer?: string;
  expertName?: string;
};

type QAFeedItem = {
  id: string;
  question: string;
  answer: string;
  category: QuestionCategory;
  expertName: string;
  expertAvatar?: string;
  likes: number;
};

interface AskScreenProps {
  session: Session;
}

const CATEGORIES: { value: QuestionCategory; label: string; emoji: string }[] = [
  { value: 'swing', label: 'Swing', emoji: '🏌️' },
  { value: 'strategy', label: 'Strategy', emoji: '🎯' },
  { value: 'equipment', label: 'Equipment', emoji: '🏌️‍♂️' },
  { value: 'rules', label: 'Rules', emoji: '📋' },
  { value: 'mental', label: 'Mental Game', emoji: '🧠' },
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
];

const URGENCY_LEVELS: { value: UrgencyLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
];

export function AskScreen({ session }: AskScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ask' | 'feed' | 'history'>('ask');
  
  // Ask form state
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<QuestionCategory>('swing');
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium');
  const [submitting, setSubmitting] = useState(false);
  
  // Data state
  const [experts, setExperts] = useState<Expert[]>([]);
  const [myQuestions, setMyQuestions] = useState<MyQuestion[]>([]);
  const [qaFeed, setQaFeed] = useState<QAFeedItem[]>([]);

  const loadExperts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('id, specialty, rating, profiles!inner(display_name, avatar_url)')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedExperts: Expert[] = (data || []).map((e: any) => ({
        id: e.id,
        displayName: e.profiles?.display_name || 'Expert',
        avatarUrl: e.profiles?.avatar_url,
        specialty: e.specialty,
        rating: e.rating || 0,
      }));

      setExperts(formattedExperts);
    } catch (error) {
      console.error('Error loading experts:', error);
    }
  }, []);

  const loadMyQuestions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expert_questions')
        .select('*, expert:experts!inner(profiles!inner(display_name))')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedQuestions: MyQuestion[] = (data || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        category: q.category,
        urgency: q.urgency,
        status: q.status,
        createdAt: q.created_at,
        answer: q.answer,
        expertName: q.expert?.profiles?.display_name,
      }));

      setMyQuestions(formattedQuestions);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  }, [session.user.id]);

  const loadQAFeed = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expert_questions')
        .select('*, expert:experts!inner(profiles!inner(display_name, avatar_url))')
        .eq('status', 'answered')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedFeed: QAFeedItem[] = (data || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        category: q.category,
        expertName: q.expert?.profiles?.display_name || 'Expert',
        expertAvatar: q.expert?.profiles?.avatar_url,
        likes: q.likes || 0,
      }));

      setQaFeed(formattedFeed);
    } catch (error) {
      console.error('Error loading Q&A feed:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadExperts(), loadMyQuestions(), loadQAFeed()]);
  }, [loadExperts, loadMyQuestions, loadQAFeed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSubmitQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('expert_questions').insert({
        user_id: session.user.id,
        question: question.trim(),
        category,
        urgency,
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Success', 'Your question has been submitted to our experts!');
      setQuestion('');
      loadMyQuestions();
      setActiveTab('history');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.stars}>
        {[...Array(5)].map((_, i) => (
          <Text key={i} style={styles.star}>
            {i < Math.floor(rating) ? '★' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderAskForm = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Ask an Expert</Text>
      <Text style={styles.subtitle}>Get answers from certified golf professionals</Text>

      <Card>
        <Text style={styles.label}>Your Question</Text>
        <TextInput
          style={styles.textarea}
          placeholder="What would you like to know about your game?"
          value={question}
          onChangeText={setQuestion}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryChip,
                category === cat.value && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(cat.value)}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.categoryText,
                  category === cat.value && styles.categoryTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Urgency</Text>
        <View style={styles.urgencyRow}>
          {URGENCY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.urgencyChip,
                urgency === level.value && { borderColor: level.color, backgroundColor: level.color + '20' },
              ]}
              onPress={() => setUrgency(level.value)}
            >
              <View
                style={[
                  styles.urgencyDot,
                  { backgroundColor: level.color },
                ]}
              />
              <Text
                style={[
                  styles.urgencyText,
                  urgency === level.value && { color: level.color, fontWeight: '700' },
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title={submitting ? 'Submitting...' : 'Submit Question'}
          onPress={handleSubmitQuestion}
          disabled={submitting || !question.trim()}
        />
      </Card>

      {/* Expert Discovery */}
      <Text style={styles.sectionTitle}>Our Experts</Text>
      {experts.length > 0 ? (
        experts.map((expert) => (
          <Card key={expert.id}>
            <View style={styles.expertRow}>
              {expert.avatarUrl ? (
                <Image source={{ uri: expert.avatarUrl }} style={styles.expertAvatar} />
              ) : (
                <View style={styles.expertAvatarPlaceholder}>
                  <Text style={styles.expertInitial}>
                    {expert.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.expertInfo}>
                <Text style={styles.expertName}>{expert.displayName}</Text>
                <Text style={styles.expertSpecialty}>{expert.specialty}</Text>
                {renderStars(expert.rating)}
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No experts available right now</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderQAFeed = () => (
    <FlatList
      data={qaFeed}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Recent Q&A</Text>
          <Text style={styles.subtitle}>Learn from questions answered by our experts</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.qaCard}>
            <View style={styles.qaHeader}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {CATEGORIES.find((c) => c.value === item.category)?.emoji} {CATEGORIES.find((c) => c.value === item.category)?.label}
                </Text>
              </View>
            </View>

            <Text style={styles.questionText}>Q: {item.question}</Text>
            <Text style={styles.answerText}>A: {item.answer}</Text>

            <View style={styles.qaFooter}>
              <View style={styles.expertRow}>
                {item.expertAvatar ? (
                  <Image source={{ uri: item.expertAvatar }} style={styles.smallAvatar} />
                ) : (
                  <View style={styles.smallAvatarPlaceholder}>
                    <Text style={styles.smallInitial}>{item.expertName.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.expertNameSmall}>{item.expertName}</Text>
              </View>
              <Text style={styles.likes}>❤️ {item.likes}</Text>
            </View>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No Q&A yet</Text>
            <Text style={styles.emptyText}>Be the first to ask a question!</Text>
          </View>
        </Card>
      }
    />
  );

  const renderHistory = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>My Questions</Text>
      <Text style={styles.subtitle}>Track your questions and answers</Text>

      {myQuestions.length > 0 ? (
        myQuestions.map((q) => (
          <Card key={q.id}>
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {CATEGORIES.find((c) => c.value === q.category)?.emoji}{' '}
                    {CATEGORIES.find((c) => c.value === q.category)?.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        q.status === 'answered'
                          ? '#D1FAE5'
                          : q.status === 'pending'
                          ? '#DBEAFE'
                          : '#F3F4F6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          q.status === 'answered'
                            ? '#065F46'
                            : q.status === 'pending'
                            ? '#1E40AF'
                            : '#6B7280',
                      },
                    ]}
                  >
                    {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.historyQuestion}>{q.question}</Text>

              {q.answer && (
                <View style={styles.answerBox}>
                  <Text style={styles.answerLabel}>Answer from {q.expertName}:</Text>
                  <Text style={styles.answerContent}>{q.answer}</Text>
                </View>
              )}

              <Text style={styles.historyDate}>
                Asked {new Date(q.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🤔</Text>
            <Text style={styles.emptyTitle}>No questions yet</Text>
            <Text style={styles.emptyText}>Ask your first question to get started</Text>
            <Button title="Ask a Question" onPress={() => setActiveTab('ask')} />
          </View>
        </Card>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'ask', label: 'Ask', icon: '❓' },
          { key: 'feed', label: 'Feed', icon: '📰' },
          { key: 'history', label: 'History', icon: '📜' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'ask' && renderAskForm()}
      {activeTab === 'feed' && renderQAFeed()}
      {activeTab === 'history' && renderHistory()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: palette.navy600,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink500,
  },
  activeTabText: {
    color: palette.navy600,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink700,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textarea: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.sky200,
    minHeight: 100,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  categoryChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  categoryTextActive: {
    color: palette.white,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  urgencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  expertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  expertAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  expertAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expertInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '800',
  },
  expertInfo: {
    flex: 1,
  },
  expertName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  expertSpecialty: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: 2,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  star: {
    fontSize: 14,
    color: '#F59E0B',
  },
  qaCard: {
    gap: spacing.md,
  },
  qaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink700,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
  },
  answerText: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20,
  },
  qaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  smallAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallInitial: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  expertNameSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
  },
  likes: {
    fontSize: 13,
    color: palette.ink500,
  },
  historyCard: {
    gap: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
    marginTop: spacing.sm,
  },
  answerBox: {
    backgroundColor: palette.sky100,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink700,
    marginBottom: spacing.xs,
  },
  answerContent: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20,
  },
  historyDate: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
