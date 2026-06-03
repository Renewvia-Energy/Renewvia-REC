// Minimal service worker — self-unregisters to clean up any stale registration.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.registration.unregister())
