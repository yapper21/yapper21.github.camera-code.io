document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('renderCanvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('startBtn');
    const toggleUiBtn = document.getElementById('toggleUiBtn');
    const hiddenUiTrigger = document.getElementById('hiddenUiTrigger');
    const controlsPanel = document.querySelector('.glass');
    const errorMsg = document.getElementById('errorMsg');
    
    // Sliders & Selects
    const themeSelect = document.getElementById('themeSelect');
    const charSelect = document.getElementById('charSelect');
    const densitySelect = document.getElementById('densitySelect');

    // Offscreen canvas for processing video pixels
    const offscreenCanvas = document.createElement('canvas');
    const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // State Variables
    let isPlaying = false;
    let animationId = null;
    let charSize = parseInt(densitySelect.value); // Font size and cell size
    let currentColor = getComputedStyle(document.body).getPropertyValue('--active-color').trim();

    // Character sets sorted from darkest to lightest perceived density
    const charSets = {
        code:   [' ', '.', ':', ';', '=', '+', '{', '}', '(', ')', '[', ']', '1', '0', '#', '&', '@'],
        ascii:  [' ', '.', '-', ':', '*', '+', '=', '%', '@', '#', '&', '8', 'W', 'M'],
        binary: [' ', '0', '1'],
        blocks: [' ', '░', '▒', '▓', '█']
    };
    
    let activeCharSet = charSets[charSelect.value];

    // --- EVENT LISTENERS ---

    // Control Form changes
    themeSelect.addEventListener('change', (e) => {
        document.body.className = e.target.value;
        // Re-fetch the resolved active color variable
        setTimeout(() => {
            currentColor = getComputedStyle(document.body).getPropertyValue('--active-color').trim();
        }, 50);
    });

    charSelect.addEventListener('change', (e) => {
        activeCharSet = charSets[e.target.value];
    });

    densitySelect.addEventListener('input', (e) => {
        charSize = parseInt(e.target.value);
    });

    // UI Toggle
    toggleUiBtn.addEventListener('click', () => {
        controlsPanel.classList.add('fade-out');
        setTimeout(() => {
            hiddenUiTrigger.classList.remove('hidden');
        }, 300);
    });

    hiddenUiTrigger.addEventListener('click', () => {
        hiddenUiTrigger.classList.add('hidden');
        controlsPanel.classList.remove('fade-out');
    });

    // Start Camera
    startBtn.addEventListener('click', async () => {
        if (isPlaying) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                video.play();
                isPlaying = true;
                startBtn.textContent = 'Camera Active';
                startBtn.disabled = true;
                startBtn.style.opacity = '0.5';
                
                toggleUiBtn.classList.remove('hidden');
                
                // Set main canvas to match window initially
                resizeCanvas();
                
                // Commence render loop
                if (!animationId) {
                    renderLoop();
                }
            };
            
            errorMsg.classList.add('hidden');
        } catch (err) {
            console.error("Camera access error:", err);
            errorMsg.textContent = `Camera error: ${err.message || 'Permission denied or no device.'}`;
            errorMsg.classList.remove('hidden');
        }
    });

    // Window Resize handler
    window.addEventListener('resize', resizeCanvas);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // MAP BRIGHTNESS TO CHARACTER
    // 0 = dark, 255 = bright
    function getChar(brightness) {
        // Map 0-255 to the length of the current character array
        const index = Math.floor((brightness / 255) * (activeCharSet.length - 1));
        return activeCharSet[index];
    }

    // THE RENDER LOOP
    function renderLoop() {
        if (!isPlaying || video.paused || video.ended) {
            animationId = requestAnimationFrame(renderLoop);
            return;
        }

        // 1. Calculate the resolution of the internal processing canvas 
        // We divide the screen size by the charSize to get a grid of columns/rows
        const columns = Math.ceil(canvas.width / charSize);
        const rows = Math.ceil(canvas.height / charSize);

        // Adjust off-screen canvas size to match the needed grid points
        if (offscreenCanvas.width !== columns || offscreenCanvas.height !== rows) {
            offscreenCanvas.width = columns;
            offscreenCanvas.height = rows;
        }

        // 2. Clear main canvas completely
        // We use fillRect instead of clearRect so we have a solid background (important if video doesn't cover whole screen)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Draw the video onto the tiny offscreen canvas
        // This effectively downsamples the video to our column/row grid
        offCtx.drawImage(video, 0, 0, columns, rows);

        // 4. Extract pixel data
        const imageData = offCtx.getImageData(0, 0, columns, rows);
        const data = imageData.data;

        // 5. Setup rendering styles
        ctx.font = `bold ${charSize}px "Fira Code", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = currentColor || '#00ff41'; // Fallback to matrix green

        // 6. Loop through our grid and draw text
        // data contains [R, G, B, A] for each pixel
        let i = 0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                const r = data[i * 4];
                const g = data[i * 4 + 1];
                const b = data[i * 4 + 2];
                
                // Calculate perceived brightness (grayscale)
                // Standard luminosity formula: 0.299*R + 0.587*G + 0.114*B
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                
                const char = getChar(brightness);
                
                // Only draw if it's not a space to save processing power
                if (char !== ' ') {
                    // Position calculations (centered in their little grid box)
                    const posX = x * charSize + (charSize / 2);
                    const posY = y * charSize + (charSize / 2);
                    
                    ctx.fillText(char, posX, posY);
                }
                
                i++;
            }
        }

        // Loop baby loop
        animationId = requestAnimationFrame(renderLoop);
    }
});
