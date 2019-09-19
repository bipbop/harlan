declare namespace _export {
    export interface Modal {
        close(): void;
        action(icon: string, action: () => void): JQuery<HTMLElement>;
        gamification(type: string): JQuery<HTMLElement>;
        title(content: string): JQuery<HTMLElement>;
        subtitle(content: string): JQuery<HTMLElement>;
        paragraph(content: string): JQuery<HTMLElement>;
        addParagraph(content: string): JQuery<HTMLElement>;
        addProgress(initProgress?: number): (perc: number) => void;
        imageParagraph(image: string, content: string, imageTitle: string, imageAlternative: string): JQuery<HTMLElement>;
        createForm(): import('./lib/form');
        fullscreen(): void;
        element(): void;
        modal(): void;
        onClose: (() => void) | null;
        createActions(): void;
        title(value: string): void;
    }
}

declare function _export(this: import('../controller')): void

export = _export;