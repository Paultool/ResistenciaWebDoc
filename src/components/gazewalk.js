// gaze-walk-controls.js

AFRAME.registerComponent('gaze-walk-controls', {
  schema: {
    // Velocidad de movimiento (ajusta a tu gusto)
    speed: { type: 'number', default: 0.05 }, 
    // Tiempo en milisegundos que el cursor debe estar fijo para moverse
    walkThreshold: { type: 'number', default: 2000 } // 2 segundos
  },

  init: function () {
    this.playerEl = document.querySelector('[player]'); // Asume que tienes un player entity
    this.el.sceneEl.camera.el.setAttribute('cursor', 'fuseTimeout', this.data.walkThreshold);
    this.walking = false;
    this.gazingAtWalkable = false;

    // Escucha el evento 'fusing' del cursor (cuando el temporizador ha terminado)
    this.el.addEventListener('fusing', (evt) => {
      // Solo empezamos a caminar si miramos un objeto que no sea interactivo
      if (this.gazingAtWalkable) {
          this.walking = true;
      }
    });

    // Escucha cuando el cursor deja de interactuar con algo
    this.el.addEventListener('fused', (evt) => {
        this.walking = false;
        this.gazingAtWalkable = false;
    });

    // Agrega listeners para saber si estamos mirando un mesh que se puede caminar
    this.el.addEventListener('raycaster-intersected', (evt) => {
        const intersectedEl = evt.detail.el;
        
        // Asumimos que si no es un Hotspot interactivo, es suelo o pared para caminar.
        // **IMPORTANTE:** Ajusta esta condición a tu lógica de Hotspots.
        const isHotspot = intersectedEl.components.hotspot-interaction; // Ejemplo

        if (!isHotspot) {
            this.gazingAtWalkable = true;
            this.intersection = evt.detail.intersection;
        } else {
            this.gazingAtWalkable = false;
        }
    });
    
    this.el.addEventListener('raycaster-intersected-cleared', () => {
        this.gazingAtWalkable = false;
        this.walking = false;
    });
  },

  tick: function () {
    if (this.walking && this.intersection) {
        let currentPos = this.el.object3D.position;
        let target = new THREE.Vector3();
        
        // Obtener la posición del punto donde estamos mirando
        target.copy(this.intersection.point);

        // Vector de la cámara al punto de mira (solo XZ, manteniendo la altura Y)
        let direction = new THREE.Vector3().subVectors(target, currentPos).normalize();
        
        // Aseguramos que la cámara no se hunda en el suelo (mantener altura)
        let newPos = currentPos.add(direction.multiplyScalar(this.data.speed));
        
        // Mover la entidad player (o la cámara si es el player)
        this.el.object3D.position.set(newPos.x, currentPos.y, newPos.z);
        
        // Si nos acercamos mucho al objetivo, detenemos el movimiento
        if (currentPos.distanceTo(target) < this.data.speed * 2) {
             this.walking = false;
        }
    }
  }
});