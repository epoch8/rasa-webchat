type activeChangeCb = (active: boolean) => void;

interface ttsConfig {
    apiKey?: string;
    voice?: string;
}

interface ttsTask {
    text: string;
    config?: ttsConfig;
    cb?: trackPlayedCb;
}

interface audioTask {
    audioData: Blob;
    ttsTask: ttsTask;
}

type trackPlayedCb = (task: ttsTask) => void;

class TTSController {
    protected active: boolean;
    protected ws: WebSocket | null;
    protected audioChunks: Array<Blob>;
    protected audioTasks: Array<audioTask>;
    protected ttsTasks: Array<ttsTask>;
    protected playing: boolean;
    protected audioElement: HTMLAudioElement | null;
    protected audioURL: string | null;
    ttsServerUrl: string;
    onActiveChange: activeChangeCb | null;
    onTracksPlayed: () => void | null;

    constructor(ttsServerUrl?: string) {
        this.active = false;
        this.ttsServerUrl = ttsServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.audioChunks = [];
        this.audioTasks = [];
        this.ttsTasks = [];
        this.playing = false;
        this.audioElement = new Audio();
        this.audioURL = null;
        this.onActiveChange = null;
    }

    protected processNextTask() {
        if (this.ws) {
            console.error('WS alredy openned!');
            return;
        }
        const task = this.ttsTasks.pop();
        if (!task) {
            return;
        }
        this.ws = new WebSocket(this.ttsServerUrl);
        this.ws.onopen = (ev: Event) => {
            this.setActive(true);
            if (task.config) {
                const { apiKey, ...config } = task.config;
                if (apiKey) {
                    this.ws.send(apiKey);
                }
                this.ws.send(JSON.stringify({ config }));
            }
            this.ws.send(task.text);
        };
        this.ws.onmessage = (ev: MessageEvent) => {
            // console.log('Response:', ev.data);
            const audioData: Blob = ev.data;
            this.audioChunks.push(audioData);
        };
        this.ws.onclose = (ev: CloseEvent) => {
            console.info('Socket closed');
            console.info(ev);
            this.setActive(false);
            this.ws = null;
            this.audioTasks.push({ audioData: new Blob(this.audioChunks), ttsTask: task });
            this.audioChunks = [];
            this.playNextTrack();
            this.processNextTask();
        };
        this.ws.onerror = (ev: Event) => {
            console.error('WS error:', ev);
        };
    }

    protected playNextTrack = () => {
        if (this.playing || this.audioTasks.length === 0) {
            return;
        }
        console.log('Playing next track');
        this.playing = true;
        const audioTask = this.audioTasks.pop();
        this.audioURL = window.URL.createObjectURL(audioTask.audioData);
        this.audioElement.src = this.audioURL;
        this.audioElement.onended = event => {
            this.closeAudio();
            console.log('onended');
            if (audioTask.ttsTask.cb) {
                audioTask.ttsTask.cb(audioTask.ttsTask);
            }
            if (this.audioTasks.length === 0) {
                if (this.onTracksPlayed) {
                    this.onTracksPlayed();
                }
            } else {
                this.playNextTrack();
            }
        };
        this.audioElement.load();
        this.audioElement.play();
        console.log('playing');
    };

    protected setActive(active: boolean) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }

    protected closeSocket() {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }
    }

    protected closeAudio() {
        this.audioElement.src = '';
        if (this.audioURL) {
            window.URL.revokeObjectURL(this.audioURL);
            this.audioURL = null;
        }
        this.playing = false;
    }

    isActive = () => this.active;

    enqueue = (text: string, config?: ttsConfig, onTrackPlayed?: trackPlayedCb) => {
        this.ttsTasks.push({ text, config, cb: onTrackPlayed });
        if (!this.ws) {
            this.processNextTask();
        }
    };

    cleanup = () => {
        this.closeSocket();
        this.closeAudio();
        this.audioChunks = [];
        this.audioTasks = [];
        this.ttsTasks = [];
    };
}

export default TTSController;
