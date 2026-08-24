import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Play, i as RotateCcw, n as Volume2, o as Pause, t as VolumeX } from "../_libs/lucide-react.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Dazb1yT9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice/80 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg shadow-sm hover:bg-primary/90",
			secondary: "bg-surface/90 text-ink border border-ink/10 hover:bg-surface",
			ghost: "text-surface hover:bg-surface/10",
			ink: "bg-ink text-surface hover:bg-ink/90"
		},
		size: {
			default: "h-11 rounded-lg px-5 text-sm",
			lg: "h-12 rounded-xl px-7 text-base",
			icon: "size-11 rounded-xl",
			sm: "h-9 rounded-md px-3 text-sm"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var FIXED_DT = 1 / 60;
var MAX_CHARGE = .92;
var THROW_COOLDOWN = .32;
var SAVE_KEY = "snowcraft-v1";
function enemyCountForLevel(level) {
	return Math.min(15, 3 + 2 * (level - 1));
}
function aiInterval(level) {
	return Math.max(.42, 1.55 - level * .1);
}
function aiSpread(level) {
	return Math.max(8, 70 - level * 6);
}
function aiMoveSpeed(level) {
	return 46 + Math.min(level, 10) * 7;
}
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
	return a + Math.random() * (b - a);
}
function nextId(state) {
	return state.nextId++;
}
function makeKid(state, team, x, y) {
	return {
		id: nextId(state),
		team,
		x,
		y,
		hp: 2,
		maxHp: 2,
		state: "idle",
		stateT: 0,
		cooldown: rand(0, .4),
		animT: Math.random(),
		flash: 0,
		stun: 0,
		facing: team === "red" ? -1 : 1,
		ai: team === "green" ? {
			phase: "idle",
			t: rand(.2, .9),
			destX: x,
			destY: y,
			charge: 0
		} : null
	};
}
function makeForts() {
	return [{
		x: 390,
		y: 168,
		rx: 92,
		ry: 40
	}, {
		x: 545,
		y: 372,
		rx: 108,
		ry: 46
	}];
}
function createState(level) {
	const state = {
		kids: [],
		balls: [],
		forts: makeForts(),
		particles: [],
		footprints: [],
		flakes: [],
		level,
		freeze: 0,
		introT: 1.25,
		phase: "intro",
		nextId: 1,
		time: 0,
		trauma: 0
	};
	const redYs = [
		128,
		270,
		412
	];
	for (let i = 0; i < 3; i++) state.kids.push(makeKid(state, "red", 790 + i % 2 * 36, redYs[i]));
	const n = enemyCountForLevel(level);
	const rows = Math.ceil(n / (n <= 5 ? 2 : n <= 9 ? 3 : 4));
	for (let i = 0; i < n; i++) {
		const col = Math.floor(i / rows);
		const row = i % rows;
		const x = 70 + col * 78;
		const y = 90 + (row + .5) * 400 / rows + rand(-10, 10);
		state.kids.push(makeKid(state, "green", x, y));
	}
	for (let i = 0; i < 70; i++) state.flakes.push({
		x: Math.random() * 960,
		y: Math.random() * 540,
		vx: rand(-12, 12),
		vy: rand(18, 48),
		life: 1,
		maxLife: 1,
		size: rand(1.2, 3.2),
		kind: "flake"
	});
	return state;
}
function inFort(x, y, forts) {
	for (const f of forts) {
		const dx = (x - f.x) / f.rx;
		const dy = (y - f.y) / f.ry;
		if (dx * dx + dy * dy <= 1) return f;
	}
	return null;
}
function living(kids, team) {
	return kids.filter((k) => !isOut(k) && (team ? k.team === team : true));
}
function isOut(k) {
	return k.state === "buried" || k.hp <= 0;
}
function closestEnemy(kid, kids) {
	const other = kid.team === "red" ? "green" : "red";
	let best = null;
	let bestD = Infinity;
	for (const k of kids) {
		if (k.team !== other || isOut(k)) continue;
		const d = (k.x - kid.x) ** 2 + (k.y - kid.y) ** 2;
		if (d < bestD) {
			bestD = d;
			best = k;
		}
	}
	return best;
}
function throwSnowball(state, kid, charge, dirX, dirY) {
	const power = clamp(charge / MAX_CHARGE, .18, 1);
	let len = Math.hypot(dirX, dirY);
	if (len < .001) {
		dirX = kid.team === "red" ? -1 : 1;
		dirY = 0;
		len = 1;
	}
	const nx = dirX / len;
	const ny = dirY / len;
	const speed = 220 + 380 * power;
	const ball = {
		x: kid.x + nx * 30,
		y: kid.y + ny * 10 - 6,
		vx: nx * speed,
		vy: ny * speed,
		team: kid.team,
		r: 8,
		fromId: kid.id,
		grace: .1,
		spin: Math.random() * Math.PI * 2,
		alive: true
	};
	state.balls.push(ball);
	kid.state = "throw";
	kid.stateT = .38;
	kid.cooldown = THROW_COOLDOWN;
	kid.facing = nx < 0 ? -1 : 1;
	burst(state, kid.x + nx * 22, kid.y, nx * 40, 8, "puff");
	return power;
}
function burst(state, x, y, push, n, kind = "puff") {
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2;
		const s = rand(20, 90);
		state.particles.push({
			x,
			y,
			vx: Math.cos(a) * s + push,
			vy: Math.sin(a) * s - 20,
			life: rand(.25, .55),
			maxLife: .55,
			size: rand(2, 5.5),
			kind
		});
	}
}
function separate(state, dt) {
	const kids = state.kids;
	for (let i = 0; i < kids.length; i++) {
		const a = kids[i];
		if (isOut(a) || a.state === "grabbed") continue;
		for (let j = i + 1; j < kids.length; j++) {
			const b = kids[j];
			if (isOut(b)) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const d = Math.hypot(dx, dy) || .001;
			const min = 48.1;
			if (d >= min) continue;
			const push = (min - d) / min * 90 * dt;
			const nx = dx / d;
			const ny = dy / d;
			if (b.state !== "grabbed") {
				b.x += nx * push;
				b.y += ny * push;
			}
			a.x -= nx * push;
			a.y -= ny * push;
		}
		a.x = clamp(a.x, 34, 926);
		a.y = clamp(a.y, 34, 506);
	}
}
function stepBalls(state, dt, onHit) {
	for (const ball of state.balls) {
		if (!ball.alive) continue;
		ball.x += ball.vx * dt;
		ball.y += ball.vy * dt;
		ball.spin += dt * 10;
		ball.grace = Math.max(0, ball.grace - dt);
		if (ball.x < -20 || ball.x > 980 || ball.y < -20 || ball.y > 560) {
			ball.alive = false;
			continue;
		}
		if (inFort(ball.x, ball.y, state.forts)) {
			ball.alive = false;
			burst(state, ball.x, ball.y, 0, 10, "puff");
			continue;
		}
		for (const kid of state.kids) {
			if (isOut(kid) || kid.team === ball.team) continue;
			if (kid.id === ball.fromId && ball.grace > 0) continue;
			if (inFort(kid.x, kid.y, state.forts)) continue;
			const dx = kid.x - ball.x;
			const dy = kid.y - 6 - ball.y;
			if (dx * dx + dy * dy > (26 + ball.r) ** 2) continue;
			ball.alive = false;
			hitKid(state, kid, ball, onHit);
			break;
		}
	}
	state.balls = state.balls.filter((b) => b.alive);
}
function hitKid(state, kid, ball, onHit) {
	kid.hp -= 1;
	kid.flash = .12;
	kid.stun = .35;
	kid.state = kid.hp <= 0 ? "buried" : "hurt";
	kid.stateT = kid.hp <= 0 ? 0 : .42;
	kid.x += Math.sign(ball.vx) * 10;
	kid.y += ball.vy * .02;
	burst(state, kid.x, kid.y, ball.vx * .05, 14, "puff");
	state.trauma = Math.min(1, state.trauma + (kid.hp <= 0 ? .55 : .32));
	state.freeze = kid.hp <= 0 ? .07 : .045;
	onHit(kid.hp <= 0);
}
function stepKids(state, dt) {
	for (const kid of state.kids) {
		kid.animT += dt;
		kid.flash = Math.max(0, kid.flash - dt);
		kid.stun = Math.max(0, kid.stun - dt);
		kid.cooldown = Math.max(0, kid.cooldown - dt);
		if (kid.state === "buried") continue;
		if (kid.state === "throw" || kid.state === "hurt") {
			kid.stateT -= dt;
			if (kid.stateT <= 0) kid.state = "idle";
		}
		if (kid.state === "grabbed") continue;
		if (Math.hypot(0, 0) === 0 && Math.random() < dt * 2.2) state.footprints.push({
			x: kid.x,
			y: kid.y + 16,
			life: 1.6
		});
	}
}
function stepFx(state, dt) {
	state.trauma = Math.max(0, state.trauma - dt * 1.8);
	for (const p of state.particles) {
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.vy += 40 * dt;
		p.life -= dt;
	}
	state.particles = state.particles.filter((p) => p.life > 0);
	for (const f of state.footprints) f.life -= dt;
	state.footprints = state.footprints.filter((f) => f.life > 0);
	for (const flake of state.flakes) {
		flake.x += flake.vx * dt + Math.sin(state.time * 2 + flake.y) * 8 * dt;
		flake.y += flake.vy * dt;
		if (flake.y > 540) {
			flake.y = -4;
			flake.x = Math.random() * 960;
		}
	}
}
function stepSim(state, dt, onHit) {
	state.time += dt;
	if (state.freeze > 0) {
		state.freeze -= dt;
		stepFx(state, dt * .2);
		return;
	}
	if (state.phase === "intro") {
		state.introT -= dt;
		if (state.introT <= 0) state.phase = "fight";
		stepFx(state, dt);
		return;
	}
	if (state.phase !== "fight") {
		stepFx(state, dt);
		return;
	}
	stepKids(state, dt);
	stepBalls(state, dt, onHit);
	separate(state, dt);
	stepFx(state, dt);
	const reds = living(state.kids, "red").length;
	const greens = living(state.kids, "green").length;
	if (reds === 0) state.phase = "lost";
	else if (greens === 0) state.phase = "won";
}
function aimFromKid(kid, kids, extraX = 0, extraY = 0) {
	const target = closestEnemy(kid, kids);
	let dx = kid.team === "red" ? -160 : 160;
	let dy = 0;
	if (target) {
		dx = target.x - kid.x;
		dy = target.y - kid.y;
	}
	dx += extraX;
	dy += extraY;
	if (kid.team === "red") dx = Math.min(dx, -28);
	else dx = Math.max(dx, 28);
	return {
		dx,
		dy
	};
}
function stepAi(state, dt, onThrow) {
	if (state.phase !== "fight" || state.freeze > 0) return;
	const level = state.level;
	for (const kid of state.kids) {
		if (kid.team !== "green" || isOut(kid) || !kid.ai) continue;
		if (kid.stun > 0 || kid.state === "throw" || kid.state === "hurt") continue;
		const incoming = incomingBall(state, kid);
		if (incoming && kid.ai.phase !== "dodge") {
			kid.ai.phase = "dodge";
			kid.ai.t = .38;
			const px = -(incoming.y - kid.y);
			const py = incoming.x - kid.x;
			const len = Math.hypot(px, py) || 1;
			kid.ai.destX = kid.x + px / len * 70;
			kid.ai.destY = kid.y + py / len * 70;
		}
		kid.ai.t -= dt;
		if (kid.ai.phase === "move" || kid.ai.phase === "dodge") {
			moveToward(kid, kid.ai.destX, kid.ai.destY, aiMoveSpeed(level) * (kid.ai.phase === "dodge" ? 1.45 : 1), dt);
			if (kid.ai.t <= 0 || Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) < 10) {
				kid.ai.phase = kid.ai.phase === "dodge" ? "idle" : "windup";
				kid.ai.t = kid.ai.phase === "windup" ? rand(.28, .7) : rand(.15, aiInterval(level) * .5);
				kid.ai.charge = 0;
			}
			continue;
		}
		if (kid.ai.phase === "windup") {
			kid.ai.charge = Math.min(1, kid.ai.charge + dt);
			if (kid.cooldown > 0) continue;
			if (kid.ai.t <= 0) {
				const spread = aiSpread(level);
				const { dx, dy } = aimFromKid(kid, state.kids, rand(-spread, spread), rand(-spread, spread));
				onThrow(throwSnowball(state, kid, .35 + kid.ai.charge * .7, dx, dy));
				kid.ai.phase = "idle";
				kid.ai.t = aiInterval(level) * rand(.7, 1.2);
				kid.ai.charge = 0;
			}
			continue;
		}
		if (kid.ai.t <= 0) {
			if (Math.random() < .55) {
				kid.ai.phase = "windup";
				kid.ai.t = rand(.25, .65);
				kid.ai.charge = 0;
			} else {
				kid.ai.phase = "move";
				kid.ai.t = rand(.4, 1.1);
				const target = closestEnemy(kid, state.kids);
				const fort = state.forts[Math.random() * state.forts.length | 0];
				if (fort && Math.random() < .28) {
					kid.ai.destX = fort.x + rand(-30, 30);
					kid.ai.destY = fort.y + rand(-16, 16);
				} else if (target && Math.random() < .45) {
					kid.ai.destX = clampAi(target.x * .35 + 80, true);
					kid.ai.destY = target.y + rand(-40, 40);
				} else {
					kid.ai.destX = rand(44, 403.2);
					kid.ai.destY = rand(34, 506);
				}
			}
		}
	}
}
function clampAi(x, left) {
	if (left) return Math.max(34, Math.min(960 * .48, x));
	return x;
}
function moveToward(kid, tx, ty, speed, dt) {
	const dx = tx - kid.x;
	const dy = ty - kid.y;
	const d = Math.hypot(dx, dy) || 1;
	kid.x += dx / d * speed * dt;
	kid.y += dy / d * speed * dt;
	kid.facing = dx < 0 ? -1 : 1;
}
function incomingBall(state, kid) {
	for (const b of state.balls) {
		if (!b.alive || b.team === kid.team) continue;
		const dx = kid.x - b.x;
		const dy = kid.y - b.y;
		const dist = Math.hypot(dx, dy);
		if (dist > 110) continue;
		if ((b.vx * dx + b.vy * dy) / (dist || 1) > 40 && !inFort(kid.x, kid.y, state.forts)) return b;
	}
	return null;
}
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(/* @__PURE__ */ new Error(`Failed to load ${src}`));
		img.src = src;
	});
}
async function loadMany(urls) {
	return Promise.all(urls.map(loadImage));
}
async function loadAssets() {
	const [redIdle, redThrow, redHurt, greenIdle, greenThrow, greenHurt, ball, impact, fort, buriedRed, buriedGreen] = await Promise.all([
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/red/idle-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/red/throw-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/red/hurt-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/green/idle-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/green/throw-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/green/hurt-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/fx/projectile-${i}.png`)),
		loadMany([
			1,
			2,
			3,
			4
		].map((i) => `/sprites/fx/impact-${i}.png`)),
		loadImage("/sprites/fx/fort.png"),
		loadImage("/sprites/fx/buried-red.png"),
		loadImage("/sprites/fx/buried-green.png")
	]);
	return {
		red: {
			idle: redIdle,
			throw: redThrow,
			hurt: redHurt,
			buried: buriedRed
		},
		green: {
			idle: greenIdle,
			throw: greenThrow,
			hurt: greenHurt,
			buried: buriedGreen
		},
		ball,
		impact,
		fort,
		ready: true
	};
}
var GameAudio = class {
	ctx = null;
	master = null;
	sfx = null;
	music = null;
	noise = null;
	musicTimer = 0;
	musicOn = false;
	muted = false;
	unlock() {
		if (!this.ctx) {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			this.ctx = new Ctx({ latencyHint: "interactive" });
			this.master = this.ctx.createGain();
			this.sfx = this.ctx.createGain();
			this.music = this.ctx.createGain();
			this.sfx.gain.value = .7;
			this.music.gain.value = .12;
			this.sfx.connect(this.master);
			this.music.connect(this.master);
			this.master.connect(this.ctx.destination);
			this.noise = this.makeNoise(1.2);
			this.applyMute();
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
	}
	setMuted(v) {
		this.muted = v;
		this.applyMute();
	}
	applyMute() {
		if (!this.master || !this.ctx) return;
		this.master.gain.setTargetAtTime(this.muted ? 0 : .9, this.ctx.currentTime, .03);
	}
	startMusic() {
		this.musicOn = true;
	}
	stopMusic() {
		this.musicOn = false;
	}
	tick(dt) {
		if (!this.musicOn || !this.ctx || this.muted) return;
		this.musicTimer -= dt;
		if (this.musicTimer > 0) return;
		this.musicTimer = 1.6 + Math.random() * 1.4;
		const notes = [
			196,
			246.9,
			293.7,
			329.6,
			392
		];
		const f = notes[Math.random() * notes.length | 0];
		this.tone(f, .7, "triangle", .035, this.music);
	}
	grab() {
		this.tone(620, .06, "sine", .07);
	}
	throw(power) {
		this.whoosh(.12 + power * .1, .18 + power * .12);
		this.tone(180 + power * 80, .1, "sine", .08);
	}
	splat() {
		this.whoosh(.08, .22, 900);
		this.tone(90 + Math.random() * 30, .12, "triangle", .16);
	}
	hit() {
		this.tone(140, .14, "triangle", .2);
		this.whoosh(.05, .12, 600);
	}
	bury() {
		this.tone(80, .28, "sine", .22);
		this.whoosh(.16, .28, 400);
	}
	win() {
		[
			262,
			330,
			392,
			523
		].forEach((f, i) => {
			window.setTimeout(() => this.tone(f, .22, "triangle", .12), i * 110);
		});
	}
	lose() {
		[
			220,
			196,
			164,
			130
		].forEach((f, i) => {
			window.setTimeout(() => this.tone(f, .28, "sine", .12), i * 140);
		});
	}
	level() {
		this.tone(392, .16, "triangle", .1);
		window.setTimeout(() => this.tone(523, .2, "triangle", .1), 90);
	}
	makeNoise(seconds) {
		if (!this.ctx) return null;
		const n = Math.floor(this.ctx.sampleRate * seconds);
		const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
		return buf;
	}
	whoosh(duration, gain, freq = 1400) {
		if (!this.ctx || !this.sfx || !this.noise) return;
		const t = this.ctx.currentTime;
		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		src.playbackRate.value = .85 + Math.random() * .3;
		const bp = this.ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.frequency.value = freq;
		bp.Q.value = .7;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .02);
		g.gain.exponentialRampToValueAtTime(1e-4, t + duration);
		src.connect(bp);
		bp.connect(g);
		g.connect(this.sfx);
		src.start(t);
		src.stop(t + duration + .02);
		src.onended = () => {
			src.disconnect();
			bp.disconnect();
			g.disconnect();
		};
	}
	tone(freq, duration, type, gain, bus) {
		if (!this.ctx || !this.sfx) return;
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .6), t + duration);
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .015);
		g.gain.exponentialRampToValueAtTime(1e-4, t + duration);
		osc.connect(g);
		g.connect(bus ?? this.sfx);
		osc.start(t);
		osc.stop(t + duration + .02);
		osc.onended = () => {
			osc.disconnect();
			g.disconnect();
		};
	}
};
var field = null;
function snowField() {
	if (field) return field;
	const c = document.createElement("canvas");
	c.width = 960;
	c.height = 540;
	const ctx = c.getContext("2d");
	const g = ctx.createLinearGradient(0, 0, 0, 540);
	g.addColorStop(0, "#eaf2f7");
	g.addColorStop(.55, "#dce8f0");
	g.addColorStop(1, "#c9d8e4");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 960, 540);
	for (let i = 0; i < 5200; i++) {
		const x = Math.random() * 960;
		const y = Math.random() * 540;
		const a = .04 + Math.random() * .1;
		ctx.fillStyle = Math.random() > .5 ? `rgba(255,255,255,${a})` : `rgba(150,180,200,${a})`;
		ctx.fillRect(x, y, Math.random() > .8 ? 2 : 1, 1);
	}
	ctx.globalAlpha = .18;
	ctx.fillStyle = "#f7fbfd";
	for (let i = 0; i < 6; i++) {
		ctx.beginPath();
		ctx.ellipse(80 + i * 160, 40 + i % 2 * 18, 140, 18, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	field = c;
	return c;
}
function worldFromClient(canvas, clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	const cssW = rect.width;
	const cssH = rect.height;
	const scale = Math.min(cssW / 960, cssH / 540);
	const ox = (cssW - 960 * scale) / 2;
	const oy = (cssH - 540 * scale) / 2;
	return {
		x: (clientX - rect.left - ox) / scale,
		y: (clientY - rect.top - oy) / scale
	};
}
function frameOf(frames, t, fps = 7) {
	if (!frames.length) return null;
	return frames[Math.floor(t * fps) % frames.length] ?? frames[0];
}
function kidFrame(kid, assets) {
	const set = kid.team === "red" ? assets.red : assets.green;
	if (kid.state === "buried") return set.buried;
	if (kid.state === "throw") {
		const i = Math.min(3, Math.floor((1 - kid.stateT / .38) * 4));
		return set.throw[i] ?? set.throw[0];
	}
	if (kid.state === "hurt") {
		const i = Math.min(3, Math.floor((1 - kid.stateT / .42) * 4));
		return set.hurt[i] ?? set.hurt[0];
	}
	return frameOf(set.idle, kid.animT, 6) ?? set.idle[0];
}
function render(ctx, canvas, state, assets, view) {
	const cssW = canvas.clientWidth;
	const cssH = canvas.clientHeight;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const bw = Math.max(1, Math.floor(cssW * dpr));
	const bh = Math.max(1, Math.floor(cssH * dpr));
	if (canvas.width !== bw || canvas.height !== bh) {
		canvas.width = bw;
		canvas.height = bh;
	}
	const scale = Math.min(cssW / 960, cssH / 540);
	const ox = (cssW - 960 * scale) / 2;
	const oy = (cssH - 540 * scale) / 2;
	let shakeX = 0;
	let shakeY = 0;
	if (view.shakeEnabled && !view.reducedMotion && state.trauma > 0) {
		const mag = state.trauma * state.trauma * 9;
		shakeX = (Math.random() * 2 - 1) * mag;
		shakeY = (Math.random() * 2 - 1) * mag;
	}
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = "#9bb4c6";
	ctx.fillRect(0, 0, cssW, cssH);
	ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + shakeX), dpr * (oy + shakeY));
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, 960, 540);
	ctx.clip();
	ctx.drawImage(snowField(), 0, 0, 960, 540);
	for (const f of state.footprints) {
		ctx.globalAlpha = Math.max(0, f.life / 1.6) * .18;
		ctx.fillStyle = "#7a93a6";
		ctx.beginPath();
		ctx.ellipse(f.x, f.y, 9, 5, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	for (const fort of state.forts) if (assets) {
		const img = assets.fort;
		const w = fort.rx * 2.15;
		const h = fort.ry * 2.5;
		ctx.drawImage(img, fort.x - w / 2, fort.y - h * .62, w, h);
	} else {
		ctx.fillStyle = "#eef6fb";
		ctx.beginPath();
		ctx.ellipse(fort.x, fort.y, fort.rx, fort.ry, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	const drawList = [...state.kids].sort((a, b) => a.y - b.y);
	for (const kid of drawList) drawKid(ctx, kid, assets, view);
	if (assets) for (const ball of state.balls) {
		const img = frameOf(assets.ball, ball.spin, 8);
		if (!img) continue;
		const s = 22;
		ctx.save();
		ctx.translate(ball.x, ball.y);
		ctx.rotate(ball.spin * .4);
		ctx.drawImage(img, -11, -11, s, s);
		ctx.restore();
	}
	else {
		ctx.fillStyle = "#fff";
		for (const ball of state.balls) {
			ctx.beginPath();
			ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	for (const p of state.particles) {
		const a = Math.max(0, p.life / p.maxLife);
		ctx.globalAlpha = a;
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	for (const flake of state.flakes) {
		ctx.globalAlpha = .55;
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	if (view.grab) {
		const kid = state.kids.find((k) => k.id === view.grab.id);
		if (kid && !isOut(kid)) {
			const dir = aimFromKid(kid, state.kids, view.grab.vx * 2.4, view.grab.vy * 2.4);
			const len = Math.hypot(dir.dx, dir.dy) || 1;
			const nx = dir.dx / len;
			const ny = dir.dy / len;
			const dist = 48 + view.grab.charge * 170;
			ctx.save();
			ctx.strokeStyle = "rgba(21,32,43,0.3)";
			ctx.setLineDash([6, 6]);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(kid.x + nx * 24, kid.y + ny * 8);
			ctx.lineTo(kid.x + nx * dist, kid.y + ny * dist * .6);
			ctx.stroke();
			ctx.restore();
		}
	}
	if (state.phase === "intro") drawBanner(ctx, `Level ${state.level}`);
	else if (state.phase === "won") drawBanner(ctx, "Clear");
	ctx.restore();
}
function drawBanner(ctx, text) {
	ctx.save();
	ctx.fillStyle = "rgba(21,32,43,0.45)";
	ctx.fillRect(0, 226, 960, 88);
	ctx.fillStyle = "#f4f7fa";
	ctx.font = "600 42px Fraunces, Georgia, serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, 480, 270);
	ctx.restore();
}
function drawKid(ctx, kid, assets, view) {
	const lifted = kid.state === "grabbed" ? 8 : 0;
	ctx.save();
	ctx.translate(kid.x, kid.y);
	ctx.fillStyle = "rgba(40,60,80,0.22)";
	ctx.beginPath();
	ctx.ellipse(0, 16, lifted ? 11 : 14, 6, 0, 0, Math.PI * 2);
	ctx.fill();
	const img = assets ? kidFrame(kid, assets) : null;
	const size = kid.state === "buried" ? 64 : 58;
	if (img) {
		ctx.save();
		ctx.translate(0, -lifted);
		if (kid.facing === 1) ctx.scale(-1, 1);
		if (kid.flash > 0) ctx.filter = "brightness(2.4)";
		ctx.drawImage(img, -size / 2, -size + 16, size, size);
		ctx.filter = "none";
		ctx.restore();
	} else {
		ctx.translate(0, -lifted);
		ctx.fillStyle = kid.team === "red" ? "#c43b3b" : "#2e6b4a";
		ctx.beginPath();
		ctx.arc(0, -6, 16, 0, Math.PI * 2);
		ctx.fill();
	}
	if (!isOut(kid)) drawPips(ctx, kid);
	if ((view.hoverId === kid.id || view.grab?.id === kid.id) && kid.team === "red" && !isOut(kid)) drawBullseye(ctx, view.grab?.id === kid.id ? view.grab.charge : 0);
	ctx.restore();
}
function drawPips(ctx, kid) {
	const n = kid.maxHp;
	const y = 22;
	const w = 8;
	const total = n * w + (n - 1) * 4;
	for (let i = 0; i < n; i++) {
		ctx.fillStyle = i < kid.hp ? kid.team === "red" ? "#c43b3b" : "#2e6b4a" : "rgba(21,32,43,0.18)";
		ctx.beginPath();
		ctx.roundRect(-total / 2 + i * 12, y, w, 4, 2);
		ctx.fill();
	}
}
function drawBullseye(ctx, charge) {
	ctx.save();
	ctx.translate(0, -10);
	ctx.strokeStyle = "rgba(196,59,59,0.85)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, 32, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, 0, 5, 0, Math.PI * 2);
	ctx.stroke();
	if (charge > 0) {
		ctx.strokeStyle = "#c43b3b";
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + Math.min(1, charge) * Math.PI * 2, false);
		ctx.stroke();
	}
	ctx.restore();
}
var SnowCraftGame = class {
	canvas;
	ctx;
	onUi;
	audio = new GameAudio();
	assets = null;
	state = createState(1);
	screen = "title";
	grab = null;
	pointer = null;
	hoverId = null;
	raf = 0;
	acc = 0;
	last = 0;
	best = 0;
	shakeEnabled = true;
	reducedMotion = false;
	destroyed = false;
	outcomeHandled = false;
	loaded = false;
	constructor(canvas, onUi) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.onUi = onUi;
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed.best) this.best = parsed.best;
			}
		} catch {}
		this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		this.bind();
		this.emit();
	}
	async start() {
		try {
			this.assets = await loadAssets();
		} catch (err) {
			console.warn("Sprites failed to load, using fallbacks", err);
		}
		this.loaded = true;
		this.emit();
		this.last = performance.now() / 1e3;
		this.raf = requestAnimationFrame(this.loop);
	}
	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.raf);
		this.unbind();
		this.audio.stopMusic();
	}
	play() {
		this.audio.unlock();
		this.audio.startMusic();
		this.screen = "playing";
		this.startLevel(1);
	}
	pause() {
		if (this.screen !== "playing") return;
		this.screen = "paused";
		this.emit();
	}
	resume() {
		if (this.screen !== "paused") return;
		this.screen = "playing";
		this.emit();
	}
	retry() {
		this.audio.unlock();
		this.screen = "playing";
		this.startLevel(1);
	}
	nextLevel() {
		this.startLevel(this.state.level + 1);
	}
	setMuted(v) {
		this.audio.unlock();
		this.audio.setMuted(v);
		this.emit();
	}
	toggleMute() {
		this.setMuted(!this.audio.muted);
	}
	startLevel(level) {
		this.state = createState(level);
		this.grab = null;
		this.outcomeHandled = false;
		this.audio.level();
		if (level > this.best) {
			this.best = level;
			try {
				localStorage.setItem(SAVE_KEY, JSON.stringify({ best: this.best }));
			} catch {}
		}
		this.emit();
	}
	bind() {
		const c = this.canvas;
		c.addEventListener("pointerdown", this.onDown);
		c.addEventListener("pointermove", this.onMove);
		c.addEventListener("pointerup", this.onUp);
		c.addEventListener("pointercancel", this.onUp);
		c.addEventListener("contextmenu", this.onMenu);
		window.addEventListener("keydown", this.onKey);
		document.addEventListener("visibilitychange", this.onVis);
	}
	unbind() {
		const c = this.canvas;
		c.removeEventListener("pointerdown", this.onDown);
		c.removeEventListener("pointermove", this.onMove);
		c.removeEventListener("pointerup", this.onUp);
		c.removeEventListener("pointercancel", this.onUp);
		c.removeEventListener("contextmenu", this.onMenu);
		window.removeEventListener("keydown", this.onKey);
		document.removeEventListener("visibilitychange", this.onVis);
	}
	onMenu = (e) => e.preventDefault();
	onVis = () => {
		if (document.visibilityState === "visible") this.audio.unlock();
	};
	onKey = (e) => {
		if (e.code === "Escape" || e.code === "KeyP") {
			if (this.screen === "playing") this.pause();
			else if (this.screen === "paused") this.resume();
		}
		if (e.code === "KeyM") this.toggleMute();
	};
	toWorld(e) {
		return worldFromClient(this.canvas, e.clientX, e.clientY);
	}
	onDown = (e) => {
		this.audio.unlock();
		if (this.screen !== "playing" || this.state.phase !== "fight") return;
		if (this.grab) return;
		const w = this.toWorld(e);
		const kid = this.pickRed(w.x, w.y);
		if (!kid) return;
		e.preventDefault();
		this.canvas.setPointerCapture(e.pointerId);
		this.grab = {
			id: kid.id,
			pointerId: e.pointerId,
			charge: 0,
			lastX: w.x,
			lastY: w.y,
			vx: 0,
			vy: 0
		};
		kid.state = "grabbed";
		this.audio.grab();
	};
	onMove = (e) => {
		const w = this.toWorld(e);
		this.pointer = w;
		this.hoverId = this.pickRed(w.x, w.y)?.id ?? null;
		if (!this.grab || e.pointerId !== this.grab.pointerId) return;
		const kid = this.state.kids.find((k) => k.id === this.grab.id);
		if (!kid || isOut(kid)) return;
		this.grab.vx = w.x - kid.x;
		this.grab.vy = w.y - kid.y;
		kid.x = clamp(w.x, 34, 926);
		kid.y = clamp(w.y, 34, 506);
		this.grab.lastX = w.x;
		this.grab.lastY = w.y;
	};
	onUp = (e) => {
		if (!this.grab || e.pointerId !== this.grab.pointerId) return;
		this.releaseThrow();
	};
	pickRed(x, y) {
		let best = null;
		let bestD = 44;
		for (const kid of this.state.kids) {
			if (kid.team !== "red" || isOut(kid)) continue;
			const d = Math.hypot(kid.x - x, kid.y - y);
			if (d < bestD) {
				bestD = d;
				best = kid;
			}
		}
		return best;
	}
	releaseThrow() {
		const grab = this.grab;
		this.grab = null;
		if (!grab) return;
		const kid = this.state.kids.find((k) => k.id === grab.id);
		if (!kid || isOut(kid) || this.state.phase !== "fight") {
			if (kid && kid.state === "grabbed") kid.state = "idle";
			return;
		}
		const { dx, dy } = aimFromKid(kid, this.state.kids, grab.vx * 2.4, grab.vy * 2.4);
		const power = throwSnowball(this.state, kid, grab.charge, dx, dy);
		this.audio.throw(power);
	}
	loop = (nowMs) => {
		if (this.destroyed) return;
		this.raf = requestAnimationFrame(this.loop);
		const now = nowMs / 1e3;
		let dt = this.last ? now - this.last : 0;
		this.last = now;
		dt = Math.min(dt, .1);
		if (this.screen !== "paused" && this.screen !== "title") {
			this.acc += dt;
			let steps = 0;
			while (this.acc >= .016666666666666666 && steps < 5) {
				this.step(FIXED_DT);
				this.acc -= FIXED_DT;
				steps++;
			}
		} else if (this.screen === "title") {
			this.state.time += dt;
			for (const flake of this.state.flakes) {
				flake.y += flake.vy * dt * .6;
				if (flake.y > 540) {
					flake.y = -4;
					flake.x = Math.random() * 960;
				}
			}
		}
		this.audio.tick(dt);
		this.draw();
	};
	step(dt) {
		if (this.grab) this.grab.charge = Math.min(MAX_CHARGE, this.grab.charge + dt);
		stepAi(this.state, dt, (power) => this.audio.throw(power));
		stepSim(this.state, dt, (heavy) => {
			if (heavy) this.audio.bury();
			else {
				this.audio.hit();
				this.audio.splat();
			}
			this.emit();
		});
		if (!this.outcomeHandled && this.state.phase === "won") {
			this.outcomeHandled = true;
			this.audio.win();
			window.setTimeout(() => {
				if (this.destroyed || this.screen !== "playing") return;
				this.startLevel(this.state.level + 1);
			}, 1100);
		}
		if (!this.outcomeHandled && this.state.phase === "lost") {
			this.outcomeHandled = true;
			this.audio.lose();
			this.screen = "gameover";
			this.emit();
		}
	}
	draw() {
		const view = {
			grab: this.grab,
			pointer: this.pointer,
			hoverId: this.hoverId,
			shakeEnabled: this.shakeEnabled,
			reducedMotion: this.reducedMotion
		};
		render(this.ctx, this.canvas, this.state, this.assets, view);
	}
	emit() {
		this.onUi({
			screen: this.screen,
			level: this.state.level,
			best: this.best,
			redAlive: living(this.state.kids, "red").length,
			greenAlive: living(this.state.kids, "green").length,
			greenTotal: this.state.kids.filter((k) => k.team === "green").length,
			muted: this.audio.muted,
			ready: this.loaded
		});
	}
};
var INITIAL = {
	screen: "title",
	level: 1,
	best: 0,
	redAlive: 3,
	greenAlive: 3,
	greenTotal: 3,
	muted: false,
	ready: false
};
function SnowCraft() {
	const canvasRef = (0, import_react.useRef)(null);
	const gameRef = (0, import_react.useRef)(null);
	const [ui, setUi] = (0, import_react.useState)(INITIAL);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const game = new SnowCraftGame(canvas, setUi);
		gameRef.current = game;
		game.start();
		return () => {
			game.destroy();
			gameRef.current = null;
		};
	}, []);
	const g = gameRef.current;
	const playing = ui.screen === "playing";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-dvh w-full overflow-hidden bg-ink text-surface",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 size-full touch-none",
				style: { touchAction: "none" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute inset-0 flex flex-col",
				children: [playing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "pointer-events-none flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-ink/70 px-3 py-2 backdrop-blur-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-display text-lg font-semibold leading-tight tracking-tight",
								children: ["Level ", ui.level]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-ice",
								children: ["Best ", ui.best]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 rounded-xl bg-ink/70 px-3 py-2 text-sm tabular-nums backdrop-blur-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-primary",
									children: ui.redAlive
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-ice",
									children: "vs"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-leaf",
									children: ui.greenAlive
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pointer-events-auto flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon",
								className: "bg-ink/70 backdrop-blur-sm",
								"aria-label": ui.muted ? "Unmute" : "Mute",
								onClick: () => g?.toggleMute(),
								children: ui.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon",
								className: "bg-ink/70 backdrop-blur-sm",
								"aria-label": "Pause",
								onClick: () => g?.pause(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, {})
							})]
						})
					]
				}), playing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-ink/70 sm:text-sm",
					children: "Hold a crimson fighter to move · release to throw · forts block shots"
				})]
			}),
			ui.screen === "title" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-0 flex items-center justify-center bg-ink bg-cover bg-center p-4",
				style: { backgroundImage: "url(/images/title-bg.jpg)" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-ink/45" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-full max-w-md rounded-xl border border-surface/15 bg-ink/80 p-6 shadow-xl backdrop-blur-md sm:p-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-[0.22em] text-ice",
							children: "Season's Greetings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-2 font-display text-4xl font-semibold tracking-tight text-surface sm:text-5xl",
							children: "SnowCraft"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-display text-xl text-ice",
							children: "打雪仗"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm leading-relaxed text-surface/80",
							children: "Command three crimson fighters in a snowball brawl. Hold to move, release to throw — the longer you hold, the farther it flies. Hide behind snow forts. Two hits and you're buried."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
							className: "mt-4 space-y-1.5 text-sm text-surface/75",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "1. Press and hold a crimson fighter" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "2. Drag to dodge and line up the shot" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "3. Release to throw toward the pine team" })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-col gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "lg",
								className: "w-full",
								disabled: !ui.ready,
								onClick: () => g?.play(),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {}), ui.ready ? "Play" : "Loading…"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-xs text-ice",
								children: ui.best > 0 ? `Best level ${ui.best}` : "A remake of the 1998 classic"
							})]
						})
					]
				})]
			}),
			ui.screen === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl font-semibold",
					children: "Paused"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted",
					children: ["Level ", ui.level]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "lg",
							onClick: () => g?.resume(),
							children: "Resume"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "secondary",
							onClick: () => g?.retry(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {}), "Restart"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "secondary",
							onClick: () => g?.toggleMute(),
							children: [ui.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {}), ui.muted ? "Unmute" : "Mute"]
						})
					]
				})
			] }),
			ui.screen === "gameover" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl font-semibold",
					children: "Buried"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm leading-relaxed text-muted",
					children: [
						"The pine team buried you at level ",
						ui.level,
						". Best ",
						ui.best,
						"."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "lg",
						onClick: () => g?.retry(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {}), "Fight again"]
					})
				})
			] })
		]
	});
}
function Modal({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("w-full max-w-sm rounded-xl border border-surface/15 bg-surface p-6 text-ink shadow-xl sm:p-7"),
			children
		})
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SnowCraft, {});
}
//#endregion
export { Home as component };
