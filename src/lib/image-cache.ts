/** Browser-side image prefetch so pack art is instant on deal. */

const warmed = new Set<string>();

export function preloadImageUrl(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();
  if (warmed.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      warmed.add(url);
      resolve();
    };
    const t = window.setTimeout(finish, 2000);
    img.onload = () => {
      window.clearTimeout(t);
      finish();
    };
    img.onerror = () => {
      window.clearTimeout(t);
      finish();
    };
    img.src = url;
    if (img.complete) {
      window.clearTimeout(t);
      finish();
    }
  });
}

export function preloadImageUrls(
  urls: string[],
  concurrency = 12
): Promise<void> {
  const list = [...new Set(urls.filter(Boolean))];
  if (!list.length) return Promise.resolve();
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      await preloadImageUrl(list[idx]!);
    }
  });
  return Promise.all(workers).then(() => undefined);
}

export function isImageWarmed(url: string | null | undefined): boolean {
  return !!url && warmed.has(url);
}
