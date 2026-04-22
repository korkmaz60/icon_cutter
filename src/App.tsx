import { useState, useRef, DragEvent, useEffect, useCallback } from 'react';
import { Upload, Download, Settings, Moon, Sun, Info, RotateCcw, Copy, CheckCircle2, X, Trash2, Check } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processImage, type Sensitivity } from './utils/imageProcessor';
import './index.css';

type OutputFormat = 'image/png' | 'image/webp';
type Theme = 'light' | 'dark';

interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
}

function App() {
  const [icons, setIcons] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<OutputFormat>('image/png');
  const [sensitivity, setSensitivity] = useState<Sensitivity>(50);
  const [filename, setFilename] = useState('spritesheet');
  const [theme, setTheme] = useState<Theme>('dark');
  const [gridSize, setGridSize] = useState('4x4');
  const [copied, setCopied] = useState(false);
  const [selectedIcons, setSelectedIcons] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cachedFileRef = useRef<File | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
    setToast({ message, type });
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const ext = format === 'image/png' ? 'png' : 'webp';

  /**
   * Asıl işleme fonksiyonu — file, format, sensitivity alır ve sonuçları state'e yazar.
   * requestAnimationFrame ile UI'ın loading render'ını bekler.
   */
  const runProcessing = useCallback(async (file: File, fmt: OutputFormat, sens: Sensitivity) => {
    setIsProcessing(true);
    setIcons([]);
    setSelectedIcons(new Set());

    // UI'ın loading state göstermesi için bir frame bekle
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      const extracted = await processImage(file, fmt, sens);
      setIcons(extracted);
      if (extracted.length === 0) {
        showToast('Görselde ikon tespit edilemedi. Hassasiyeti artırmayı deneyin.', 'info');
      }
    } catch (err) {
      showToast('Resim işlenirken hata oluştu: ' + err, 'error');
      setIcons([]);
    } finally {
      setIsProcessing(false);
    }
  }, [showToast]);

  /**
   * Kullanıcı dosya yüklediğinde çağrılır.
   * Dosyayı cache'ler ve işlemi başlatır.
   */
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Lütfen geçerli bir resim dosyası yükleyin.', 'error');
      return;
    }

    setFilename(file.name.replace(/\.[^/.]+$/, ''));
    cachedFileRef.current = file;
    await runProcessing(file, format, sensitivity);
  }, [format, sensitivity, runProcessing, showToast]);

  /**
   * Format veya hassasiyet değiştiğinde cache'li dosyayı 400ms debounce ile yeniden işler.
   */
  const reprocessDebounced = useCallback((newFormat: OutputFormat, newSens: Sensitivity) => {
    if (!cachedFileRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (cachedFileRef.current) {
        runProcessing(cachedFileRef.current, newFormat, newSens);
      }
    }, 400);
  }, [runProcessing]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const handleDownloadZip = async () => {
    const iconsToDownload = selectedIcons.size > 0
      ? icons.filter((_, idx) => selectedIcons.has(idx))
      : icons;

    if (iconsToDownload.length === 0) return;

    const zip = new JSZip();
    const sortedSelected = selectedIcons.size > 0
      ? Array.from(selectedIcons).sort((a, b) => a - b)
      : icons.map((_, i) => i);

    iconsToDownload.forEach((dataUrl, i) => {
      const base64Data = dataUrl.split(',')[1];
      zip.file(`${filename}_icon_${sortedSelected[i] + 1}.${ext}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${filename}_icons.zip`);
    showToast(`${iconsToDownload.length} ikon başarıyla indirildi.`, 'success');
  };

  const downloadSingleIcon = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}_icon_${index + 1}.${ext}`;
    link.click();
  };

  const toggleIconSelection = (index: number) => {
    setSelectedIcons(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllIcons = () => {
    if (selectedIcons.size === icons.length) {
      setSelectedIcons(new Set());
    } else {
      setSelectedIcons(new Set(icons.map((_, i) => i)));
    }
  };

  const removeSelectedIcons = () => {
    if (selectedIcons.size === 0) return;
    setIcons(prev => prev.filter((_, idx) => !selectedIcons.has(idx)));
    showToast(`${selectedIcons.size} ikon kaldırıldı.`, 'info');
    setSelectedIcons(new Set());
  };

  const resetToUpload = () => {
    setIcons([]);
    setSelectedIcons(new Set());
    cachedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generatedPrompt = `, 2d game asset spritesheet, ${gridSize} grid layout, perfectly aligned, completely isolated objects with clear spacing, flat solid black background, highly detailed, 8k resolution`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)} aria-label="Bildirimi kapat">
            <X size={14} />
          </button>
        </div>
      )}

      <header className="header">
        <div className="header-text" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <img src="/slyce_icon.png" alt="Slyce Logo" style={{width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)', objectFit: 'cover'}} />
          <div>
            <h1>Slyce</h1>
            <p>Smart Asset Extractor</p>
          </div>
        </div>

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <div className="main-layout">
        <div className="content-left">
          {icons.length === 0 && !isProcessing && (
            <>
              <div
                className={`dropzone ${isDragging ? 'drag-active' : ''}`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="drop-icon" size={56} />
                <h2 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Resmi Sürükleyin veya Tıklayın</h2>
                <p style={{color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.5'}}>
                  Siyah/Beyaz arka planlı JPG veya şeffaf arka planlı PNG/WebP desteklenir.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{display: 'none'}}
                  accept="image/png, image/webp, image/jpeg, image/jpg"
                  onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                />
              </div>

              <div style={{marginTop: '1.5rem', padding: '1.5rem', background: 'var(--dropzone-bg)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)'}}>
                <h4 style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-color)'}}>
                  <Info size={18} /> Yapay Zeka İçin Sihirli Ek (Prompt Suffix)
                </h4>
                <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5'}}>
                  Kendi ikon tarzınızı yapay zekaya yazdıktan sonra, <strong>ideal boyutları (256x256px)</strong> yakalamak ve kusursuz siyah arka plan elde etmek için promptunuzun sonuna aşağıdaki eki yapıştırmanız yeterlidir.
                </p>

                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  <div>
                    <label style={{display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-primary)'}}>Nasıl Bir Çıktı İstiyorsunuz?</label>
                    <div className="radio-group" style={{display: 'flex', gap: '0.5rem'}}>
                      <button
                        className={`radio-btn ${gridSize === '4x4' ? 'active' : ''}`}
                        onClick={() => setGridSize('4x4')}
                        style={{padding: '0.6rem', fontSize: '0.85rem'}}
                      >
                        Büyük İkonlar (4x4 Grid - 256px)
                      </button>
                      <button
                        className={`radio-btn ${gridSize === '8x8' ? 'active' : ''}`}
                        onClick={() => setGridSize('8x8')}
                        style={{padding: '0.6rem', fontSize: '0.85rem'}}
                      >
                        Küçük İkonlar (8x8 Grid - 128px)
                      </button>
                    </div>
                  </div>

                  <div style={{marginTop: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-glass)', borderRadius: '8px', position: 'relative'}}>
                    <p style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'monospace', paddingRight: '2rem', wordBreak: 'break-all'}}>
                      {generatedPrompt}
                    </p>
                    <button
                      onClick={copyPrompt}
                      title="Kopyala"
                      style={{position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'}}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(59, 130, 246, 0.05)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)', lineHeight: '1.5'}}>
                    <strong>Türkçe Açıklaması:</strong> Bu ek kod, Midjourney veya DALL-E'ye şunu emreder: <em>"Objeleri oyun içi kullanıma uygun bir ızgara ({gridSize}) şeklinde diz, aralarında net boşluklar bırak, arka planı dümdüz siyah renkte yap ve yüksek detaylı olsun."</em>
                  </div>
                </div>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="dropzone">
              <div className="loader"></div>
              <h2>Pikseller Taranıyor...</h2>
              <p style={{marginTop: '0.5rem', color: 'var(--text-secondary)'}}>
                İkonlar yapay zekaya gerek kalmadan hızla ayrıştırılıyor.
              </p>
            </div>
          )}

          {icons.length > 0 && !isProcessing && (
            <div className="results-container">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                <h3>Başarıyla Çıkarıldı ({icons.length} Obje)</h3>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  {icons.length > 1 && (
                    <>
                      <button className="action-btn" onClick={selectAllIcons}>
                        <Check size={14} />
                        {selectedIcons.size === icons.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                      </button>
                      {selectedIcons.size > 0 && (
                        <button className="action-btn action-btn-danger" onClick={removeSelectedIcons}>
                          <Trash2 size={14} />
                          {selectedIcons.size} Kaldır
                        </button>
                      )}
                    </>
                  )}
                  <button className="action-btn" onClick={resetToUpload}>
                    Yeni Yükle
                  </button>
                </div>
              </div>
              <div className="grid-container">
                {icons.map((src, idx) => (
                  <div
                    key={idx}
                    className={`icon-card ${selectedIcons.has(idx) ? 'icon-card-selected' : ''}`}
                    onClick={() => toggleIconSelection(idx)}
                  >
                    <span className="icon-badge">#{idx + 1}</span>
                    <img src={src} alt={`icon-${idx}`} />
                    <button
                      className="icon-download-btn"
                      title="Bu ikonu indir"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSingleIcon(src, idx);
                      }}
                    >
                      <Download size={14} />
                    </button>
                    {selectedIcons.has(idx) && (
                      <div className="icon-check">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="settings-panel">
          <div className="glass-panel" style={{padding: '1.5rem'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem'}}>
              <div style={{background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px'}}>
                <Settings size={20} color="var(--accent-color)" />
              </div>
              <h3 style={{fontSize: '1.2rem', margin: 0}}>Dışa Aktar</h3>
            </div>

            <div className="setting-group" style={{marginBottom: '1.5rem'}}>
              <label>Format Seçimi</label>
              <div className="radio-group">
                <button
                  className={`radio-btn ${format === 'image/png' ? 'active' : ''}`}
                  onClick={() => {
                    setFormat('image/png');
                    reprocessDebounced('image/png', sensitivity);
                  }}
                >
                  PNG
                </button>
                <button
                  className={`radio-btn ${format === 'image/webp' ? 'active' : ''}`}
                  onClick={() => {
                    setFormat('image/webp');
                    reprocessDebounced('image/webp', sensitivity);
                  }}
                >
                  WebP
                </button>
              </div>
            </div>

            <div className="setting-group" style={{marginBottom: '1.5rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <label style={{margin: 0}}>Tarama Hassasiyeti</label>
                  {sensitivity !== 50 && (
                    <button
                      onClick={() => {
                        setSensitivity(50);
                        reprocessDebounced(format, 50);
                      }}
                      style={{background: 'var(--dropzone-bg-active)', border: '1px solid var(--border-glass)', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '4px', transition: 'all 0.2s'}}
                      title="Önerilen ayara (50) sıfırla"
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
                <span style={{fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, background: 'var(--dropzone-bg-active)', padding: '0.2rem 0.5rem', borderRadius: '4px'}}>
                  {sensitivity}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={sensitivity}
                className="slider"
                onChange={(e) => {
                  const newSens = Number(e.target.value) as Sensitivity;
                  setSensitivity(newSens);
                  reprocessDebounced(format, newSens);
                }}
              />
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>
                <span>Büyük Objeler</span>
                <span>(Önerilen: 50)</span>
                <span>Küçük Detaylar</span>
              </div>
            </div>

            <div className="setting-group" style={{marginBottom: '2rem'}}>
              <label>Boyut Seçimi</label>
              <div className="radio-group">
                <button className="radio-btn active">Orijinal Boyut</button>
              </div>
              <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4'}}>
                Mobil çözünürlük klasörleri (1x, 2x, 3x) sonraki versiyonda eklenecektir.
              </p>
            </div>

            <button
              className="primary-btn"
              style={{width: '100%'}}
              disabled={icons.length === 0 || isProcessing}
              onClick={handleDownloadZip}
            >
              <Download size={20} />
              {selectedIcons.size > 0
                ? `Seçilenleri İndir (${selectedIcons.size} / ${icons.length})`
                : `Hepsini İndir (ZIP)`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
