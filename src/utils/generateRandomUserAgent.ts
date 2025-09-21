import UserAgent from 'user-agents';

export const generateRandomUserAgent = () => {
  return new UserAgent({ deviceCategory: 'desktop' }).toString();
};
