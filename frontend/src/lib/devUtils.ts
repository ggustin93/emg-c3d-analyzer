const MOCK_THERAPISTS = ['Dr. Aris', 'Dr. Tsam', 'Dr. Pablo'];

const getFileHash = (fileId: string): number => {
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    const char = fileId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash);
};

export const getMockTherapistName = (fileId: string): string => {
  if (!fileId) {
    return 'Unknown Therapist';
  }
  const hash = getFileHash(fileId);
  const index = hash % MOCK_THERAPISTS.length;
  return MOCK_THERAPISTS[index];
};
