// Utility functions for development environment

const getFileHash = (fileId: string): number => {
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    const char = fileId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash);
};

// Export hash function in case needed elsewhere
export { getFileHash };
