import { useState } from 'react';
import { CoachCatalogItem } from '../../hooks/useCoachCatalog';
import { BookingMode } from '../../hooks/useBookingFlow';
import { CoachBrowseScreen } from './coaching/CoachBrowseScreen';
import { CoachProfileScreen } from './coaching/CoachProfileScreen';
import { AvailabilityCalendarSheet } from './coaching/AvailabilityCalendarSheet';
import { BookSessionScreen } from './coaching/BookSessionScreen';

type Stage = 'browse' | 'profile' | 'book';

export function CoachingTabScreen() {
  const [stage, setStage] = useState<Stage>('browse');
  const [search, setSearch] = useState('');
  const [selectedCoach, setSelectedCoach] = useState<CoachCatalogItem | null>(null);
  const [mode, setMode] = useState<BookingMode>('video_call');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  if (stage === 'browse') {
    return (
      <CoachBrowseScreen
        search={search}
        onSearchChange={setSearch}
        onSelectCoach={(coach) => {
          setSelectedCoach(coach);
          setStage('profile');
        }}
      />
    );
  }

  if (stage === 'profile' && selectedCoach) {
    return (
      <>
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
      <BookSessionScreen
        coachId={selectedCoach.coachId}
        selectedSlot={selectedSlot}
        initialMode={mode}
        onBack={() => setStage('profile')}
        onDone={() => setStage('browse')}
      />
    );
  }

  return (
    <CoachBrowseScreen
      search={search}
      onSearchChange={setSearch}
      onSelectCoach={(coach) => {
        setSelectedCoach(coach);
        setStage('profile');
      }}
    />
  );
}
