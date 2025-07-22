class AdvancedPixelBubbleConverter {
    constructor() {
        this.setupElements();
        this.setupEventListeners();
        this.updateControlValues();
        this.initializeSettings();
        this.currentImageData = null;
        this.pixelData = [];
        this.downloadQuality = 'high';
        this.colorCache = new Map();
        this.processingStats = {
            totalBubbles: 0,
            originalSize: '',
            processedSize: '',
            colorCount: 0
        };
        this.isProcessing = false;
        this.shouldCancelProcessing = false;
        this.isMobile = this.detectMobile();
        console.log('Converter initialized. Mobile detected:', this.isMobile);
    }

    // *** FIX 9: Enhanced mobile detection ***
    detectMobile() {
        const toMatch = [
            /Android/i,
            /webOS/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /BlackBerry/i,
            /Windows Phone/i
        ];

        const userAgentMatch = toMatch.some((toMatchItem) => {
            return navigator.userAgent.match(toMatchItem);
        });

        const touchSupport = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const screenSize = window.innerWidth < 768; // Consider small screens as mobile

        return userAgentMatch || (touchSupport && screenSize);
    }

    setupElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.imageInput = document.getElementById('imageInput');
        this.originalCanvas = document.getElementById('originalCanvas');
        this.pixelContainer = document.getElementById('pixelContainer');
        this.convertBtn = document.getElementById('convertBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.statsSection = document.getElementById('statsSection');
        this.originalImagePlaceholder = document.getElementById('originalImagePlaceholder');
        this.bubbleImagePlaceholder = document.getElementById('bubbleImagePlaceholder');
        this.progressBarContainer = document.getElementById('progressBarContainer');
        this.progressText = document.getElementById('progressText');

        // CRITICAL element checks at the start of setup
        const requiredElements = ['uploadArea', 'imageInput', 'originalCanvas', 'pixelContainer', 'convertBtn', 'downloadBtn', 'originalImagePlaceholder', 'bubbleImagePlaceholder'];
        for (const id of requiredElements) {
            if (!this[id]) {
                console.error(`CRITICAL ERROR: Required UI element '${id}' not found. Check your HTML IDs.`);
                alert(`Application failed to load: essential UI element '${id}' missing. Please check console for details.`);
                return;
            }
        }

        this.ctx = this.originalCanvas.getContext('2d');

        this.controls = {
            pixelSize: document.getElementById('pixelSize'),
            maxWidth: document.getElementById('maxWidth'),
            contrast: document.getElementById('contrast'),
            brightness: document.getElementById('brightness'),
            saturation: document.getElementById('saturation'),
            smoothing: document.getElementById('smoothing')
        };

        Object.keys(this.controls).forEach(key => {
            if (!this.controls[key]) {
                console.warn(`Warning: Control element '${key}' not found. Default values will be used.`);
            }
        });

        this.qualityButtons = document.querySelectorAll('.quality-btn');

        this.originalCanvas.style.display = 'none';
        this.pixelContainer.style.display = 'none';
        this.originalImagePlaceholder.style.display = 'block';
        this.bubbleImagePlaceholder.style.display = 'block';
        if (this.statsSection) this.statsSection.style.display = 'none';
        if (this.progressBarContainer) this.progressBarContainer.style.display = 'none';

        console.log('Elements setup complete and initial visibility set.');
    }

    // *** FIX 6 & 7: Enhanced file input handling for mobile ***
    setupEventListeners() {
        // Enhanced mobile file input handling
        this.imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                console.log('File selected via input change event. File details:', {
                    name: e.target.files[0].name,
                    size: e.target.files[0].size,
                    type: e.target.files[0].type,
                    lastModified: e.target.files[0].lastModified
                });
                this.handleFile(e.target.files[0]);
            } else {
                console.log('No file selected via input after picker opened (user cancelled).');
                // Don't show error on mobile when user cancels
                if (!this.isMobile) {
                    this.showError('No file was selected.');
                }
            }
        });

        // *** FIXED: Better mobile tap handling ***
        this.uploadArea.addEventListener('click', () => {
            if (this.isMobile) {
                this.imageInput.click();
            }
        });

        // Extra touch support for older iOS
        this.uploadArea.addEventListener('touchstart', () => {
            if (this.isMobile) {
                this.imageInput.click();
            }
        });

        // Setup drag and drop for desktop (disabled on mobile for better UX)
        if (!this.isMobile) {
            this.setupDragAndDrop();
        }

        // Rest of your existing event listeners...
        Object.keys(this.controls).forEach(key => {
            if (this.controls[key]) {
                this.controls[key].addEventListener('input', () => {
                    this.updateControlValues();
                    this.debounceConvert();
                });
            }
        });

        if (this.convertBtn) {
            this.convertBtn.addEventListener('click', () => this.convertToPixelArt());
        }

        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadPixelArt());
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetUI());
        }

        this.qualityButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectQuality(btn.dataset.quality));
        });

        console.log('Event listeners setup complete.');
    }

    setupDragAndDrop() {
        if (!this.uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => this.uploadArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => this.uploadArea.classList.remove('dragover'), false);
        });

        this.uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files && files[0]) {
                console.log('File dropped. Proceeding to handle file.');
                this.handleFile(files[0]);
            }
        }, false);
    }

    initializeSettings() {
        this.imageFilters = {
            contrast: this.controls.contrast ? parseFloat(this.controls.contrast.value) : 1.2,
            brightness: this.controls.brightness ? parseFloat(this.controls.brightness.value) : 1.0,
            saturation: this.controls.saturation ? parseFloat(this.controls.saturation.value) : 1.1,
            smoothing: this.controls.smoothing ? parseFloat(this.controls.smoothing.value) : 0.3
        };
        this.updateControlValues();
    }

    updateControlValues() {
        Object.keys(this.controls).forEach(key => {
            if (!this.controls[key]) return;

            const valueDisplay = document.getElementById(key + 'Value');
            if (!valueDisplay) {
                return;
            }

            const value = this.controls[key].value;
            valueDisplay.textContent = (key === 'pixelSize' || key === 'maxWidth') ? `${value}px` : value;
        });
    }

    debounceConvert() {
        if (this.isProcessing) return;

        clearTimeout(this.convertTimeout);
        this.convertTimeout = setTimeout(() => {
            if (this.currentImageData) {
                this.convertToPixelArt();
            } else {
                console.log('No image data to convert yet.');
            }
        }, 500);
    }

    handleFile(file) {
        if (!file) {
            console.log('handleFile called with no file object. Aborting.');
            return;
        }

        console.log(`Handling file: ${file.name}, Size: ${this.formatFileSize(file.size)}, Type: ${file.type}`);

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type.toLowerCase())) {
            this.showError('Please select a valid image file (PNG, JPG, JPEG, GIF, WebP)');
            this.resetUI();
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showError('File size must be less than 10MB.');
            this.resetUI();
            return;
        }

        this.processingStats.originalSize = this.formatFileSize(file.size);
        console.log('File is valid, proceeding to loadImage.');
        this.loadImage(file);
    }

    loadImage(file) {
        const reader = new FileReader();

        reader.onerror = (e) => {
            console.error('FileReader error during readAsDataURL:', reader.error, e);
            this.showError('Failed to read file. It might be corrupted or unreadable.');
            this.resetUI();
        };

        reader.onload = async (e) => {
            if (!e.target?.result) {
                this.showError('Failed to load image data from file.');
                this.resetUI();
                return;
            }

            const img = new Image();
            // *** FIX 1: UNCOMMENT THIS LINE FOR MOBILE COMPATIBILITY ***
            img.crossOrigin = 'Anonymous';

            img.onerror = (errorEvent) => {
                console.error('Image element load error:', errorEvent);
                this.showError('Failed to render image on canvas. Ensure it\'s a valid image or check browser console.');
                this.resetUI();
            };

            img.onload = async () => {
                console.log('Image element loaded successfully:', img.width, 'x', img.height);

                // *** FIX 2: Add a small delay to ensure proper rendering on mobile ***
                await this.sleep(100);

                this.displayOriginalImage(img);

                await this.sleep(100); // Additional delay after display

                if (this.originalCanvas && this.ctx) {
                    try {
                        // *** FIX 3: Enhanced error handling for mobile canvas issues ***
                        this.currentImageData = this.ctx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);

                        // More thorough check for valid image data
                        const hasPixels = this.validateImageData(this.currentImageData);
                        if (!hasPixels) {
                            console.warn('getImageData returned invalid data. Retrying...');
                            // Retry once for mobile
                            await this.sleep(200);
                            this.currentImageData = this.ctx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);
                            if (!this.validateImageData(this.currentImageData)) {
                                this.showError('Could not read image pixels. Try a different image or refresh.');
                                this.resetUI();
                                return;
                            }
                        }
                    } catch (e) {
                        console.error('Error capturing getImageData:', e);
                        this.showError('Security error: Cannot process image. Try using a different image.');
                        this.resetUI();
                        return;
                    }
                } else {
                    console.error('Canvas or context not available for getImageData at onload stage.');
                    this.showError('Internal error: Canvas not ready for processing.');
                    this.resetUI();
                    return;
                }

                if (this.convertBtn) {
                    this.convertBtn.disabled = false;
                }
                this.updateStats();

                if (this.originalImagePlaceholder) {
                    this.originalImagePlaceholder.style.display = 'none';
                }
                if (this.originalCanvas) {
                    this.originalCanvas.style.display = 'block';
                }

                if (this.bubbleImagePlaceholder) {
                    this.bubbleImagePlaceholder.style.display = 'block';
                }
                if (this.pixelContainer) {
                    this.pixelContainer.style.display = 'none';
                }

                // *** FIX 4: Auto-convert only if not on mobile (to prevent performance issues) ***
                if (!this.isMobile) {
                    this.convertToPixelArt();
                } else {
                    console.log('Mobile detected - manual conversion required');
                }
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    // *** FIX 8: Enhanced displayOriginalImage for mobile ***
    displayOriginalImage(img) {
        if (!this.ctx || !this.controls.maxWidth || !this.originalCanvas) {
            console.error('Cannot display original image: context, maxWidth control, or canvas element is missing.');
            return;
        }

        const maxWidth = parseInt(this.controls.maxWidth.value) || 600;
        const maxHeight = maxWidth;

        let { width, height } = this.calculateDimensions(img.width, img.height, maxWidth, maxHeight);

        this.originalCanvas.width = width;
        this.originalCanvas.height = height;

        this.ctx.clearRect(0, 0, width, height);

        try {
            // *** Enhanced canvas settings for mobile compatibility ***
            this.ctx.imageSmoothingEnabled = true;
            if ('imageSmoothingQuality' in this.ctx) {
                this.ctx.imageSmoothingQuality = 'high';
            }

            // Apply filters only if not on mobile (performance)
            if (!this.isMobile) {
                this.ctx.filter = this.buildFilterString();
            }

            this.ctx.drawImage(img, 0, 0, width, height);
            this.ctx.filter = 'none'; // Reset filter

        } catch (error) {
            console.warn('Canvas filters or imageSmoothingQuality not fully supported, drawing without them:', error);
            // Fallback for mobile browsers
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(img, 0, 0, width, height);
        }

        this.processingStats.originalSize = `${img.width}x${img.height} (${this.formatFileSize(img.width * img.height * 4)})`;
        this.processingStats.processedSize = `${width}x${height}`;

        console.log('Original image drawn to canvas and processing stats updated.');
    }

    calculateDimensions(origWidth, origHeight, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
        return {
            width: Math.round(origWidth * ratio),
            height: Math.round(origHeight * ratio)
        };
    }

    buildFilterString() {
        const contrast = this.controls.contrast ? this.controls.contrast.value : 1.2;
        const brightness = this.controls.brightness ? this.controls.brightness.value : 1.0;
        const saturation = this.controls.saturation ? this.controls.saturation.value : 1.1;
        return `contrast(${contrast}) brightness(${brightness}) saturate(${saturation})`;
    }

    async convertToPixelArt() {
        if (!this.currentImageData || this.isProcessing) {
            if (!this.currentImageData) {
                console.warn('convertToPixelArt called without currentImageData. Aborting.');
                this.showError('No image loaded yet. Please upload an image first.');
            } else {
                console.warn('convertToPixelArt called but already processing. Aborting.');
                this.showError('Conversion already in progress. Please wait.');
            }
            return;
        }

        console.log('Starting pixel art conversion...');
        this.isProcessing = true;
        this.shouldCancelProcessing = false;

        this.showProgress();

        if (this.convertBtn) {
            this.convertBtn.classList.add('processing');
            this.convertBtn.textContent = 'Converting...';
        }
        if (this.downloadBtn) {
            this.downloadBtn.disabled = true;
        }

        try {
            const pixelSize = this.controls.pixelSize ? parseInt(this.controls.pixelSize.value) : 12;
            const imageData = this.currentImageData;
            const width = imageData.width;
            const height = imageData.height;

            if (this.pixelContainer) {
                this.pixelContainer.innerHTML = '';
                this.pixelContainer.style.setProperty('--pixel-size', pixelSize + 'px');
            }

            this.pixelData = [];
            this.colorCache.clear();

            const uniqueColors = new Set();
            let processedPixels = 0;
            const totalPixelBlocksX = Math.ceil(width / pixelSize);
            const totalPixelBlocksY = Math.ceil(height / pixelSize);
            const totalPixelBlocks = totalPixelBlocksX * totalPixelBlocksY;

            console.log(`Processing ${totalPixelBlocks} pixel blocks (${totalPixelBlocksX}x${totalPixelBlocksY}) with size ${pixelSize}px.`);

            const fragment = document.createDocumentFragment();
            // Adjust update frequency based on device capabilities
            const updateFreq = this.isMobile ? Math.max(1, Math.floor(totalPixelBlocks / 200)) : Math.max(1, Math.floor(totalPixelBlocks / 500));
            console.log(`Progress update frequency: every ${updateFreq} pixels`);

            for (let y = 0; y < height; y += pixelSize) {
                if (this.shouldCancelProcessing) {
                    console.log('Conversion cancelled during row processing.');
                    break;
                }

                const row = document.createElement('div');
                row.className = 'pixel-row';
                const rowData = [];

                for (let x = 0; x < width; x += pixelSize) {
                    if (this.shouldCancelProcessing) break;

                    const avgColor = this.getEnhancedAverageColor(imageData, x, y, pixelSize, width, height);
                    rowData.push(avgColor);
                    uniqueColors.add(`${avgColor.r},${avgColor.g},${avgColor.b}`);

                    const pixel = this.createPixelElement(avgColor);
                    row.appendChild(pixel);

                    processedPixels++;

                    if (processedPixels % updateFreq === 0 || processedPixels === totalPixelBlocks) {
                        this.updateProgress((processedPixels / totalPixelBlocks) * 50);
                        await this.sleep(0); // Allow browser to render updates
                    }
                }

                this.pixelData.push(rowData);
                fragment.appendChild(row);

                // Yield control to browser periodically to prevent UI freeze
                if ((this.isMobile && y % (pixelSize * 3) === 0) || (!this.isMobile && y % (pixelSize * 10) === 0)) {
                     await this.sleep(1);
                }
            }

            if (!this.shouldCancelProcessing) {
                if (this.pixelContainer) {
                    this.pixelContainer.appendChild(fragment);
                    this.pixelContainer.style.display = 'inline-block';
                }
                if (this.bubbleImagePlaceholder) {
                    this.bubbleImagePlaceholder.style.display = 'none';
                }

                this.processingStats.totalBubbles = processedPixels;
                this.processingStats.colorCount = uniqueColors.size;

                if (this.downloadBtn) {
                    this.downloadBtn.disabled = false;
                }

                this.updateStats();
                console.log('Pixel art conversion completed.');
            } else {
                console.log('Pixel art conversion was cancelled.');
                if (this.pixelContainer) this.pixelContainer.innerHTML = '';
                if (this.bubbleImagePlaceholder) this.bubbleImagePlaceholder.style.display = 'block';
            }
        } catch (error) {
            console.error('Error during pixel art conversion:', error);
            this.showError('Conversion failed: ' + error.message);
            if (this.pixelContainer) this.pixelContainer.innerHTML = '';
            if (this.bubbleImagePlaceholder) this.bubbleImagePlaceholder.style.display = 'block';
        } finally {
            this.hideProgress();
            if (this.convertBtn) {
                this.convertBtn.classList.remove('processing');
                this.convertBtn.textContent = 'Convert to Bubble Pixel Art';
            }
            this.isProcessing = false;
        }
    }

    getEnhancedAverageColor(imageData, startX, startY, pixelSize, width, height) {
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;

        const cacheKey = `${startX},${startY},${pixelSize}`;
        if (this.colorCache.has(cacheKey)) {
            return this.colorCache.get(cacheKey);
        }

        const samplePoints = this.isMobile ?
            [{ dx: 0.5, dy: 0.5 }] : // Fewer samples for mobile for performance
            [
                { dx: 0.5, dy: 0.5 },
                { dx: 0.25, dy: 0.25 }, { dx: 0.75, dy: 0.25 },
                { dx: 0.25, dy: 0.75 }, { dx: 0.75, dy: 0.75 }
            ];

        for (const point of samplePoints) {
            const x = Math.min(width - 1, Math.max(0, startX + Math.floor(pixelSize * point.dx)));
            const y = Math.min(height - 1, Math.max(0, startY + Math.floor(pixelSize * point.dy)));
            const index = (y * width + x) * 4;

            if (index >= 0 && index + 2 < data.length) {
                r += data[index];
                g += data[index + 1];
                b += data[index + 2];
                count++;
            } else {
                // console.warn(`Sample point out of bounds: x=${x}, y=${y}, index=${index} (Data length: ${data.length})`);
            }
        }

        if (count === 0) {
            console.warn(`No valid sample points found for block at ${startX},${startY}. Returning black.`);
            return { r: 0, g: 0, b: 0 };
        }

        const avgColor = {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count)
        };

        this.colorCache.set(cacheKey, avgColor);
        return avgColor;
    }

    createPixelElement(color) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel-bubble';

        const baseColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        const lightColor = `rgb(${Math.min(255, color.r + 50)}, ${Math.min(255, color.g + 50)}, ${Math.min(255, color.b + 50)})`;
        const darkColor = `rgb(${Math.max(0, color.r - 35)}, ${Math.max(0, color.g - 35)}, ${Math.max(0, color.b - 35)})`;

        pixel.style.background = `radial-gradient(circle at 30% 30%, ${lightColor} 0%, ${baseColor} 50%, ${darkColor} 100%)`;
        return pixel;
    }

    async downloadPixelArt() {
        if (!this.pixelData.length || this.isProcessing) {
            if (!this.pixelData.length) this.showError('No pixel art generated to download.');
            return;
        }

        if (this.downloadBtn) {
            this.downloadBtn.classList.add('processing');
            this.downloadBtn.textContent = 'Generating Download...';
        }
        this.showProgress();

        try {
            const canvas = await this.renderHighResolutionCanvas();

            if (this.isMobile) {
                this.mobileDownload(canvas);
            } else {
                this.desktopDownload(canvas);
            }
            console.log('Download process initiated.');
        } catch (error) {
            console.error('Error during download process:', error);
            this.showError('Failed to prepare image for download: ' + error.message);
        } finally {
            this.hideProgress();
            if (this.downloadBtn) {
                this.downloadBtn.classList.remove('processing');
                this.downloadBtn.textContent = 'Download Bubble Pixel Art';
            }
        }
    }

    mobileDownload(canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `bubble-pixel-art-${Date.now()}.png`;

        try {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("Attempted direct mobile download.");
        } catch (e) {
            console.warn("Direct mobile download failed, attempting fallback to new window:", e);
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Save Your Image</title>
                        <style>
                            body { background: #333; color: white; text-align: center; padding: 20px; font-family: sans-serif; }
                            img { max-width: 90vw; max-height: 80vh; border: 2px solid #555; border-radius: 8px; margin-top: 20px; }
                            p { margin-top: 20px; font-size: 1.1em; }
                        </style>
                    </head>
                    <body>
                        <h1>Your Bubble Pixel Art</h1>
                        <img src="${dataUrl}" alt="Bubble Pixel Art">
                        <p><strong>Long press</strong> or <strong>right-click</strong> the image above and select "Save Image" or "Download Image" to save it to your device.</p>
                        <p>(File Name: ${fileName})</p>
                    </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                this.showError("Could not open new window for download. Check pop-up blockers.");
            }
        }
    }

    desktopDownload(canvas) {
        const link = document.createElement('a');
        link.download = `bubble-pixel-art-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async renderHighResolutionCanvas() {
        const qualityMultiplier = this.getQualityMultiplier();
        const basePixelSize = this.controls.pixelSize ? parseInt(this.controls.pixelSize.value) : 12;
        const pixelSize = basePixelSize * qualityMultiplier;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!this.pixelData || this.pixelData.length === 0 || !this.pixelData[0]) {
             console.error('Pixel data is empty or malformed, cannot render high-res canvas.');
             throw new Error('No pixel data to render for download.');
        }

        canvas.width = this.pixelData[0].length * pixelSize;
        canvas.height = this.pixelData.length * pixelSize;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let processedRows = 0;
        const totalRows = this.pixelData.length;

        for (let y = 0; y < this.pixelData.length; y++) {
            const row = this.pixelData[y];

            for (let x = 0; x < row.length; x++) {
                const color = row[x];
                const startX = x * pixelSize;
                const startY = y * pixelSize;

                this.drawHighResBubble(ctx, startX, startY, pixelSize, color);
            }

            processedRows++;
            if (processedRows % 10 === 0 || processedRows === totalRows) {
                this.updateProgress(50 + (processedRows / totalRows) * 50);
                await this.sleep(0);
            }
        }
        console.log('High-resolution canvas rendered.');
        return canvas;
    }

    drawHighResBubble(ctx, x, y, size, color) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2 + 0.5;

        const baseColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        const lightColor = `rgb(${Math.min(255, color.r + 70)}, ${Math.min(255, color.g + 70)}, ${Math.min(255, color.b + 70)})`;
        const darkColor = `rgb(${Math.max(0, color.r - 45)}, ${Math.max(0, color.g - 45)}, ${Math.max(0, color.b - 45)})`;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = baseColor;
        ctx.fill();

        const gradient = ctx.createRadialGradient(
            centerX - radius * 0.3, centerY - radius * 0.3, 0,
            centerX, centerY, radius
        );

        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(0.6, baseColor);
        gradient.addColorStop(1, darkColor);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        const highlightGradient = ctx.createRadialGradient(
            centerX - radius * 0.35, centerY - radius * 0.35, 0,
            centerX - radius * 0.35, centerY - radius * 0.35, radius * 0.4
        );

        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(centerX - radius * 0.35, centerY - radius * 0.35, radius * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
    }

    getQualityMultiplier() {
        const qualityMap = {
            'medium': 1,
            'high': 2,
            'ultra': this.isMobile ? 2 : 3
        };
        return qualityMap[this.downloadQuality] || 2;
    }

    selectQuality(quality) {
        this.downloadQuality = quality;
        this.qualityButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-quality="${quality}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    showProgress() {
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'block';
        }
        if (this.progressBar) {
            this.progressBar.style.display = 'block';
        }
        this.updateProgress(0);
    }

    hideProgress() {
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'none';
        }
        if (this.progressBar) {
            this.progressBar.style.display = 'none';
        }
    }

    updateProgress(percentage) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        if (this.progressFill) {
            this.progressFill.style.width = clampedPercentage + '%';
        }
        if (this.progressText) {
            this.progressText.textContent = `Processing... ${Math.round(clampedPercentage)}%`;
        }
    }

    updateStats() {
        const elements = {
            totalBubbles: document.getElementById('totalBubbles'),
            originalSize: document.getElementById('originalSize'),
            processedSize: document.getElementById('processedSize'),
            colorCount: document.getElementById('colorCount')
        };

        if (elements.totalBubbles) elements.totalBubbles.textContent = this.processingStats.totalBubbles.toLocaleString();
        if (elements.originalSize) elements.originalSize.textContent = this.processingStats.originalSize;
        if (elements.processedSize) elements.processedSize.textContent = this.processingStats.processedSize;
        if (elements.colorCount) elements.colorCount.textContent = this.processingStats.colorCount.toLocaleString();

        if (this.statsSection) {
            this.statsSection.style.display = 'grid';
        }
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    showError(message) {
        const existingError = document.getElementById('app-error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.id = 'app-error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            left: 20px;
            background: #ff4757;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
            max-width: calc(100vw - 40px);
            word-wrap: break-word;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    resetUI() {
        this.currentImageData = null;
        this.pixelData = [];
        this.colorCache.clear();

        if (this.pixelContainer) {
            this.pixelContainer.innerHTML = '';
            this.pixelContainer.style.display = 'none';
        }

        if (this.ctx && this.originalCanvas) {
            this.ctx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
            this.originalCanvas.style.display = 'none';
        }

        const defaults = {
            pixelSize: 12,
            maxWidth: 600,
            contrast: 1.2,
            brightness: 1.0,
            saturation: 1.1,
            smoothing: 0.3
        };

        Object.keys(defaults).forEach(key => {
            if (this.controls[key]) {
                this.controls[key].value = defaults[key];
            }
        });
        this.updateControlValues();

        this.processingStats = {
            totalBubbles: 0,
            originalSize: '0 KB',
            processedSize: '0 KB',
            colorCount: 0
        };
        this.updateStats();
        if (this.statsSection) this.statsSection.style.display = 'none';

        if (this.convertBtn) {
            this.convertBtn.disabled = true;
            this.convertBtn.textContent = 'Convert to Bubble Pixel Art';
            this.convertBtn.classList.remove('processing');
        }
        if (this.downloadBtn) {
            this.downloadBtn.disabled = true;
            this.downloadBtn.textContent = 'Download Bubble Pixel Art';
            this.downloadBtn.classList.remove('processing');
        }
        this.hideProgress();

        if (this.originalImagePlaceholder) this.originalImagePlaceholder.style.display = 'block';
        if (this.bubbleImagePlaceholder) this.bubbleImagePlaceholder.style.display = 'block';

        this.qualityButtons.forEach(btn => btn.classList.remove('active'));
        const highQualityBtn = document.querySelector('[data-quality="high"]');
        if (highQualityBtn) {
            highQualityBtn.classList.add('active');
        }
        this.downloadQuality = 'high';

        console.log('UI reset to default state.');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // *** FIX 5: Add image data validation method ***
    validateImageData(imageData) {
        if (!imageData || !imageData.data || imageData.data.length === 0) {
            return false;
        }

        // Check if at least some pixels have non-zero/non-transparent values
        const data = imageData.data;
        let nonZeroPixels = 0;

        // Sample every 100th pixel for performance
        for (let i = 0; i < data.length; i += 400) { // 400 = 4 channels * 100 pixels
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
                nonZeroPixels++;
                if (nonZeroPixels > 5) return true; // Found enough non-zero pixels
            }
        }

        return nonZeroPixels > 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdvancedPixelBubbleConverter();
});

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);