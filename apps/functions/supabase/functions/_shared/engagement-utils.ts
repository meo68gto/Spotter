export const mapStripeIntentToOrderStatus = (status: string): 'created' | 'requires_payment_method' | 'processing' | 'paid' => {
  if (status === 'succeeded') return 'paid';
  if (status === 'processing') return 'processing';
  if (status === 'requires_payment_method') return 'requires_payment_method';
  return 'created';
};

export const billableMinutesFromSeconds = (seconds: number) => Math.ceil(Math.max(seconds, 0) / 60);
