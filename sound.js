export class Sound {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.soundSources = {
            'deal': 'sound-deal.mp3',
            'place': 'sound-place.mp3',
            'win': 'sound-win.mp3',
            'invalid': 'sound-invalid.mp3',
            'shuffle': 'sound-shuffle.mp3'
        };

        this.loadAllSounds();
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.buffers[name] = await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Error loading sound: ${name}`, error);
        }
    }

    loadAllSounds() {
        for (const name in this.soundSources) {
            this.loadSound(name, this.soundSources[name]);
        }
    }

    play(name) {
        // Resume context on first user gesture
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const buffer = this.buffers[name];
        if (buffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
        }
    }
}

