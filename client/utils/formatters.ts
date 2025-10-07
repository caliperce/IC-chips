export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Format as date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function getFileIcon(type: string): string {
  switch (type) {
    case 'webpage':
      return '🌍';
    case 'code':
      return '👨‍💻';
    case 'data':
      return '📈';
    case 'document':
      return '📋';
    case 'script':
      return '🔮';
    case 'config':
      return '⚡';
    case 'image':
      return '🎨';
    case 'video':
      return '🎬';
    case 'audio':
      return '🎵';
    case 'archive':
      return '📦';
    case 'pdf':
      return '📕';
    case 'spreadsheet':
      return '📊';
    case 'presentation':
      return '📽️';
    default:
      return '✨';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

