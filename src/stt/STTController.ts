import AudioRecorder from './AudioRecorder';

type recognitionDataCb = (text: string, final: boolean) => void;
type sttAvailableChangeCb = (available: boolean) => void;
type activeChangeCb = (active: boolean) => void;

interface recognitionResponse {
    partial?: string;
    text?: string;
}

class STTController {
    protected active: boolean;
    protected audioRecorder: AudioRecorder;
    protected sttServerUrl: string;
    protected ws: WebSocket | null;
    protected sttAvailable: boolean;
    protected reconnectTimeoutId: NodeJS.Timeout | null;
    onRecognitionData: recognitionDataCb | null;
    onSttAvailableChange: sttAvailableChangeCb | null;
    onActiveChange: activeChangeCb | null;

    constructor(sttServerUrl?: string) {
        this.active = false;
        this.audioRecorder = new AudioRecorder();
        this.sttServerUrl = sttServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.sttAvailable = false;
        this.reconnectTimeoutId = null;
        this.onRecognitionData = null;
        this.onSttAvailableChange = null;
        this.onActiveChange = null;

        this.initSttServerConn();
    }

    protected initSttServerConn() {
        this.ws = new WebSocket(this.sttServerUrl);
        this.ws.onopen = (ev: Event) => {
            this.setSttAvailable(true);
        };
        this.ws.onmessage = (ev: MessageEvent) => {
            console.log('Response:', ev.data);
            if (!this.onRecognitionData) {
                return;
            }
            const response: recognitionResponse = JSON.parse(ev.data);
            if (response.hasOwnProperty('partial')) {
                this.onRecognitionData(response.partial, false);
            } else if (response.hasOwnProperty('text')) {
                this.onRecognitionData(response.text, true);
            }
        };
        this.ws.onclose = (ev: CloseEvent) => {
            console.info('Socket closed');
            console.info(ev);
            // this.setSttAvailable(false);
            this.setActive(false);
            this.stopRecording();
            if (ev.wasClean) {
                this.ReconnectAfter(100);
            } else {
                this.setSttAvailable(false);
                this.ReconnectAfter(2000);
            }
        };
        this.ws.onerror = (ev: Event) => {
            console.error('WS error:', ev);
            this.stopRecording();
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
            this.initSttServerConn();
        }, delay_ms);
    }

    protected setActive(active: boolean) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }

    protected setSttAvailable(available: boolean) {
        this.sttAvailable = available;
        if (this.onSttAvailableChange) {
            this.onSttAvailableChange(available);
        }
    }

    protected stopRecording() {
        this.audioRecorder.onAudioChunk = null;
        this.audioRecorder.stop();
    }

    isSttAvalable = () => this.sttAvailable;

    isActive = () => this.active;

    start = async () => {
        if (this.active) {
            console.warn('STTController already started!');
            return;
        }
        if (!this.sttAvailable) {
            console.warn('STT unavailable!');
            return;
        }
        this.setActive(true);
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

    stop = () => {
        console.log('stop()');
        if (!this.active || !this.sttAvailable) {
            return;
        }
        this.ws.send('{"eof" : 1}');
        this.stopRecording();
        this.setActive(false);
        console.log('stopped');
    };

    getAudioData = (): Blob => {
        return this.audioRecorder.getAudioData();
    };

    setSttUrl = (sttUrl: string) => {
        this.stop();
        this.sttServerUrl = sttUrl;
        this.initSttServerConn();
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
