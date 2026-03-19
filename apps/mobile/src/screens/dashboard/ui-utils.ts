export const shortId = (value: string) => value.slice(0, 8);

export const formatMode = (mode: string) => {
  if (mode === 'text_answer') return 'Text Answer';
  if (mode === 'video_answer') return 'Video Answer';
  if (mode === 'video_call') return 'Video Call';
  return mode;
};

export const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

// User-friendly request status labels for beta launch
export const formatRequestStatus = (status: string): string => {
  const labels: Record<string, string> = {
    created: 'Just created',
    awaiting_expert: 'Looking for coach',
    accepted: 'Coach matched',
    declined: 'No coach available',
    completed: 'Done',
    cancelled: 'Cancelled',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return labels[status] ?? formatStatus(status);
};

// User-friendly session status labels for beta launch
export const formatSessionStatus = (status: string): string => {
  const labels: Record<string, string> = {
    proposed: 'Time proposed',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    pending: 'Pending'
  };
  return labels[status] ?? formatStatus(status);
};
