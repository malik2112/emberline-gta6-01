// EMBERLINE combat — hitscan pistol with tracer, ammo, reload.
import * as THREE from '../vendor/three/three.module.min.js';

export class Combat {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.ammo = 12;
    this.magSize = 12;
    this.reserve = 48;
    this.cooldown = 0;
    this.ray = new THREE.Raycaster();
    this.tracer = null;
    this.tracerT = 0;
    this.flash = new THREE.PointLight(0xffc46b, 0, 12);
    this.scene.add(this.flash);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.tracer.visible = false;
    this.scene.add(this.tracer);
  }

  get canFire() { return this.cooldown <= 0 && this.ammo > 0; }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.tracerT -= dt;
    if (this.tracerT <= 0) this.tracer.visible = false;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 40);
  }

  reload() {
    if (this.ammo === this.magSize || this.reserve <= 0) return false;
    const need = this.magSize - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.audio?.blip(660, 0.07);
    return true;
  }

  // Fires from `origin` along `dir`. Returns {hit:'ped'|'cop'|'car'|null, target}.
  fire(origin, dir, targets) {
    if (!this.canFire) return { hit: null, target: null, dry: this.ammo === 0 };
    this.ammo -= 1;
    this.cooldown = 0.22;
    this.audio?.gunshot();
    this.flash.position.copy(origin).addScaledVector(dir, 1.2);
    this.flash.intensity = 6;

    this.ray.set(origin, dir);
    this.ray.far = 70;
    const meshes = [];
    for (const t of targets) {
      if (!t.obj || t.obj.dead === true) continue;
      t.obj.traverse((m) => { if (m.isMesh) { m.userData.__target = t; meshes.push(m); } });
    }
    const hits = this.ray.intersectObjects(meshes, false);
    let end = origin.clone().addScaledVector(dir, 70);
    let result = { hit: null, target: null };
    if (hits.length > 0) {
      const h = hits[0];
      end = h.point.clone();
      result = { hit: h.object.userData.__target.kind, target: h.object.userData.__target.ref };
    }
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerT = 0.07;
    return result;
  }
}
