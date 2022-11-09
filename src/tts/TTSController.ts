type ttsAvailableChangeCb = (available: boolean) => void;
type activeChangeCb = (active: boolean) => void;

interface ttsConfig {
    voice?: string;
}

class AsyncCondition {
    protected resolve: () => void;
    protected promise: Promise<void>;
    constructor () {
      this.resolve = () => {}
      this.promise = Promise.resolve()
    }

    notify = () => {
        this.resolve();
    }

    wait = async () => {
        await this.promise;
    }

    lock = async () => {
        await this.wait();
        this.promise = new Promise(resolve => this.resolve = resolve);
    }
  }

class TTSController {
    protected active: boolean;
    protected ttsServerUrl: string;
    protected ws: WebSocket | null;
    protected ttsAvailable: boolean;
    protected reconnectTimeoutId: NodeJS.Timeout | null;
    protected audioChunks: Array<Blob>;
    protected trackReady: AsyncCondition;
    protected trackPlayed: AsyncCondition;
    protected tracks: Array<Blob>;
    onTTSAvailableChange: ttsAvailableChangeCb | null;
    onActiveChange: activeChangeCb | null;

    constructor(ttsServerUrl?: string) {
        this.active = false;
        this.ttsServerUrl = ttsServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.ttsAvailable = false;
        this.reconnectTimeoutId = null;
        this.audioChunks = [];
        this.trackReady = new AsyncCondition();
        this.trackPlayed = new AsyncCondition();
        this.tracks = [];
        this.onTTSAvailableChange = null;
        this.onActiveChange = null;

        this.initTTSServerConn();
    }

    protected initTTSServerConn() {
        this.ws = new WebSocket(this.ttsServerUrl);
        this.ws.onopen = (ev: Event) => {
            this.setTTSAvailable(true);
        };
        this.ws.onmessage = (ev: MessageEvent) => {
            console.log('Response:', ev.data);
            const audioData: Blob = ev.data;

            let recognizedText: string, final: boolean;
            const response: recognitionResponse = JSON.parse(ev.data);
            if (response.hasOwnProperty('partial')) {
                recognizedText = response.partial;
                final = false;
            } else if (response.hasOwnProperty('text')) {
                recognizedText = response.text;
                final = true;
            }

            if (!this.silenceStartTs || recognizedText !== this.recognizedText) {
                this.silenceStartTs = Date.now();
                this.recognizedText = recognizedText;
            } else if (Date.now() - this.silenceStartTs > this.stopOnSilenceDuration) {
                this.silenceStartTs = 0;
                this.recognizedText = '';
                this.stop();
            }

            if (this.onRecognitionData) {
                this.onRecognitionData(recognizedText, final);
            }
        };
        this.ws.onclose = (ev: CloseEvent) => {
            console.info('Socket closed');
            console.info(ev);
            this.setActive(false);
            if (ev.wasClean) {
                this.ReconnectAfter(100);
            } else {
                this.setTTSAvailable(false);
                this.ReconnectAfter(2000);
            }
        };
        this.ws.onerror = (ev: Event) => {
            console.error('WS error:', ev);
        };
    }

    protected ReconnectAfter(delay_ms: number) {
        if (this.reconnectTimeoutId) {
            console.log('Concurrent ReconnectAfter()');
            return;
        }
        this.reconnectTimeoutId = setTimeout(() => {
            console.info('Reconnecting...');
            this.reconnectTimeoutId = null;
            this.initTTSServerConn();
        }, delay_ms);
    }

    protected setActive(active: boolean) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }

    protected setTTSAvailable(available: boolean) {
        this.ttsAvailable = available;
        if (this.onTTSAvailableChange) {
            this.onTTSAvailableChange(available);
        }
    }

    isTTSAvalable = () => this.ttsAvailable;

    isActive = () => this.active;

    speak = async (text: string, config?: ttsConfig) => {
        if (!this.ttsAvailable) {
            return;
        }
        await this.trackReady.lock();
        const trackReady = new Promise(resolve => {
            if (config) {
                this.ws.send(
                    JSON.stringify({
                        config,
                    })
                );
            }
            this.ws.send(text);
        });
        await this.trackReady.wait();

    };

    start = async () => {
        if (this.active) {
            console.warn('STTController already started!');
            return;
        }
        if (!this.ttsAvailable) {
            console.warn('STT unavailable!');
            return;
        }
        this.setActive(true);
        this.silenceStartTs = 0;
        this.recognizedText = '';
        if (!this.audioRecorder.isInited()) {
            await this.audioRecorder.init();
        }
        const sampleRate = this.audioRecorder.getSampleRate();
        console.log('sampleRate:', sampleRate);
        this.ws.send(
            JSON.stringify({
                config: {
                    sample_rate: sampleRate,
                },
            })
        );
        this.audioRecorder.onAudioChunk = (chunk: Int16Array) => {
            this.ws.send(chunk);
        };
        await this.audioRecorder.start();
        console.log('started');
    };

    stop = (immediatly: boolean = false) => {
        console.log('stop()');
        if (!this.active || !this.ttsAvailable) {
            return;
        }
        this.stopRecording();
        if (immediatly) {
            this.ws.send('{"eof" : 1}');
        } else {
            this.ws.close();
        }
        this.setActive(false);
        console.log('stopped');
    };

    getAudioData = (): Blob => {
        return this.audioRecorder.getAudioData();
    };

    setTTSUrl = (ttsUrl: string) => {
        this.stop(false);
        this.ttsServerUrl = ttsUrl;
        this.initTTSServerConn();
    };

    setAudioChunkSize = (chunkSize: number) => {
        this.audioRecorder.setAudioChunkSize(chunkSize);
    };

    cleanup = () => {
        this.audioRecorder.close();
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
    };
}

export default STTController;
