import Phaser from 'phaser';
import { getBootPayload, getGameSocket } from '../gameContext';
import { MOVE_EMIT_MS, PLAYER_SPEED, WORLD, ZONES } from '../constants';
import type { PlayerState } from '../types';

type RemoteEntry = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  target: { x: number; y: number; rotation: number };
};

function drawBike(
  scene: Phaser.Scene,
  color: number,
  scale = 1,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.lineStyle(2, 0xffffff, 0.35);
  const w = 28 * scale;
  const h = 14 * scale;
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(w / 2 - 2 * scale, 0, w / 2 + 10 * scale, -6 * scale, w / 2 + 10 * scale, 6 * scale);

  const c = scene.add.container(0, 0, [g]);
  return c;
}

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private bike!: Phaser.GameObjects.Container;
  private nameLabel!: Phaser.GameObjects.Text;
  private nameTag!: Phaser.GameObjects.Container;
  private pickupGfx!: Phaser.GameObjects.Graphics;
  private dropGfx!: Phaser.GameObjects.Graphics;
  private roadGfx!: Phaser.GameObjects.Graphics;

  private remotes = new Map<string, RemoteEntry>();
  private lastEmit = 0;

  private playerX = 0;
  private playerY = 0;
  private playerRot = 0;

  private coins = 0;
  private hasPackage = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const socket = getGameSocket();
    const init = getBootPayload();

    this.coins = init.coins;
    this.hasPackage = init.hasPackage;
    this.playerX = init.players.find((p) => p.id === init.selfId)?.x ?? WORLD.width / 2;
    this.playerY = init.players.find((p) => p.id === init.selfId)?.y ?? WORLD.height / 2;
    this.playerRot = init.players.find((p) => p.id === init.selfId)?.rotation ?? 0;

    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    this.roadGfx = this.add.graphics();
    this.roadGfx.fillStyle(0x14141c, 1);
    this.roadGfx.fillRect(0, 0, WORLD.width, WORLD.height);
    this.roadGfx.lineStyle(10, 0x252532, 1);
    const lane = 90;
    for (let x = lane; x < WORLD.width; x += lane * 2) {
      this.roadGfx.lineBetween(x, 0, x, WORLD.height);
    }
    this.roadGfx.lineStyle(16, 0x1f1f2a, 1);
    this.roadGfx.strokeRect(8, 8, WORLD.width - 16, WORLD.height - 16);

    this.pickupGfx = this.add.graphics();
    this.pickupGfx.lineStyle(3, 0x4ade80, 0.85);
    this.pickupGfx.fillStyle(0x22c55e, 0.22);
    this.pickupGfx.fillCircle(ZONES.pickup.x, ZONES.pickup.y, ZONES.pickup.r);
    this.pickupGfx.strokeCircle(ZONES.pickup.x, ZONES.pickup.y, ZONES.pickup.r);

    this.dropGfx = this.add.graphics();
    this.dropGfx.lineStyle(3, 0x60a5fa, 0.9);
    this.dropGfx.fillStyle(0x3b82f6, 0.2);
    this.dropGfx.fillCircle(ZONES.drop.x, ZONES.drop.y, ZONES.drop.r);
    this.dropGfx.strokeCircle(ZONES.drop.x, ZONES.drop.y, ZONES.drop.r);

    const self = init.players.find((p) => p.id === init.selfId)!;
    const bodyColor = Phaser.Display.Color.HexStringToColor(self.color).color;

    this.bike = drawBike(this, bodyColor, 1.15);
    this.bike.setPosition(this.playerX, this.playerY);
    this.bike.setRotation(this.playerRot);

    this.nameLabel = this.add
      .text(0, -36, self.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: '#e4e4e7',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);

    this.nameTag = this.add.container(this.playerX, this.playerY, [this.nameLabel]);
    this.nameTag.setDepth(10);

    this.add.existing(this.bike);
    this.bike.setDepth(5);

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.bike, true, 0.12, 0.12);

    for (const p of init.players) {
      if (p.id === init.selfId) continue;
      this.addRemote(p);
    }

    if (!this.input.keyboard) {
      throw new Error('Keyboard plugin missing');
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    socket.on('playerJoined', (p: PlayerState) => {
      if (p.id === init.selfId) return;
      if (this.remotes.has(p.id)) return;
      this.addRemote(p);
    });

    socket.on('playerLeft', (id: string) => {
      const entry = this.remotes.get(id);
      if (!entry) return;
      entry.container.destroy();
      entry.label.destroy();
      this.remotes.delete(id);
    });

    socket.on('playerMoved', (data: { id: string; x: number; y: number; rotation: number }) => {
      if (data.id === init.selfId) return;
      const entry = this.remotes.get(data.id);
      if (!entry) return;
      entry.target.x = data.x;
      entry.target.y = data.y;
      entry.target.rotation = data.rotation;
    });

    socket.on('playerMeta', (data: { id: string; name: string }) => {
      if (data.id === init.selfId) {
        this.nameLabel.setText(data.name);
        return;
      }
      const entry = this.remotes.get(data.id);
      if (entry) entry.label.setText(data.name);
    });

    socket.on('deliveryState', (s: { hasPackage: boolean; coins: number }) => {
      this.hasPackage = s.hasPackage;
      this.coins = s.coins;
      window.dispatchEvent(new CustomEvent('bikedash:hud', { detail: { coins: this.coins, hasPackage: this.hasPackage } }));
    });

    socket.on('deliveryComplete', (s: { coins: number }) => {
      this.coins = s.coins;
      window.dispatchEvent(new CustomEvent('bikedash:hud', { detail: { coins: this.coins, hasPackage: false } }));
      window.dispatchEvent(new CustomEvent('bikedash:toast', { detail: 'Delivered! +10 coins' }));
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy) || 1;
      vx /= len;
      vy /= len;
      this.playerX += vx * PLAYER_SPEED * dt;
      this.playerY += vy * PLAYER_SPEED * dt;
      this.playerRot = Math.atan2(vy, vx);
    }

    this.playerX = Phaser.Math.Clamp(this.playerX, 20, WORLD.width - 20);
    this.playerY = Phaser.Math.Clamp(this.playerY, 20, WORLD.height - 20);

    this.bike.setPosition(this.playerX, this.playerY);
    this.bike.setRotation(this.playerRot);
    this.nameTag.setPosition(this.playerX, this.playerY);

    const socket = getGameSocket();
    const now = performance.now();
    if (now - this.lastEmit >= MOVE_EMIT_MS) {
      this.lastEmit = now;
      socket.emit('move', { x: this.playerX, y: this.playerY, rotation: this.playerRot });
    }

    const lerp = 1 - Math.pow(0.001, dt);
    for (const [, remote] of this.remotes) {
      const c = remote.container;
      c.x = Phaser.Math.Linear(c.x, remote.target.x, lerp);
      c.y = Phaser.Math.Linear(c.y, remote.target.y, lerp);
      let dr = remote.target.rotation - c.rotation;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      c.setRotation(c.rotation + dr * lerp);
      remote.label.setPosition(c.x, c.y - 36);
    }
  }

  private addRemote(p: PlayerState): void {
    const color = Phaser.Display.Color.HexStringToColor(p.color).color;
    const container = drawBike(this, color, 1);
    container.setPosition(p.x, p.y);
    container.setRotation(p.rotation);

    const label = this.add
      .text(p.x, p.y - 36, p.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: '#e4e4e7',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.remotes.set(p.id, {
      container,
      label,
      target: { x: p.x, y: p.y, rotation: p.rotation },
    });
  }
}
