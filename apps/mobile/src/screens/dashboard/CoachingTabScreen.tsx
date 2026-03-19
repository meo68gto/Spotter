import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CoachCatalogItem } from '../../hooks/useCoachCatalog';
import { BookingMode } from '../../hooks/useBookingFlow';
import { ActiveSessionScreen } from './coaching/ActiveSessionScreen';
import { SessionChatScreen } from './coaching/SessionChatScreen';
import { VideoCallScreen } from './coaching/VideoCallScreen';
import { ReviewCoachSheet } from './coaching/ReviewCoachSheet';
import { CoachBrowseScreen } from './coaching/CoachBrowseScreen';
import { CoachProfileScreen } from './coaching/CoachProfileScreen';
import { AvailabilityCalendarSheet } from './coaching/AvailabilityCalendarSheet';
import { BookSessionScreen } from './coaching/BookSessionScreen';

type PrimaryPane = 'browse' | 'active';
type Stage = 'browse' | 'profile' | 'book' | 'active' | 'sessionChat' | 'videoCall';

export function CoachingTabScreen({ session }: { session: Session }) {
  const [primary, setPrimary] = useState<PrimaryPane>('browse');
  const [stage, setStage] = useState<Stage>('browse');
  const [search, setSearch] = useState('');
  const [selectedCoach, setSelectedCoach] = useState<CoachCatalogItem | null>(null);
  const [mode, setMode] = useState<BookingMode>('video_call');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeEngagementId, setActiveEngagementId] = useState<string>('');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

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
          mode={mode}
          setMode={setMode}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await new Promise((resolve) => setTimeout(resolve, 350));
            setRefreshing(false);
          }}
          onBack={() => setStage('browse')}
          onBook={() => setAvailabilityOpen(true)}
        />
        <AvailabilityCalendarSheet
          visible={availabilityOpen}
          selected={selectedSlot}
          onSelect={setSelectedSlot}
          onClose={() => setAvailabilityOpen(false)}
          onContinue={() => {
            setAvailabilityOpen(false);
            setStage('book');
          }}
        />
      </>
    );
  }

  if (stage === 'book' && selectedCoach && selectedSlot) {
    return (
      <>
        <TopSwitch primary={primary} onBrowse={showBrowse} onActive={showActive} />
        <BookSessionScreen
          coachId={selectedCoach.coachId}
          selectedSlot={selectedSlot}
          initialMode={mode}
          onBack={() => setStage('profile')}
          onDone={() => setStage('browse')}
        />
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
