export const queryKeys = {
  me: ['me'],
  dashboard: (role, uid) => ['dashboard', role, uid],
  featureItems: (featureKey, uid) => ['feature-items', featureKey, uid],
  featureSupport: (featureKey, uid) => ['feature-support', featureKey, uid],
  chats: (uid) => ['chats', uid],
  messages: (chatId) => ['messages', chatId],
};