/**
 * Helper function to get user's default avatar based on userId/nickname
 */
export const getUserDefaultAvatar = (userId: string | undefined, nickname: string): string => {
  const identifier = userId || nickname || 'default'
  
  // Simple hash function to convert string to number
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // Get absolute value and map to 1-10 range
  const catNumber = (Math.abs(hash) % 10) + 1
  return `/images/user-profile-icons/cat${catNumber}.svg`
}

/**
 * Helper function to get random avatar (1-10)
 */
export const getRandomAvatar = (excludeAvatar?: string): string => {
  const availableAvatars = Array.from({ length: 10 }, (_, i) => `/images/user-profile-icons/cat${i + 1}.svg`)
  const differentAvatars = excludeAvatar 
    ? availableAvatars.filter(avatar => avatar !== excludeAvatar)
    : availableAvatars
  
  if (differentAvatars.length === 0) {
    return availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
  }
  
  return differentAvatars[Math.floor(Math.random() * differentAvatars.length)]
}

