import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GuestEventBrowserScreen } from './GuestEventBrowserScreen';
import { GuestRegistrationScreen } from './GuestRegistrationScreen';
import { GuestCheckoutScreen } from './GuestCheckoutScreen';
import { GuestTicketScreen } from './GuestTicketScreen';
import { GuestVerificationScreen } from './GuestVerificationScreen';

type GuestFlowStep =
  | 'browser'
  | 'registration'
  | 'checkout'
  | 'verification'
  | 'ticket';

type GuestFlowState = {
  step: GuestFlowStep;
  selectedEventId?: string;
  eventPrice: number;
  guestSessionId?: string;
  guestEmail?: string;
  orderId?: string;
  verificationToken?: string;
};

type Props = {
  onSignIn: () => void;
  onComplete: () => void;
  initialVerificationToken?: string;
};

export function GuestFlow({ onSignIn, onComplete, initialVerificationToken }: Props) {
  const [state, setState] = useState<GuestFlowState>({
    step: initialVerificationToken ? 'verification' : 'browser',
    eventPrice: 0,
    verificationToken: initialVerificationToken,
  });

  const navigateTo = useCallback((step: GuestFlowStep, updates?: Partial<GuestFlowState>) => {
    setState((prev) => ({ ...prev, step, ...updates }));
  }, []);

  // Event browser handlers
  const handleEventPress = useCallback((eventId: string, price: number) => {
    navigateTo('registration', { selectedEventId: eventId, eventPrice: price });
  }, [navigateTo]);

  // Registration handlers
  const handleRegistrationComplete = useCallback(
    (guestSessionId: string, email: string) => {
      // If event is free, go directly to ticket
      // If paid, go to checkout
      if (state.eventPrice === 0) {
        // TODO: Backend should support free event registration via guest-start-checkout
        // For now, free events use a placeholder order ID - this is NOT production-ready
        // The backend should return a proper order ID for free registrations
        const orderId = `guest-free-${Date.now()}`;
        navigateTo('ticket', { guestSessionId, guestEmail: email, orderId });
      } else {
        navigateTo('checkout', { guestSessionId, guestEmail: email });
      }
    },
    [navigateTo, state.eventPrice]
  );

  const handleRegistrationCancel = useCallback(() => {
    navigateTo('browser');
  }, [navigateTo]);

  // Checkout handlers
  const handleCheckoutComplete = useCallback(
    (orderId: string) => {
      navigateTo('ticket', { orderId });
    },
    [navigateTo]
  );

  const handleCheckoutCancel = useCallback(() => {
    navigateTo('registration');
  }, [navigateTo]);

  // Ticket handlers
  const handleTicketBack = useCallback(() => {
    navigateTo('browser');
  }, [navigateTo]);

  const handleTicketSignUp = useCallback(() => {
    onSignIn();
  }, [onSignIn]);

  // Verification handlers
  const handleVerificationComplete = useCallback(
    (email: string) => {
      if (state.orderId) {
        navigateTo('ticket', { guestEmail: email });
      } else {
        navigateTo('browser');
      }
    },
    [navigateTo, state.orderId]
  );

  const handleVerificationBack = useCallback(() => {
    navigateTo('browser');
  }, [navigateTo]);

  // Render current step
  switch (state.step) {
    case 'browser':
      return (
        <GuestEventBrowserScreen
          onEventPress={handleEventPress}
          onSignInPress={onSignIn}
        />
      );

    case 'registration':
      if (!state.selectedEventId) {
        navigateTo('browser');
        return null;
      }
      return (
        <GuestRegistrationScreen
          eventId={state.selectedEventId}
          eventPrice={state.eventPrice}
          onComplete={handleRegistrationComplete}
          onCancel={handleRegistrationCancel}
        />
      );

    case 'checkout':
      if (!state.selectedEventId || !state.guestSessionId || !state.guestEmail) {
        navigateTo('browser');
        return null;
      }
      return (
        <GuestCheckoutScreen
          guestSessionId={state.guestSessionId}
          email={state.guestEmail}
          eventId={state.selectedEventId}
          eventPrice={state.eventPrice}
          onComplete={handleCheckoutComplete}
          onCancel={handleCheckoutCancel}
        />
      );

    case 'verification':
      return (
        <GuestVerificationScreen
          initialToken={state.verificationToken}
          onVerified={handleVerificationComplete}
          onBack={handleVerificationBack}
        />
      );

    case 'ticket':
      if (!state.orderId) {
        navigateTo('browser');
        return null;
      }
      return (
        <GuestTicketScreen
          orderId={state.orderId}
          guestEmail={state.guestEmail || ''}
          onBack={handleTicketBack}
          onSignUp={handleTicketSignUp}
        />
      );

    default:
      return (
        <GuestEventBrowserScreen
          onEventPress={handleEventPress}
          onSignInPress={onSignIn}
        />
      );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
