/**
 * Full-Screen 3D PDF Flipbook
 * - Starts turning ONLY after the curtains move / open
 * - Automatically advances page by page every 1 second
 * - First page (Cover) centered, then opens into realistic two-page spread
 * - Realistic Web Audio paper sounds and page shadows
 * - Zero UI clutter, 100% immersive book experience
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';
  }

  // Realistic Paper Rustle Web Audio Engine
  class AudioEngine {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playPaperTurn() {
      try {
        this.init();
        if (!this.ctx) return;
        const ctx = this.ctx;
        const duration = 0.35;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut * 0.72) + (white * 0.28);
          data[i] = lastOut * (1 - (i / bufferSize));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1350, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + duration);
        filter.Q.setValueAtTime(1.6, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
      } catch (err) {
        // Audio policy or silent mode fallback
      }
    }
  }

  // State Management
  const state = {
    pdfDoc: null,
    pdfUrl: './pdf/ncastem_2026.pdf',
    pageFlip: null,
    pageCount: 0,
    currentPage: 0,
    singleWidth: 490,
    singleHeight: 700,
    aspectRatio: 1.414,
    
    // Auto Play: stays paused on cover until curtain moves
    isPlaying: false, 
    hasStarted: false,
    intervalMs: 1000, // 1-second page turn requirement
    timerId: null,

    audio: new AudioEngine(),
    renderedPages: new Set(),
    scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5,
  };

  // DOM Elements
  const elements = {
    flipbookContainer: document.getElementById('flipbook-container'),
    viewport: document.getElementById('flipbook-viewport'),
    loadingOverlay: document.getElementById('loading-overlay'),
  };

  async function loadPdfDocument(source) {
    showLoading(true);
    
    stopAutoPlay();
    if (state.pageFlip) {
      try {
        state.pageFlip.destroy();
      } catch (e) {
        console.warn(e);
      }
      state.pageFlip = null;
    }
    elements.flipbookContainer.innerHTML = '';
    elements.flipbookContainer.classList.remove('ready');
    state.renderedPages.clear();

    try {
      const loadingTask = pdfjsLib.getDocument(source);
      state.pdfDoc = await loadingTask.promise;
      state.pageCount = state.pdfDoc.numPages;

      const firstPage = await state.pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      state.aspectRatio = viewport.height / viewport.width;

      calculateBookDimensions();

      for (let i = 1; i <= state.pageCount; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'flip-page';
        pageDiv.id = `flip-page-${i}`;
        
        const isCover = (i === 1 || i === state.pageCount);
        pageDiv.setAttribute('data-density', isCover ? 'hard' : 'soft');
        
        if (i === 1) pageDiv.classList.add('page-cover');
        if (i === state.pageCount) pageDiv.classList.add('page-cover');
        pageDiv.classList.add(i % 2 === 0 ? 'page-left' : 'page-right');

        const shadowOverlay = document.createElement('div');
        shadowOverlay.className = 'page-shadow-overlay';
        pageDiv.appendChild(shadowOverlay);

        const cornerHint = document.createElement('div');
        cornerHint.className = 'page-corner-hint';
        pageDiv.appendChild(cornerHint);

        elements.flipbookContainer.appendChild(pageDiv);
      }

      // Render initial visible pages
      const initialPages = Math.min(state.pageCount, 6);
      for (let p = 1; p <= initialPages; p++) {
        await renderPageToCanvas(p, state.singleWidth, state.singleHeight);
      }

      initializePageFlip();
      showLoading(false);

      // Render remaining pages in background queue
      renderRemainingPagesInBackground(initialPages + 1);

      // Tell parent window flipbook is ready
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'FLIPBOOK_READY' }, '*');
      }

      // If standalone (opened directly in browser without curtains), start after 1s on cover
      if (window.self === window.top) {
        setTimeout(() => {
          if (!state.hasStarted) {
            startFlipbookWhenCurtainMoves();
          }
        }, 1000);
      } else if (state.isPlaying) {
        // If curtain already opened while PDF was loading
        resetAutoPlayTimer();
      }

    } catch (err) {
      console.error('Error loading PDF:', err);
      showLoading(true);
    }
  }

  function calculateBookDimensions() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 768;

    if (isMobile) {
      const maxH = vh * 0.96;
      const maxW = vw * 0.96;
      let w = maxW;
      let h = Math.round(w * state.aspectRatio);
      if (h > maxH) {
        h = maxH;
        w = Math.round(h / state.aspectRatio);
      }
      state.singleWidth = Math.floor(w);
      state.singleHeight = Math.floor(h);
      elements.flipbookContainer.style.width = `${state.singleWidth}px`;
      elements.flipbookContainer.style.height = `${state.singleHeight}px`;
    } else {
      const maxH = vh * 0.96;
      const maxSpreadW = vw * 0.96;

      let h = maxH;
      let w = Math.round(h / state.aspectRatio);

      if (w * 2 > maxSpreadW) {
        w = Math.floor(maxSpreadW / 2);
        h = Math.round(w * state.aspectRatio);
      }

      state.singleWidth = w;
      state.singleHeight = h;

      elements.flipbookContainer.style.width = `${state.singleWidth * 2}px`;
      elements.flipbookContainer.style.height = `${state.singleHeight}px`;
    }
  }

  async function renderPageToCanvas(pageNumber, targetWidth, targetHeight) {
    if (state.renderedPages.has(pageNumber)) return;
    const pageSlot = document.getElementById(`flip-page-${pageNumber}`);
    if (!pageSlot) return;

    try {
      const page = await state.pdfDoc.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });
      
      const fitScale = Math.min(targetWidth / unscaledViewport.width, targetHeight / unscaledViewport.height);
      const renderScale = fitScale * state.scale;
      
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      pageSlot.insertBefore(canvas, pageSlot.firstChild);
      state.renderedPages.add(pageNumber);
    } catch (e) {
      console.error(`Page ${pageNumber} rendering error:`, e);
    }
  }

  async function renderRemainingPagesInBackground(startPage) {
    for (let p = startPage; p <= state.pageCount; p++) {
      if (!state.renderedPages.has(p)) {
        await renderPageToCanvas(p, state.singleWidth, state.singleHeight);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
  }

  function initializePageFlip() {
    const isMobile = window.innerWidth < 768;

    state.pageFlip = new St.PageFlip(elements.flipbookContainer, {
      width: state.singleWidth,
      height: state.singleHeight,
      size: 'fixed',
      minWidth: 260,
      maxWidth: 1400,
      minHeight: 360,
      maxHeight: 1800,
      maxShadowOpacity: 0.55,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: isMobile,
      flippingTime: 1000,
      drawShadow: true,
      startPage: 0,
      useMouseEvents: true,
      swipeDistance: 25,
      clickEventForward: true,
    });

    const pages = elements.flipbookContainer.querySelectorAll('.flip-page');
    state.pageFlip.loadFromHTML(pages);
    elements.flipbookContainer.classList.add('ready');

    state.pageFlip.on('flip', (e) => {
      onPageFlipped(e.data);
    });

    state.pageFlip.on('changeState', (e) => {
      if (e.data === 'user_fold' || e.data === 'fold_corner') {
        clearTimeout(state.timerId);
      } else if (e.data === 'read' && state.isPlaying) {
        resetAutoPlayTimer();
      }
    });

    state.pageFlip.on('init', () => {
      updateBookCentering(0);
    });
  }

  function onPageFlipped(pageIndex) {
    state.currentPage = pageIndex;
    state.audio.playPaperTurn();
    updateBookCentering(pageIndex);

    const isLastPage = pageIndex >= state.pageCount - 1;
    if (isLastPage) {
      stopAutoPlay();
    } else if (state.isPlaying) {
      resetAutoPlayTimer();
    }
  }

  function updateBookCentering(pageIndex) {
    const isMobile = window.innerWidth < 768;
    const total = state.pageCount;

    if (!isMobile) {
      elements.viewport.classList.remove('state-cover', 'state-spread', 'state-back');
      if (pageIndex === 0) {
        elements.viewport.classList.add('state-cover');
      } else if (pageIndex >= total - 1) {
        elements.viewport.classList.add('state-back');
      } else {
        elements.viewport.classList.add('state-spread');
      }
    }
  }

  // ==========================================================================
  // CURTAIN SYNCHRONIZATION: START ONLY AFTER CURTAIN MOVES & FLIP ON ITS OWN
  // ==========================================================================
  function startFlipbookWhenCurtainMoves() {
    state.hasStarted = true;
    state.isPlaying = true;
    
    // Ensure book is on cover first
    if (state.pageFlip && state.currentPage !== 0) {
      try {
        state.pageFlip.flip(0);
      } catch (e) {}
    }

    // Curtain is now completely open: start auto-play page turns
    resetAutoPlayTimer();
  }

  function resetFlipbookBackToCover() {
    state.hasStarted = false;
    stopAutoPlay();
    if (state.pageFlip && state.currentPage !== 0) {
      try {
        state.pageFlip.flip(0);
      } catch (e) {}
    }
  }

  function resetAutoPlayTimer() {
    clearTimeout(state.timerId);
    if (!state.isPlaying) return;

    state.timerId = setTimeout(() => {
      triggerNextPageTurn();
    }, state.intervalMs);
  }

  function stopAutoPlay() {
    state.isPlaying = false;
    clearTimeout(state.timerId);
  }

  function triggerNextPageTurn() {
    if (!state.isPlaying) return;

    if (!state.pageFlip) {
      // If flipbook not initialized yet, retry in 500ms
      clearTimeout(state.timerId);
      state.timerId = setTimeout(triggerNextPageTurn, 500);
      return;
    }
    
    if (state.currentPage >= state.pageCount - 1) {
      stopAutoPlay();
      return;
    }

    try {
      state.pageFlip.flipNext('top');
    } catch (e) {
      console.warn('flipNext failed:', e);
    }

    // Safety watchdog: ensure next turn triggers in 3s even if an event was swallowed
    clearTimeout(state.timerId);
    state.timerId = setTimeout(() => {
      triggerNextPageTurn();
    }, state.intervalMs);
  }

  function restartFlipbook() {
    if (state.pageFlip) {
      try {
        state.pageFlip.flip(0);
      } catch (e) {}
      setTimeout(() => {
        state.isPlaying = true;
        resetAutoPlayTimer();
      }, 600);
    }
  }

  function goToPrev() {
    if (!state.pageFlip) return;
    try {
      state.pageFlip.flipPrev('top');
    } catch (e) {}
    if (state.isPlaying) resetAutoPlayTimer();
  }

  function goToNext() {
    if (!state.pageFlip) return;
    try {
      state.pageFlip.flipNext('top');
    } catch (e) {}
    if (state.isPlaying) resetAutoPlayTimer();
  }

  function showLoading(show) {
    if (elements.loadingOverlay) {
      if (show) {
        elements.loadingOverlay.classList.remove('hidden');
      } else {
        elements.loadingOverlay.classList.add('hidden');
      }
    }
  }

  function setupEventListeners() {
    // Parent window messages: start or reset flipbook
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'START_FLIPBOOK') {
        startFlipbookWhenCurtainMoves();
      } else if (event.data?.type === 'RESET_FLIPBOOK') {
        resetFlipbookBackToCover();
      }
    });

    // Click on page at the end restarts
    window.addEventListener('click', () => {
      if (state.currentPage >= state.pageCount - 1) {
        restartFlipbook();
      }
    });

    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (state.isPlaying) {
            stopAutoPlay();
          } else {
            state.isPlaying = true;
            resetAutoPlayTimer();
          }
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          goToNext();
          break;
        case 'KeyR':
        case 'Home':
          e.preventDefault();
          restartFlipbook();
          break;
        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
          }
          break;
      }
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        calculateBookDimensions();
        if (state.pageFlip) {
          state.pageFlip.update();
          updateBookCentering(state.currentPage);
        }
      }, 200);
    });
  }

  function init() {
    setupEventListeners();
    loadPdfDocument(state.pdfUrl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
