import { useState, useRef, DragEvent } from 'react';
import { Upload, Download, Settings, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processImage } from './utils/imageProcessor';
import './index.css';

type OutputFormat = 'image/png' | 'image/webp';

function App() {
  const [icons, setIcons] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<OutputFormat>('image/png');
  const [filename, setFilename] = useState('spritesheet');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir resim dosyası yükleyin.');
      return;
    }
    
    setFilename(file.name.replace(/\.[^/.]+$/, ""));
    setIsProcessing(true);
    setIcons([]);
    
    // Slight timeout to allow UI to render loading state
    setTimeout(async () => {
      try {
        const extractedIcons = await processImage(file, format);
        setIcons(extractedIcons);
      } catch (err) {
        alert('Resim işlenirken hata oluştu: ' + err);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

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

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const handleDownloadZip = async () => {
    if (icons.length === 0) return;
    
    const zip = new JSZip();
    const ext = format === 'image/png' ? 'png' : 'webp';
    
    icons.forEach((dataUrl, idx) => {
      const base64Data = dataUrl.split(',')[1];
      zip.file(`${filename}_icon_${idx + 1}.${ext}`, base64Data, { base64: true });
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${filename}_icons.zip`);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Cutter.io</h1>
        <p>Premium Icon Extractor & Slicer</p>
      </header>

      <div className="main-layout">
        <div className="content-left">
          {icons.length === 0 && !isProcessing && (
            <div 
              className={`dropzone ${isDragging ? 'drag-active' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="drop-icon" size={48} />
              <h2>Resmi Sürükleyin veya Tıklayın</h2>
              <p style={{marginTop: '0.5rem', color: 'var(--text-secondary)'}}>
                Şeffaf arka planlı PNG veya WebP desteklenir.
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{display: 'none'}}
                accept="image/png, image/webp"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {isProcessing && (
            <div className="dropzone">
              <Loader2 className="drop-icon loader" size={48} />
              <h2>İkonlar Çıkarılıyor...</h2>
              <p style={{marginTop: '0.5rem', color: 'var(--text-secondary)'}}>
                Yapay zekaya gerek kalmadan pikseller taranıyor.
              </p>
            </div>
          )}

          {icons.length > 0 && !isProcessing && (
            <div className="results-container">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h3>Çıkarılan İkonlar ({icons.length})</h3>
                <button 
                  style={{background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'}}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                  onClick={() => setIcons([])}
                >
                  Yeni Yükle
                </button>
              </div>
              <div className="grid-container">
                {icons.map((src, idx) => (
                  <div key={idx} className="icon-card">
                    <span className="icon-badge">#{idx + 1}</span>
                    <img src={src} alt={`icon-${idx}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="settings-panel">
          <div className="glass-panel" style={{padding: '1.5rem'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem'}}>
              <Settings size={20} color="var(--accent-color)" />
              <h3 style={{fontSize: '1.2rem', margin: 0}}>Dışa Aktar</h3>
            </div>
            
            <div className="setting-group" style={{marginBottom: '1.5rem'}}>
              <label>Format Seçimi</label>
              <div className="radio-group">
                <button 
                  className={`radio-btn ${format === 'image/png' ? 'active' : ''}`}
                  onClick={() => {
                    setFormat('image/png');
                    if (icons.length > 0) setIcons([]); // Format changing requires re-processing for now
                  }}
                >
                  PNG
                </button>
                <button 
                  className={`radio-btn ${format === 'image/webp' ? 'active' : ''}`}
                  onClick={() => {
                    setFormat('image/webp');
                    if (icons.length > 0) setIcons([]);
                  }}
                >
                  WebP
                </button>
              </div>
            </div>

            <div className="setting-group" style={{marginBottom: '2rem'}}>
              <label>Boyut Seçimi</label>
              <div className="radio-group">
                <button className="radio-btn active">Orijinal Boyut</button>
              </div>
              <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>
                Mobil boyutlar (1x, 2x, 3x) sonraki versiyonda eklenecektir.
              </p>
            </div>

            <button 
              className="primary-btn" 
              style={{width: '100%'}}
              disabled={icons.length === 0 || isProcessing}
              onClick={handleDownloadZip}
            >
              <Download size={20} />
              Hepsini İndir (ZIP)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
