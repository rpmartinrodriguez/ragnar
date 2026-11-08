/* Ragnar Firebase Cloud Messaging — versión web de prueba.
   Solo maneja avisos en segundo plano, sin cachear datos sensibles. */
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAVxRCZ3gG1QGehoLZ9I1yd-qnhm4MKK3M',
  authDomain: 'ragnar-5f8d7.firebaseapp.com',
  projectId: 'ragnar-5f8d7',
  storageBucket: 'ragnar-5f8d7.firebasestorage.app',
  messagingSenderId: '986593179800',
  appId: '1:986593179800:web:0301184bed7a5a642778ed'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  const title = String(data.title || 'Ragnar Training').slice(0, 100);
  const body = String(data.body || 'Tenés una nueva notificación.').slice(0, 180);
  self.registration.showNotification(title, {
    body,
    icon:'/logo.png',
    badge:'/logo.png',
    tag:'ragnar-'+String(data.type||'alert')+'-'+String(data.alertId||data.clientId||''),
    data:{url:data.target==='student-alerts'?'/?view=student-alerts':'/?view=notifications'}
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = event.notification?.data?.url === '/?view=student-alerts'
    ? '/?view=student-alerts' : '/?view=notifications';
  const target = new URL(destination,self.location.origin).href;
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const same=clients.find(c=>new URL(c.url).origin===self.location.origin);
    if(same){
      await same.focus();
      await same.navigate(target);
    }else{
      await self.clients.openWindow(target);
    }
  })());
});
