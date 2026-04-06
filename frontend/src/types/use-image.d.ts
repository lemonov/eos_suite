declare module 'use-image' {
  export default function useImage(
    url: string | undefined,
    crossOrigin?: string,
    referrerPolicy?: string
  ): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'];
}
