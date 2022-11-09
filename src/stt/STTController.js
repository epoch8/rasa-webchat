"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const AudioRecorder_1 = require("./AudioRecorder");
class STTController {
    constructor(sttServerUrl) {
        this.isSttAvalable = () => this.sttAvailable;
        this.isActive = () => this.active;
        this.start = () => __awaiter(this, void 0, void 0, function* () {
            if (this.active) {
                console.warn('STTController already started!');
                return;
            }
            if (!this.sttAvailable) {
                console.warn('STT unavailable!');
                return;
            }
            this.setActive(true);
            this.silenceStartTs = 0;
            this.recognizedText = '';
            if (!this.audioRecorder.isInited()) {
                yield this.audioRecorder.init();
            }
            const sampleRate = this.audioRecorder.getSampleRate();
            console.log('sampleRate:', sampleRate);
            this.ws.send(JSON.stringify({
                config: {
                    sample_rate: sampleRate,
                },
            }));
            this.audioRecorder.onAudioChunk = (chunk) => {
                this.ws.send(chunk);
            };
            yield this.audioRecorder.start();
            console.log('started');
        });
        this.stop = (immediatly = false) => {
            console.log('stop()');
            if (!this.active || !this.sttAvailable) {
                return;
            }
            this.stopRecording();
            if (immediatly) {
                this.ws.send('{"eof" : 1}');
            }
            else {
                this.ws.close();
            }
            this.setActive(false);
            console.log('stopped');
        };
        this.getAudioData = () => {
            return this.audioRecorder.getAudioData();
        };
        this.setSttUrl = (sttUrl) => {
            this.stop(false);
            this.sttServerUrl = sttUrl;
            this.initSttServerConn();
        };
        this.setAudioChunkSize = (chunkSize) => {
            this.audioRecorder.setAudioChunkSize(chunkSize);
        };
        this.cleanup = () => {
            this.audioRecorder.close();
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
        };
        this.active = false;
        this.audioRecorder = new AudioRecorder_1.default();
        this.sttServerUrl = sttServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.sttAvailable = false;
        this.reconnectTimeoutId = null;
        this.silenceStartTs = 0;
        this.recognizedText = '';
        this.stopOnSilence = false;
        this.stopOnSilenceDuration = 2000;
        this.onRecognitionData = null;
        this.onSttAvailableChange = null;
        this.onActiveChange = null;
        this.initSttServerConn();
    }
    initSttServerConn() {
        this.ws = new WebSocket(this.sttServerUrl);
        this.ws.onopen = (ev) => {
            this.setSttAvailable(true);
        };
        this.ws.onmessage = (ev) => {
            console.log('Response:', ev.data);
            let recognizedText, final;
            const response = JSON.parse(ev.data);
            if (response.hasOwnProperty('partial')) {
                recognizedText = response.partial;
                final = false;
            }
            else if (response.hasOwnProperty('text')) {
                recognizedText = response.text;
                ;
                final = true;
            }
            if (!this.silenceStartTs || (recognizedText !== this.recognizedText)) {
                this.silenceStartTs = Date.now();
                this.recognizedText = recognizedText;
            }
            else if (Date.now() - this.silenceStartTs > this.stopOnSilenceDuration) {
                this.silenceStartTs = 0;
                this.recognizedText = '';
                this.stop();
            }
            if (this.onRecognitionData) {
                this.onRecognitionData(recognizedText, final);
            }
        };
        this.ws.onclose = (ev) => {
            console.info('Socket closed');
            console.info(ev);
            // this.setSttAvailable(false);
            this.setActive(false);
            this.stopRecording();
            if (ev.wasClean) {
                this.ReconnectAfter(100);
            }
            else {
                this.setSttAvailable(false);
                this.ReconnectAfter(2000);
            }
        };
        this.ws.onerror = (ev) => {
            console.error('WS error:', ev);
            this.stopRecording();
        };
    }
    ReconnectAfter(delay_ms) {
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
    setActive(active) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }
    setSttAvailable(available) {
        this.sttAvailable = available;
        if (this.onSttAvailableChange) {
            this.onSttAvailableChange(available);
        }
    }
    stopRecording() {
        this.audioRecorder.onAudioChunk = null;
        this.audioRecorder.stop();
    }
}
exports.default = STTController;
//# sourceMappingURL=STTController.js.map