export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Sensitivity = number;

export async function processImage(file: File, format: 'image/png' | 'image/webp', sensitivity: Sensitivity = 50): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('No context');
      
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      const visited = new Uint8Array(width * height);
      let boxes: BoundingBox[] = [];
      
      // Arka plan rengini (0,0 pikselinden) tahmin et
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];
      
      // Resimde şeffaflık olup olmadığını kabaca anlamak için bir bayrak
      let hasTransparency = bgA < 255; 

      // Alpha threshold > 10 to ignore faint antialiasing or compression artifacts
      const isSolid = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        
        // Eğer piksel şeffafsa (Alpha < 10) boşluktur (solid değildir)
        if (a < 10) return false;
        
        // Eğer arka plan şeffaf değilse (mesela tamamen siyah veya beyaz bir JPG ise),
        // (0,0) koordinatındaki renge (arka plan rengine) çok benzeyen pikselleri boşluk kabul et.
        if (!hasTransparency) {
          const colorDiff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
          // Tolerans değeri (örneğin rgb toplam farkı 30'dan küçükse aynı renktir)
          if (colorDiff < 30) return false; 
        }
        
        return true;
      };

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!visited[idx] && isSolid(x, y)) {
            // BFS
            const q: number[] = [idx];
            visited[idx] = 1;
            
            let minX = x, maxX = x, minY = y, maxY = y;
            let area = 0;
            
            let head = 0;
            while (head < q.length) {
              const curr = q[head++];
              const cx = curr % width;
              const cy = Math.floor(curr / width);
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
            
            // Filter tiny noise based on sensitivity
            // At sensitivity 1: minArea is ~30. At 100: minArea is 2.
            const minArea = Math.max(2, 30 - ((sensitivity - 1) / 99) * 28);
            if (area > minArea) {
              boxes.push({ minX, minY, maxX, maxY });
            }
          }
        }
      }

      // Merge boxes that are close to each other
      // At sensitivity 1: maxDistance is 40. At 100: maxDistance is 5.
      const maxDistance = Math.max(5, 40 - ((sensitivity - 1) / 99) * 35);
      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const b1 = boxes[i];
            const b2 = boxes[j];
            
            const dx = Math.max(0, Math.max(b1.minX - b2.maxX, b2.minX - b1.maxX));
            const dy = Math.max(0, Math.max(b1.minY - b2.maxY, b2.minY - b1.maxY));
            
            if (dx <= maxDistance && dy <= maxDistance) {
              b1.minX = Math.min(b1.minX, b2.minX);
              b1.minY = Math.min(b1.minY, b2.minY);
              b1.maxX = Math.max(b1.maxX, b2.maxX);
              b1.maxY = Math.max(b1.maxY, b2.maxY);
              boxes.splice(j, 1);
              merged = true;
              break;
            }
          }
          if (merged) break;
        }
      }

      // Extract each box into DataURL
      const results: string[] = [];
      for (const box of boxes) {
        // Add 4px padding around the icon
        const pad = 4;
        const finalMinX = Math.max(0, box.minX - pad);
        const finalMinY = Math.max(0, box.minY - pad);
        const finalMaxX = Math.min(width - 1, box.maxX + pad);
        const finalMaxY = Math.min(height - 1, box.maxY + pad);
        
        const boxW = finalMaxX - finalMinX + 1;
        const boxH = finalMaxY - finalMinY + 1;
        
        const c = document.createElement('canvas');
        c.width = boxW;
        c.height = boxH;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          cCtx.putImageData(ctx.getImageData(finalMinX, finalMinY, boxW, boxH), 0, 0);
          results.push(c.toDataURL(format, 1.0));
        }
      }
      
      resolve(results);
    };
    img.onerror = () => reject('Image could not be loaded. Please ensure it is a valid image file.');
    img.src = URL.createObjectURL(file);
  });
}
