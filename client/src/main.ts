import Phaser from 'phaser';
import { io } from 'socket.io-client';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { setGameContext } from './gameContext';
import type { InitPayload } from './types';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';

const coinsLine = document.getElementById('coins-line');
const deliveryLine = document.getElementById('delivery-line');
const playersLine = document.getElementById('players-line');
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;

function setHud(coins: number, hasPackage: boolean): void {
  if (coinsLine) coinsLine.textContent = `Coins: ${coins}`;
  if (deliveryLine) {
    deliveryLine.textContent = hasPackage
      ? 'Delivery: Active (→ drop zone)'
      : 'Delivery: Go to pickup (green)';
  }
}

function setPlayersOnline(n: number): void {
  if (playersLine) playersLine.textContent = `Players Online: ${n}`;
}

function appendChat(name: string, message: string): void {
  if (!chatLog) return;
  const row = document.createElement('div');
  row.className = 'msg';
  row.innerHTML = `<span class="who">${escapeHtml(name)}:</span> ${escapeHtml(message)}`;
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(text: string): void {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText =
    'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(34,197,94,0.92);color:#052e16;padding:10px 16px;border-radius:12px;font-weight:600;z-index:50;pointer-events:none;';
  document.body.appendChild(t);
  window.setTimeout(() => t.remove(), 2200);
}

const socket = io(SERVER, { transports: ['websocket', 'polling'] });

socket.on('connect_error', () => {
  if (deliveryLine) deliveryLine.textContent = 'Delivery: (connecting server…)';
});

socket.on('playersOnline', (n: number) => setPlayersOnline(n));

socket.on('chatMessage', (data: { name: string; message: string }) => {
  appendChat(data.name, data.message);
});

window.addEventListener(
  'bikedash:hud',
  ((e: CustomEvent<{ coins: number; hasPackage: boolean }>) => {
    setHud(e.detail.coins, e.detail.hasPackage);
  }) as EventListener,
);

window.addEventListener(
  'bikedash:toast',
  ((e: CustomEvent<string>) => {
    toast(e.detail);
  }) as EventListener,
);

chatForm?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const msg = chatInput?.value ?? '';
  if (!msg.trim()) return;
  socket.emit('chat', msg);
  if (chatInput) chatInput.value = '';
});

let started = false;

socket.on('init', (payload: InitPayload) => {
  if (started) return;
  started = true;

  setGameContext(socket, payload);
  setHud(payload.coins, payload.hasPackage);

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#111118',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [GameScene],
  });
});

const nameInput = document.getElementById('name-input') as HTMLInputElement | null;
const nameSave = document.getElementById('name-save');
nameSave?.addEventListener('click', () => {
  const n = nameInput?.value.trim().slice(0, 20);
  if (n) socket.emit('setName', n);
});
