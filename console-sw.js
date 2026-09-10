/* connec+a admin console Service Worker — PUSH ONLY (no caching).
 * 配置: admin console (console.html) と同じディレクトリ (aiadmin サイト直下) に置く。
 * 登録: navigator.serviceWorker.register('./console-sw.js')  ← 相対指定。
 *
 * 参加者アプリの sw.js とは別物。コンソールは毎回最新HTMLで開く必要があり、巨大な単一HTML
 * (~2.5MB) をキャッシュすると版ズレ事故になるため、ここでは HTML/静的アセットを一切キャッシュしない。
 * 会議アラーム / 議題リマインドをバックグラウンドで受け取るための Web Push ハンドラのみを持つ。
 */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// --- Web Push --- 送信側 (dispatchPush_ → Cloudflare Worker) が JSON を送る: { title, body, url, tag }
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (err) { try { data = { title: 'connec+a', body: event.data ? event.data.text() : '' }; } catch (e2) { data = {}; } }
  var title = data.title || 'connec+a';
  var options = {
    body: data.body || '',
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    data: { url: data.url || './' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var raw = (event.notification.data && event.notification.data.url) || './';
  var scope = self.registration.scope;   // コンソールのディレクトリ基準 (sw.js 自身ではなく)
  var absolute;
  try {
    if (/^https?:\/\//i.test(raw)) absolute = raw;
    else if (raw.charAt(0) === '#') absolute = scope + raw;         // scope 直下の index + hash (#meeting-mode 等)
    else absolute = new URL(raw, scope).href;
  } catch (e) { absolute = scope; }
  var hash = absolute.indexOf('#') >= 0 ? absolute.slice(absolute.indexOf('#')) : '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && c.url.indexOf('/console-sw.js') >= 0) continue;   // SW を指すタブは無視
        if ('focus' in c) {
          try {
            var cu = new URL(c.url);
            var navTo = hash ? (cu.origin + cu.pathname + cu.search + hash) : absolute;
            if (c.navigate) c.navigate(navTo).catch(function () {});
          } catch (e) {}
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolute);
    })
  );
});
