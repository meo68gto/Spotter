import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CoachCatalogItem, CoachService } from '../../hooks/useCoachCatalog';
import { invokeFunction } from '../../lib/api';
import { ActiveSessionScreen } from './coaching/ActiveSessionScreen';
import { SessionChatScreen } from './coaching/SessionChatScreen';
import { VideoCallScreen } from './coaching/VideoCallScreen';
import { ReviewCoachSheet } from './coaching/ReviewCoachSheet';
import { CoachBrowseScreen } from './coaching/CoachBrowseScreen';
import { CoachProfileScreen } from './coaching/CoachProfileScreen';
import { CoachServiceScreen } from './coaching/CoachServiceScreen';
import { CoachRequestComposerScreen, CoachRequestDraftInput } from './coaching/CoachRequestComposerScreen';
import { CoachVideoAttachScreen } from './coaching/CoachVideoAttachScreen';
import { CoachCheckoutScreen } from './coaching/CoachCheckoutScreen';
import { CoachRequestTimelineScreen } from './coaching/CoachRequestTimelineScreen';
import { CoachFeedbackScreen } from './coaching/CoachFeedbackScreen';

type PrimaryPane = 'browse' | 'active';
type Stage =
  | 'browse'
  | 'profile'
  | 'service'
  | 'compose'
  | 'attach'
  | 'checkout'
  | 'timeline'
  | 'feedback'
  | 'active'
  | 'sessionChat'
  | 'videoCall';

export function CoachingTabScreen({ session }: { session: Session }) {
  const [primary, setPrimary] = useState<PrimaryPane>('browse');
  const [stage, setStage] = useState<Stage>('browse');
  const [search, setSearch] = useState('');
  const [selectedCoach, setSelectedCoach] = useState<CoachCatalogItem | null>(null);
  const [selectedService, setSelectedService] = useState<CoachService | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeEngagementId, setActiveEngagementId] = useState<string>('');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [draftInput, setDraftInput] = useState<CoachRequestDraftInput | null>(null);
  const [timelineRequestId, setTimelineRequestId] = useState<string>('');
  const [checkoutDraft, setCheckoutDraft] = useState<{ request: { id: string }; order: { id: string }; clientSecret: string | null } | null>(null);

  const showActive = () => {
    setPrimary('active');
    setStage('active');
  };

  const showBrowse = () => {
    setPrimary('browse');
    setStage('browse');
  };

  if (stage === 'sessionChat' && activeSessionId) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <SessionChatScreen session={session} sessionId={activeSessionId} onBack={() => setStage('active')} />
      </>
    );
  }

  if (stage === 'videoCall') {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <VideoCallScreen session={session} defaultEngagementRequestId={activeEngagementId} onBack={() => setStage('active')} />
      </>
    );
  }

  if (stage === 'active') {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <ActiveSessionScreen
          session={session}
          onOpenSessionChat={(sessionId) => {
            setActiveSessionId(sessionId);
            setStage('sessionChat');
          }}
          onOpenVideoCall={(engagementRequestId) => {
            setActiveEngagementId(engagementRequestId);
            setStage('videoCall');
          }}
          onOpenReview={(sessionId) => setReviewSessionId(sessionId)}
        />
        <ReviewCoachSheet visible={Boolean(reviewSessionId)} sessionId={reviewSessionId} onClose={() => setReviewSessionId(null)} />
      </>
    );
  }

  if (stage === 'profile' && selectedCoach) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachProfileScreen
          coach={selectedCoach}
          selectedServiceId={selectedService?.id ?? null}
          onSelectService={setSelectedService}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await new Promise((resolve) => setTimeout(resolve, 350));
            setRefreshing(false);
          }}
          onBack={() => setStage('browse')}
          onContinue={() => setStage('service')}
        />
      </>
    );
  }

  if (stage === 'service' && selectedCoach && selectedService) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachServiceScreen coach={selectedCoach} service={selectedService} onBack={() => setStage('profile')} onContinue={() => setStage('compose')} />
      </>
    );
  }

  if (stage === 'compose' && selectedService) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachRequestComposerScreen
          service={selectedService}
          initialValue={draftInput ?? undefined}
          onBack={() => setStage('service')}
          onContinue={(value) => {
            setDraftInput(value);
            invokeFunction<{ request: { id: string }; order: { id: string }; clientSecret: string | null }>('coach-request-create-draft', {
              body: {
                coachId: selectedCoach?.coachId,
                coachServiceId: selectedService.id,
                questionText: value.questionText,
                buyerNote: value.buyerNote,
                requestDetails: value.requestDetails,
                sourceSurface: 'profile',
                scheduledTime: selectedSlot || undefined
              }
            })
              .then((draft) => {
                setCheckoutDraft(draft);
                setTimelineRequestId(draft.request.id);
                setStage(selectedService.requiresVideo ? 'attach' : 'checkout');
              })
              .catch((error) => Alert.alert('Unable to start request', error instanceof Error ? error.message : 'Unknown error'));
          }}
        />
      </>
    );
  }

  if (stage === 'attach' && timelineRequestId) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachVideoAttachScreen engagementRequestId={timelineRequestId} onBack={() => setStage('compose')} onContinue={() => setStage('checkout')} />
      </>
    );
  }

  if (stage === 'checkout' && selectedCoach && selectedService && draftInput) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachCheckoutScreen
          coachId={selectedCoach.coachId}
          service={selectedService}
          scheduledTime={selectedSlot || undefined}
          requestInput={draftInput}
          sourceSurface="profile"
          existingDraft={checkoutDraft}
          onBack={() => setStage(selectedService.requiresVideo ? 'attach' : 'compose')}
          onPaid={(engagementRequestId) => {
            setTimelineRequestId(engagementRequestId);
            setStage('timeline');
          }}
        />
      </>
    );
  }

  if (stage === 'timeline' && timelineRequestId) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachRequestTimelineScreen
          engagementRequestId={timelineRequestId}
          onBack={() => setStage('browse')}
          onOpenFeedback={() => setStage('feedback')}
        />
      </>
    );
  }

  if (stage === 'feedback' && timelineRequestId) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <CoachFeedbackScreen engagementRequestId={timelineRequestId} onBack={() => setStage('timeline')} />
      </>
    );
  }

  return (
    <>
      <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
      <CoachBrowseScreen
        search={search}
        onSearchChange={setSearch}
        onSelectCoach={(coach) => {
          setSelectedCoach(coach);
          setSelectedService(coach.services[0] ?? null);
          setDraftInput(null);
          setTimelineRequestId('');
          setSelectedSlot('');
          setStage('profile');
        }}
      />
    </>
  );
}

function TopSwitch({ primary, onBrowse, onActive }: { primary: PrimaryPane; onBrowse: () => void; onActive: () => void }) {
  return (
    <View style={styles.topSwitch}>
      <TouchableOpacity style={[styles.pill, primary === 'browse' ? styles.pillActive : null]} onPress={onBrowse}>
        <Text style={[styles.pillText, primary === 'browse' ? styles.pillTextActive : null]}>Browse</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pill, primary === 'active' ? styles.pillActive : null]} onPress={onActive}>
        <Text style={[styles.pillText, primary === 'active' ? styles.pillTextActive : null]}>Active Sessions</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topSwitch: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#d9e2ec', padding: 10, gap: 8 },
  pill: { borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  pillActive: { borderColor: '#0b3a53', backgroundColor: '#eaf2f8' },
  pillText: { color: '#334e68', fontWeight: '700' },
  pillTextActive: { color: '#0b3a53' }
});
