export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Sensitivity = number;

/**
 * 8 kenar noktasından örneklem alarak arka plan rengini tespit eder.
 * Sadece (0,0) pikseline güvenmek yerine istatistiksel analiz yapar.
 */
function detectBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number; hasTransparency: boolean } {
  const samplePoints = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)]
  ];

  const colors: { r: number; g: number; b: number; a: number }[] = [];
  for (const [x, y] of samplePoints) {
    const idx = (y * width + x) * 4;
    colors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] });
  }

  // Çoğunluk şeffafsa → şeffaf arka plan
  const transparentCount = colors.filter(c => c.a < 128).length;
  if (transparentCount >= 4) {
    return { r: 0, g: 0, b: 0, hasTransparency: true };
  }

  // Bucket quantization ile en yaygın rengi bul (gürültüye dayanıklı)
  const BUCKET = 16;
  const bucketMap = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (const c of colors) {
    if (c.a < 128) continue;
    const key = `${Math.floor(c.r / BUCKET)},${Math.floor(c.g / BUCKET)},${Math.floor(c.b / BUCKET)}`;
    const entry = bucketMap.get(key);
    if (entry) {
      entry.count++;
    } else {
      bucketMap.set(key, { count: 1, r: c.r, g: c.g, b: c.b });
    }
  }

  let bestColor = { r: colors[0].r, g: colors[0].g, b: colors[0].b };
  let bestCount = 0;
  for (const entry of bucketMap.values()) {
    if (entry.count > bestCount) {
      bestCount = entry.count;
      bestColor = { r: entry.r, g: entry.g, b: entry.b };
    }
  }

  return { ...bestColor, hasTransparency: false };
}

/**
 * Weighted Euclidean distance — insan gözünün yeşile daha duyarlı olmasını hesaba katar.
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

export async function processImage(
  file: File,
  format: 'image/png' | 'image/webp',
  sensitivity: Sensitivity = 50
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Memory leak fix: blob referansını serbest bırak
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('Canvas context oluşturulamadı');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const width = canvas.width;
      const height = canvas.height;

      const visited = new Uint8Array(width * height);
      const boxes: BoundingBox[] = [];

      // Geliştirilmiş arka plan tespiti (8 noktadan örnekleme)
      const bg = detectBackgroundColor(data, width, height);
      const BG_THRESHOLD = 30;

      const isSolid = (x: number, y: number): boolean => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 10) return false;

        if (!bg.hasTransparency) {
          if (colorDistance(r, g, b, bg.r, bg.g, bg.b) < BG_THRESHOLD) return false;
        }

        return true;
      };

      // Gürültü filtresi (sensitivity'ye göre)
      const minArea = Math.max(2, 30 - ((sensitivity - 1) / 99) * 28);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (visited[idx] || !isSolid(x, y)) continue;

          // BFS — periodic queue cleanup ile bellek optimizasyonu
          let q: number[] = [idx];
          visited[idx] = 1;
          let minX = x, maxX = x, minY = y, maxY = y;
          let area = 0;
          let head = 0;

          while (head < q.length) {
            // Her 50K adımda işlenmiş elemanları serbest bırak
            if (head > 50_000) {
              q = q.slice(head);
              head = 0;
            }

            const curr = q[head++];
            const cx = curr % width;
            const cy = (curr - cx) / width;
            area++;

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nIdx = ny * width + nx;
                  if (!visited[nIdx] && isSolid(nx, ny)) {
                    visited[nIdx] = 1;
                    q.push(nIdx);
                  }
                }
              }
            }
          }

          if (area > minArea) {
            boxes.push({ minX, minY, maxX, maxY });
          }
        }
      }

      // Box merge — splice yerine Set ile O(n²) per pass (splice O(n) maliyetini ortadan kaldırır)
      const maxDistance = Math.max(5, 40 - ((sensitivity - 1) / 99) * 35);
      const deleted = new Set<number>();
      let merged = true;

      while (merged) {
        merged = false;
        for (let i = 0; i < boxes.length; i++) {
          if (deleted.has(i)) continue;
          for (let j = i + 1; j < boxes.length; j++) {
            if (deleted.has(j)) continue;

            const b1 = boxes[i];
            const b2 = boxes[j];
            const dx = Math.max(0, Math.max(b1.minX - b2.maxX, b2.minX - b1.maxX));
            const dy = Math.max(0, Math.max(b1.minY - b2.maxY, b2.minY - b1.maxY));

            if (dx <= maxDistance && dy <= maxDistance) {
              b1.minX = Math.min(b1.minX, b2.minX);
              b1.minY = Math.min(b1.minY, b2.minY);
              b1.maxX = Math.max(b1.maxX, b2.maxX);
              b1.maxY = Math.max(b1.maxY, b2.maxY);
              deleted.add(j);
              merged = true;
            }
          }
        }
      }

      // İkon çıkarımı — padding ile DataURL üret
      const PAD = 4;
      const results: string[] = [];

      for (let i = 0; i < boxes.length; i++) {
        if (deleted.has(i)) continue;
        const box = boxes[i];

        const finalMinX = Math.max(0, box.minX - PAD);
        const finalMinY = Math.max(0, box.minY - PAD);
        const finalMaxX = Math.min(width - 1, box.maxX + PAD);
        const finalMaxY = Math.min(height - 1, box.maxY + PAD);
        const boxW = finalMaxX - finalMinX + 1;
        const boxH = finalMaxY - finalMinY + 1;

        const c = document.createElement('canvas');
        c.width = boxW;
        c.height = boxH;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          const iconData = ctx.getImageData(finalMinX, finalMinY, boxW, boxH);

          // Arka plan piksellerini şeffaflaştır (siyah/beyaz JPG arka planları için)
          if (!bg.hasTransparency) {
            const px = iconData.data;
            for (let p = 0; p < px.length; p += 4) {
              if (colorDistance(px[p], px[p + 1], px[p + 2], bg.r, bg.g, bg.b) < BG_THRESHOLD) {
                px[p + 3] = 0;
              }
            }
          }

          cCtx.putImageData(iconData, 0, 0);
          results.push(c.toDataURL(format, 1.0));
        }
      }

      resolve(results);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject('Görsel yüklenemedi. Lütfen geçerli bir resim dosyası olduğundan emin olun.');
    };

    img.src = objectUrl;
  });
}
