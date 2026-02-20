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
