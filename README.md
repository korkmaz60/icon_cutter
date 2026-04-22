# Slyce (Icon Cutter) - Premium AI Asset Extractor ✂️

Slyce, oyun geliştiricileri ve tasarımcılar için yapay zeka (Midjourney, DALL-E) ile üretilen Sprite Grid (toplu ikon) görsellerindeki objeleri tarayıcı üzerinde milisaniyeler içinde tek tek kesen ve arka planlarını şeffaflaştıran açık kaynaklı, lokal bir araçtır.

![Slyce UI](https://github.com/user-attachments/assets/slyce-preview) <!-- Placeholder for actual screenshot -->

## Özellikler ✨

*   **Piksel Tarama Motoru (BFS):** HTML5 Canvas tabanlı özel Breadth-First Search algoritmasıyla pikselleri tarar. "Solid Black" (Tam Siyah) veya Şeffaf arka plana sahip görsellerdeki parçaları kusursuzca ayırt eder.
*   **Tamamen Lokal & Güvenli:** Görselleriniz hiçbir sunucuya yüklenmez; tüm kesme işlemi tarayıcınızın donanım gücüyle cihazınızda gerçekleşir.
*   **Hassasiyet Ayarı:** 1-100 arasında değiştirilebilen "Tarama Hassasiyeti" çubuğu ile büyük objeleri bütün tutabilir veya çok ufak parçacıkları/büyü efektlerini ayrı ikonlar olarak söküp alabilirsiniz.
*   **Yapay Zeka Prompt Yardımcısı:** İkonlarınızı tam 256x256px çözünürlükte kesebilmek için yapay zekaya vermeniz gereken sihirli ek komutları (Suffix) tek tıkla üretir ve kopyalar.
*   **Premium Arayüz:** Nottut ve Zempra esintili, Tailwind kullanılmadan saf CSS ile yazılmış Glassmorphism ağırlıklı modern aydınlık/karanlık (Light/Dark) tema.
*   **Hızlı Dışa Aktarım:** Tek tıklama ile tespit edilen tüm ikonları (PNG veya WebP olarak) numaralandırıp tek bir `.zip` dosyası halinde indirir.

## Kurulum ve Çalıştırma 🚀

Proje **Vite + React + TypeScript** kullanılarak oluşturulmuştur.

1. Projeyi bilgisayarınıza indirin:
   ```bash
   git clone https://github.com/korkmaz60/icon_cutter.git
   cd icon_cutter
   ```

2. Gerekli kütüphaneleri (JSZip, File-Saver, Lucide-React vb.) yükleyin:
   ```bash
   npm install
   ```

3. Geliştirme sunucusunu başlatın:
   ```bash
   npm run dev
   ```

4. Tarayıcınızda `http://localhost:5173` adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

## Kullanım Kılavuzu 📖

1. **Görsel Üretimi:** Midjourney veya DALL-E'ye gidin. Arayüzümüzdeki **"Yapay Zeka İçin Sihirli Ek"** aracından kopyaladığınız kodu kendi promptunuzun sonuna yapıştırarak siyah arka planlı ve ızgara görünümlü (4x4 veya 8x8) görselinizi üretin.
2. **Yükleme:** Üretilen görseli Slyce'ın ekranına sürükleyip bırakın.
3. **Ayarlar:** Gerekiyorsa sağ menüden "Tarama Hassasiyetini" ayarlayın. Formatınızı seçin (PNG/WebP).
4. **İndirme:** Hepsini İndir butonuna basarak tüm ikonları zip formatında ayrı ayrı dosyalanmış şekilde bilgisayarınıza kaydedin.

## Teknoloji Yığını (Tech Stack) 🛠️
*   **Frontend:** React 18, Vite
*   **Styling:** Pure CSS (CSS Variables, Glassmorphism)
*   **İkonlar:** Lucide React
*   **Dışa Aktarım:** JSZip, FileSaver.js

---
*Geliştirici:* Salih KORKMAZ
