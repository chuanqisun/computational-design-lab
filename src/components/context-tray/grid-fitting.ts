export interface GridTile {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: number;
}

const segments = (counts: Int32Array, length: number, isGap: (count: number) => boolean, minLength: number) => {
  const result: Array<[number, number]> = [];
  let start = -1;
  for (let index = 0; index <= length; index += 1) {
    const gap = index === length || isGap(counts[index]);
    if (!gap && start < 0) start = index;
    if (gap && start >= 0) {
      if (index - start >= minLength) result.push([start, index - 1]);
      start = -1;
    }
  }
  return result;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the search image."));
    image.src = src;
  });

export async function segmentGridImage(src: string): Promise<Array<GridTile & { imageSrc: string }>> {
  const image = await loadImage(src);
  const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not segment the search image.");
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  const columns = new Int32Array(width);
  const rows = new Int32Array(height);
  const summed = new Int32Array((width + 1) * (height + 1));
  for (let y = 0, pixel = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1, pixel += 4) {
      const luminance = (pixels[pixel] * 77 + pixels[pixel + 1] * 151 + pixels[pixel + 2] * 28) >> 8;
      const dark = luminance < 128 ? 1 : 0;
      columns[x] += dark;
      rowSum += dark;
      summed[(y + 1) * (width + 1) + x + 1] = summed[y * (width + 1) + x + 1] + rowSum;
    }
    rows[y] = rowSum;
  }

  const darkIn = (x0: number, y0: number, x1: number, y1: number) =>
    summed[(y1 + 1) * (width + 1) + x1 + 1] -
    summed[y0 * (width + 1) + x1 + 1] -
    summed[(y1 + 1) * (width + 1) + x0] +
    summed[y0 * (width + 1) + x0];
  const columnSegments = segments(columns, width, (count) => count >= 0.95 * height, 0.2 * width);
  const rowSegments = segments(rows, height, (count) => count >= 0.95 * width, 0.2 * height);
  const inverseScale = 1 / scale;
  const tiles: GridTile[] = [];

  for (const [y0, y1] of rowSegments) {
    for (const [x0, x1] of columnSegments) {
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const fill = 1 - darkIn(x0, y0, x1, y1) / area;
      if (fill >= 0.5) {
        tiles.push({
          x: Math.round(x0 * inverseScale),
          y: Math.round(y0 * inverseScale),
          width: Math.round((x1 - x0 + 1) * inverseScale),
          height: Math.round((y1 - y0 + 1) * inverseScale),
          fill: Number(fill.toFixed(3)),
        });
      }
    }
  }

  if (tiles.length !== 9) {
    console.warn(`Search expected 9 tiles but detected ${tiles.length}.`);
  }

  return tiles.map((tile) => {
    const crop = document.createElement("canvas");
    crop.width = tile.width;
    crop.height = tile.height;
    const cropContext = crop.getContext("2d");
    if (!cropContext) throw new Error("Could not crop a search tile.");
    cropContext.drawImage(image, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
    return { ...tile, imageSrc: crop.toDataURL("image/jpeg", 0.92) };
  });
}
