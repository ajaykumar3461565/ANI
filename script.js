(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  document.body.classList.add('loading');

  // A short opening pause lets the title arrive like a curtain rising.
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      $('.preloader')?.classList.add('done');
      document.body.classList.remove('loading');
    }, reducedMotion ? 0 : 1050);
  }, { once: true });

  const title = $('.name-title');
  if (title) [...title.dataset.title].forEach((letter, index) => {
    const span = document.createElement('span');
    span.textContent = letter;
    span.style.setProperty('--i', index);
    title.append(span);
  });

  // A few restrained, slow-moving lights make the last scene feel alive.
  const endingSky = $('.ending-sky');
  if (endingSky && !reducedMotion) {
    for (let i = 0; i < 22; i++) {
      const mote = document.createElement('i');
      mote.className = 'mote';
      mote.setAttribute('aria-hidden', 'true');
      mote.style.setProperty('--x', `${(i * 47 + 9) % 100}%`);
      mote.style.setProperty('--y', `${(i * 31 + 8) % 100}%`);
      mote.style.setProperty('--delay', `${(i % 8) * -.8}s`);
      mote.style.setProperty('--duration', `${6 + (i % 5)}s`);
      endingSky.append(mote);
    }
  }

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        if (entry.target.matches('.letter-paper')) typeLetter(entry.target);
        if (entry.target.matches('.ending-copy')) $('.ending-section')?.classList.add('entered');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -35px 0px' });
    reveals.forEach((el, i) => {
      if (el.closest('.quality-grid')) el.style.transitionDelay = `${(i % 3) * 90}ms`;
      revealObserver.observe(el);
    });
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
    $('.ending-section')?.classList.add('entered');
    const paper = $('.letter-paper');
    if (paper) typeLetter(paper, true);
  }

  function typeLetter(paper, immediate = false) {
    if (paper.dataset.typed) return;
    paper.dataset.typed = 'true';
    $$('.letter-copy p', paper).forEach((paragraph, paragraphIndex) => {
      const fullText = paragraph.textContent;
      const visual = document.createElement('span');
      visual.className = 'typed-visual';
      visual.setAttribute('aria-hidden', 'true');
      const accessible = document.createElement('span');
      accessible.className = 'sr-only';
      accessible.textContent = fullText;
      paragraph.textContent = '';
      paragraph.append(accessible, visual);
      if (immediate) { visual.textContent = fullText; return; }
      let index = 0;
      const startDelay = 220 + paragraphIndex * 750;
      window.setTimeout(() => {
        const type = () => {
          index = Math.min(index + (index < 30 ? 2 : 3), fullText.length);
          visual.textContent = fullText.slice(0, index);
          if (index < fullText.length) window.setTimeout(type, 18);
        };
        type();
      }, startDelay);
    });
  }

  // Tactile card turns work with a tap, keyboard, and screen reader state.
  $$('.quality-card').forEach(card => card.addEventListener('click', () => {
    const flipped = card.classList.toggle('flipped');
    card.setAttribute('aria-pressed', String(flipped));
    if (flipped && !reducedMotion) sparkle(card);
  }));

  const glow = $('.pointer-glow');
  if (glow && matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    let raf = 0;
    window.addEventListener('pointermove', event => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
        glow.style.opacity = '.8';
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => { glow.style.opacity = '0'; });
  }

  // Small magnetic pull, limited to pointer devices and low travel distance.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', event => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${dx * .08}px, ${dy * .12}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Subtle tilt follows the pointer; mobile remains still for comfort.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.transform = `perspective(1100px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // User-initiated local music player, with a live analyser after playback starts.
  const audio = $('.song-audio');
  const player = $('.player-card');
  const playButton = $('.play-button');
  const seek = $('.seek');
  const durationLabel = $('.duration');
  const currentLabel = $('.current-time');
  const waveform = $('.waveform');
  let audioContext;
  let analyser;
  let animationFrame;
  const bars = [];
  if (waveform) {
    for (let i = 0; i < 24; i++) {
      const bar = document.createElement('i');
      bar.className = 'wave-bar';
      bar.style.setProperty('--bar-h', `${5 + ((i * 11) % 24)}px`);
      bar.style.setProperty('--delay', `${-(i % 9) * .16}s`);
      bar.style.setProperty('--dur', `${.55 + (i % 7) * .1}s`);
      waveform.append(bar);
      bars.push(bar);
    }
  }
  const formatTime = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  };
  const updateTime = () => {
    if (!audio || !seek) return;
    const progress = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
    seek.value = String(progress);
    seek.style.setProperty('--progress', `${progress}%`);
    currentLabel.textContent = formatTime(audio.currentTime);
  };
  function startVisualiser() {
    if (!analyser || !bars.length || animationFrame) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / bars.length));
      bars.forEach((bar, index) => {
        const value = data[index * step] / 255;
        bar.style.transform = `scaleY(${.35 + value * 1.7})`;
        bar.style.opacity = String(.45 + value * .55);
      });
      animationFrame = requestAnimationFrame(draw);
    };
    draw();
  }
  playButton?.addEventListener('click', async () => {
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 128;
          const source = audioContext.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
        }
        if (audioContext.state === 'suspended') await audioContext.resume();
        startVisualiser();
      } catch (error) {
        $('.now-playing').textContent = 'This song could not be opened';
        return;
      }
      player.classList.add('playing');
      playButton.setAttribute('aria-label', 'Pause song');
      $('.now-playing').textContent = 'playing just for you';
      sparkle(playButton);
    } else {
      audio.pause();
      player.classList.remove('playing');
      playButton.setAttribute('aria-label', 'Play song');
      $('.now-playing').textContent = 'paused, whenever you’re ready';
    }
  });
  audio?.addEventListener('loadedmetadata', () => { durationLabel.textContent = formatTime(audio.duration); });
  audio?.addEventListener('timeupdate', updateTime);
  audio?.addEventListener('ended', () => {
    player.classList.remove('playing');
    playButton.setAttribute('aria-label', 'Play song');
    $('.now-playing').textContent = 'a little music for you';
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    bars.forEach(bar => { bar.style.transform = ''; bar.style.opacity = ''; });
  });
  seek?.addEventListener('input', () => {
    if (audio?.duration) audio.currentTime = Number(seek.value) / 100 * audio.duration;
  });
  $('.volume-button')?.addEventListener('click', event => {
    if (!audio) return;
    audio.muted = !audio.muted;
    event.currentTarget.classList.toggle('muted', audio.muted);
    event.currentTarget.setAttribute('aria-label', audio.muted ? 'Unmute song' : 'Mute song');
  });

  function sparkle(target) {
    const rect = target.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('span');
      star.className = 'click-sparkle';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = i % 2 ? '✦' : '♡';
      star.style.left = `${rect.left + rect.width * (.28 + Math.random() * .44)}px`;
      star.style.top = `${rect.top + rect.height * (.3 + Math.random() * .4)}px`;
      star.style.setProperty('--dx', `${(Math.random() - .5) * 70}px`);
      star.style.setProperty('--dy', `${-25 - Math.random() * 45}px`);
      document.body.append(star);
      window.setTimeout(() => star.remove(), 1000);
    }
  }
})();
