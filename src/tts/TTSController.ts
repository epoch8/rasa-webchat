type activeChangeCb = (active: boolean) => void;

interface ttsConfig {
    voice?: string;
}

interface ttsTask {
    text: string;
    config?: ttsConfig;
}

class TTSController {
    protected active: boolean;
    protected ws: WebSocket | null;
    protected audioChunks: Array<Blob>;
    protected tracks: Array<Blob>;
    protected tasks: Array<ttsTask>;
    protected playing: boolean;
    protected audioElement: HTMLAudioElement | null
    ttsServerUrl: string;
    onActiveChange: activeChangeCb | null;

    constructor(ttsServerUrl?: string) {
        this.active = false;
        this.ttsServerUrl = ttsServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.audioChunks = [];
        this.tracks = [];
        this.tasks = [];
        this.playing = false;
        this.audioElement = null;
        this.onActiveChange = null;
    }

    protected processNextTask() {
        if (this.ws) {
            console.error('WS alredy openned!');
            return;
        }
        const task = this.tasks.pop();
        if (!task) {
            return;
        }
        this.ws = new WebSocket(this.ttsServerUrl);
        this.ws.onopen = (ev: Event) => {
            this.setActive(true);
            if (task.config) {
                this.ws.send(JSON.stringify(task.config));
            }
            this.ws.send(task.text);
        };
        this.ws.onmessage = (ev: MessageEvent) => {
            console.log('Response:', ev.data);
            const audioData: Blob = ev.data;
            this.audioChunks.push(audioData);
        };
        this.ws.onclose = (ev: CloseEvent) => {
            console.info('Socket closed');
            console.info(ev);
            this.setActive(false);
            this.ws = null;
            this.tracks.push(new Blob(this.audioChunks));
            this.audioChunks = [];
            this.playNextTrack();
            this.processNextTask();
        };
        this.ws.onerror = (ev: Event) => {
            console.error('WS error:', ev);
        };
    }

    protected playNextTrack = () => {
        if (this.playing || this.tracks.length === 0) {
            console.log('this.playing || this.tracks.length === 0');
            return;
        }
        console.log('Playing next track');
        this.playing = true;
        const track = this.tracks.pop();
        const audioURL = window.URL.createObjectURL(track);
        this.audioElement = new Audio(audioURL);
        this.audioElement.oncanplaythrough = event => {
            console.log('oncanplaythrough');
            this.audioElement.play();
        };
        this.audioElement.onended = event => {
            window.URL.revokeObjectURL(audioURL);
            this.playing = false;
            this.audioElement = null;
            console.log('onended');
            this.playNextTrack();
        };
    };

    protected setActive(active: boolean) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }

    isActive = () => this.active;

    enqueue = (text: string, config?: ttsConfig) => {
        this.tasks.push({ text, config });
        if (!this.ws) {
            this.processNextTask();
        }
    };

    cleanup = () => {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
        }
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        this.audioChunks = [];
        this.tracks = [];
        this.tasks = [];
    };
}

export default TTSController;
