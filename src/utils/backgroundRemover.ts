/**
 * Arkaplan Temizleme Modülü
 *
 * @imgly/background-removal kütüphanesini kullanarak tamamen client-side
 * (tarayıcıda) AI tabanlı arkaplan temizleme yapar.
 *
 * - Lazy import ile ilk kullanımda yüklenir
 * - Progress callback desteği
 * - Opsiyonel arka plan rengi ekleme
 */

export interface RemovalProgress {
  phase: 'downloading' | 'processing' | 'done';
  progress: number; // 0-1
}

export type BackgroundColor = 'transparent' | string; // hex renk kodu veya 'transparent'

/**
 * Verilen File objesinin arkaplanını temizler.
 *
 * Input: File objesi, opsiyonel progress callback ve arkaplan rengi
 * İşlem: AI modeli ile arkaplanı tespit edip kaldırır, istenirse yeni renk uygular
 * Output: DataURL string (temizlenmiş görsel)
 */
export async function removeImageBackground(
  file: File,
  onProgress?: (progress: RemovalProgress) => void,
  backgroundColor: BackgroundColor = 'transparent'
): Promise<string> {
  onProgress?.({ phase: 'downloading', progress: 0 });

  // Lazy import — sadece kullanıldığında yüklenir (initial bundle'ı büyütmez)
  const { removeBackground } = await import('@imgly/background-removal');

  onProgress?.({ phase: 'processing', progress: 0.2 });

  const resultBlob = await removeBackground(file, {
    progress: (key: string, current: number, total: number) => {
      // Model indirme veya işleme aşamasına göre ilerleme hesapla
      const normalizedProgress = total > 0 ? current / total : 0;
      const phase = key.includes('fetch') ? 'downloading' : 'processing';
      // İndirme: 0-0.5 arası, İşleme: 0.5-1.0 arası
      const overallProgress = phase === 'downloading'
        ? normalizedProgress * 0.5
        : 0.5 + normalizedProgress * 0.5;
      onProgress?.({ phase, progress: overallProgress });
    }
  });

  // Blob → DataURL dönüşümü
  let resultDataUrl = await blobToDataUrl(resultBlob);

  // İsteniyorsa arka plan rengi ekle
  if (backgroundColor !== 'transparent') {
    resultDataUrl = await applyBackgroundColor(resultDataUrl, backgroundColor);
  }

  onProgress?.({ phase: 'done', progress: 1 });

  return resultDataUrl;
}

/**
 * Şeffaf arka planlı görsele belirtilen rengi arka plan olarak uygular.
 */
async function applyBackgroundColor(dataUrl: string, color: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Önce arka plan rengini doldur
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Sonra şeffaf görseli üstüne çiz
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png', 1.0));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Blob → DataURL dönüşümü
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob DataURL dönüşümü başarısız.'));
    reader.readAsDataURL(blob);
  });
}
