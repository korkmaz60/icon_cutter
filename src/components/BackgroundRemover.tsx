import { useState, useRef, DragEvent, useCallback } from 'react';
import { Upload, Download, X, ImageMinus, Palette } from 'lucide-react';
import { removeImageBackground, type RemovalProgress, type BackgroundColor } from '../utils/backgroundRemover';

interface Props {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ProcessedImage {
  original: string;
  result: string;
  name: string;
}

const BG_PRESETS = [
  { label: 'Şeffaf', value: 'transparent', preview: 'transparent' },
  { label: 'Beyaz', value: '#ffffff', preview: '#ffffff' },
  { label: 'Siyah', value: '#000000', preview: '#000000' },
  { label: 'Mavi', value: '#3b82f6', preview: '#3b82f6' },
  { label: 'Yeşil', value: '#22c55e', preview: '#22c55e' },
  { label: 'Kırmızı', value: '#ef4444', preview: '#ef4444' },
];

export default function BackgroundRemover({ showToast }: Props) {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<RemovalProgress | null>(null);
  const [bgColor, setBgColor] = useState<BackgroundColor>('transparent');
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      showToast('Lütfen geçerli görsel dosyaları yükleyin.', 'error');
      return;
    }

    setIsProcessing(true);
    const results: ProcessedImage[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        setProgress({ phase: 'downloading', progress: 0 });
        const original = await fileToDataUrl(file);
        const result = await removeImageBackground(file, setProgress, bgColor);
        results.push({ original, result, name: file.name.replace(/\.[^/.]+$/, '') });
      } catch (err) {
        showToast(`"${file.name}" işlenirken hata: ${err}`, 'error');
      }
    }

    setImages(prev => [...prev, ...results]);
    setIsProcessing(false);
    setProgress(null);
    if (results.length > 0) {
      showToast(`${results.length} görsel başarıyla işlendi!`, 'success');
    }
  }, [bgColor, showToast]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const downloadImage = (img: ProcessedImage) => {
    const link = document.createElement('a');
    link.href = img.result;
    link.download = `${img.name}_no_bg.png`;
    link.click();
  };

  const downloadAll = () => {
    images.forEach(img => downloadImage(img));
    showToast(`${images.length} görsel indirildi.`, 'success');
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    if (compareIdx === idx) setCompareIdx(null);
  };

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pos);
  };

  const progressPercent = progress ? Math.round(progress.progress * 100) : 0;
  const progressLabel = progress?.phase === 'downloading' ? 'AI Modeli Yükleniyor' : progress?.phase === 'processing' ? 'Arkaplan Temizleniyor' : '';

  return (
    <div className="bg-remover">
      {/* Arkaplan Rengi Seçimi */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Palette size={18} color="var(--accent-color)" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Yeni Arkaplan</span>
        </div>
        <div className="bg-preset-grid">
          {BG_PRESETS.map(p => (
            <button
              key={p.value}
              className={`bg-preset-btn ${bgColor === p.value ? 'active' : ''}`}
              onClick={() => setBgColor(p.value)}
              title={p.label}
            >
              <span
                className={`bg-preset-swatch ${p.value === 'transparent' ? 'checkerboard' : ''}`}
                style={p.value !== 'transparent' ? { background: p.preview } : {}}
              />
              <span className="bg-preset-label">{p.label}</span>
            </button>
          ))}
          <div className="bg-preset-custom">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Özel</label>
            <input
              type="color"
              value={bgColor === 'transparent' ? '#ffffff' : bgColor}
              onChange={e => setBgColor(e.target.value)}
              className="color-picker"
            />
          </div>
        </div>
      </div>

      {/* Yükleme Alanı veya Sonuçlar */}
      {images.length === 0 && !isProcessing && (
        <div
          className={`dropzone ${isDragging ? 'drag-active' : ''}`}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageMinus className="drop-icon" size={56} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Arkaplan Temizlemek İçin Görsel Yükleyin</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: '1.5' }}>
            Yapay zeka ile arkaplanı otomatik temizlenir. Birden fazla görsel yükleyebilirsiniz. Tüm işlemler tarayıcınızda yapılır, verileriniz sunucuya gönderilmez.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/png,image/jpeg,image/webp,image/jpg"
            multiple
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {isProcessing && (
        <div className="dropzone" style={{ cursor: 'default' }}>
          <div className="ai-progress-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" className="ring-bg" />
              <circle cx="50" cy="50" r="42" className="ring-fill" style={{ strokeDashoffset: 264 - (264 * progressPercent / 100) }} />
            </svg>
            <span className="ring-text">{progressPercent}%</span>
          </div>
          <h2 style={{ marginTop: '1rem' }}>{progressLabel}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {progress?.phase === 'downloading' ? 'İlk kullanımda AI modeli indirilir (~40MB), sonraki kullanımlarda cache\'den yüklenir.' : 'Görsel işleniyor, lütfen bekleyin...'}
          </p>
        </div>
      )}

      {images.length > 0 && !isProcessing && (
        <div className="results-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3>{images.length} Görsel İşlendi</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="action-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Daha Ekle
              </button>
              <button className="action-btn" onClick={downloadAll}>
                <Download size={14} /> Hepsini İndir
              </button>
              <button className="action-btn action-btn-danger" onClick={() => { setImages([]); setCompareIdx(null); }}>
                Temizle
              </button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/png,image/jpeg,image/webp" multiple onChange={e => e.target.files && handleFiles(e.target.files)} />
            </div>
          </div>

          {/* Karşılaştırma Slider */}
          {compareIdx !== null && images[compareIdx] && (
            <div className="compare-container glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Önce / Sonra Karşılaştırma</span>
                <button className="toast-close" onClick={() => setCompareIdx(null)}><X size={16} /></button>
              </div>
              <div
                ref={sliderContainerRef}
                className="compare-slider"
                onMouseMove={handleSliderMove}
                onTouchMove={handleSliderMove}
              >
                <img src={images[compareIdx].result} alt="Sonra" className="compare-img" />
                <div className="compare-clip" style={{ width: `${sliderPos}%` }}>
                  <img src={images[compareIdx].original} alt="Önce" className="compare-img" />
                </div>
                <div className="compare-handle" style={{ left: `${sliderPos}%` }}>
                  <div className="compare-handle-line" />
                </div>
                <span className="compare-label compare-label-left">Önce</span>
                <span className="compare-label compare-label-right">Sonra</span>
              </div>
            </div>
          )}

          <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {images.map((img, idx) => (
              <div key={idx} className="icon-card bg-result-card" onClick={() => setCompareIdx(idx)}>
                <img src={img.result} alt={img.name} />
                <div className="bg-card-actions">
                  <button onClick={e => { e.stopPropagation(); downloadImage(img); }} title="İndir">
                    <Download size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeImage(idx); }} title="Kaldır" className="btn-danger">
                    <X size={14} />
                  </button>
                </div>
                <span className="icon-badge">{img.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject('Dosya okunamadı.');
    reader.readAsDataURL(file);
  });
}
