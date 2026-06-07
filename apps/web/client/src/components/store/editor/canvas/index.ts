import { DefaultSettings } from '@onlook/constants';
import type { Canvas, RectPosition } from '@onlook/models';
import { makeAutoObservable } from 'mobx';
import type { EditorEngine } from '../engine';

export class CanvasManager {
    private _id: string = '';
    private _scale: number = DefaultSettings.SCALE;
    private _position: RectPosition = DefaultSettings.PAN_POSITION;

    constructor(private readonly editorEngine: EditorEngine) {
        this._position = this.getDefaultPanPosition();
        makeAutoObservable(this);
    }

    applyCanvas(canvas: Canvas) {
        this.id = canvas.id;
        this.scale = canvas.scale ?? DefaultSettings.SCALE;
        this.position = canvas.position ?? this.getDefaultPanPosition();
    }

    getDefaultPanPosition(): RectPosition {
        return { x: 200, y: 100 };
    }

    get id() {
        return this._id;
    }

    set id(value: string) {
        this._id = value;
    }

    get scale() {
        return this._scale;
    }

    set scale(value: number) {
        this._scale = value;
    }

    get position() {
        return this._position;
    }

    set position(value: RectPosition) {
        this._position = value;
    }

    clear() {
        this._scale = DefaultSettings.SCALE;
        this._position = DefaultSettings.PAN_POSITION;
    }
}
