// global.d.ts
import 'umami-browser';

declare global {
    interface Window {
        umami: umami.umami;
    }
}

export { };