const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const highlightSearchKeyword = (value: string, keyword: string) => {
  const normalizedKeyword = keyword.trim()

  if (!normalizedKeyword) {
    return escapeHtml(value)
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedKeyword)})`, 'gi')
  return escapeHtml(value).replace(pattern, '<mark>$1</mark>')
}
