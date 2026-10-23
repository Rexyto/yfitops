export function resolveMediaUrl(serverUrl, resourceUrl) {
  if (typeof resourceUrl !== 'string' || !resourceUrl.trim()) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(resourceUrl)) return resourceUrl;
  return `${serverUrl.replace(/\/+$/, '')}/${resourceUrl.replace(/^\/+/, '')}`;
}
