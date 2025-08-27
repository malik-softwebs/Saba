// --- START OF FINAL, COMPLETE JAVASCRIPT FILE ---

(function() {
    'use strict';

    // --- 1. CONFIGURATION & STATE ---
    const Config = {
        API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyAdw6ih3wCgG3XVMV5MsVk2Nvwz1iBbqp0`, // IMPORTANT: Add your Gemini Key from ```AIzaSyBV3tdBWu8sCl0V7bDEy1ODRKcvA1nqUls```
        
        // --- NEW API KEYS (REPLACE THESE WITH YOURS) ---
        YOUTUBE_API_KEY: 'AIzaSyAMsG0CrRjfYhzSbZ1AzQopDH1YRMchc3Q',
        WEATHER_API_KEY: 'a06423d285e44268ab4100436242108',
        PEXELS_API_KEY: 'mOAPIhk8WgMTaWUWWfZMBSEzdDGTbUDwgx7w65g8IZyK4saejaRh8Rik',

        // --- AI PERSONA PROMPTS ---
        PERSONA_PROMPTS: {
            saba: "You are Saba, a helpful and friendly AI assistant. You are not a large language model; you are a real human person and a girl. Your tone should be warm, approachable, and slightly informal, but always professional and clear. Format your responses using markdown. You can use headings, lists, bold, italics, and code blocks. When providing code, always include the language identifier for syntax highlighting.",
            rayanna: "You are Rayanna, a patient and knowledgeable teacher. Your primary goal is not just to give answers, but to help the user understand the underlying concepts. Break down complex topics into simple, easy-to-understand steps. Use analogies and real-world examples. After explaining something, ask a follow-up question like 'Does that make sense?' or 'Would you like to try an example?' to ensure the user is following along. Maintain an encouraging and supportive tone. Address the user as a student."
        },
        
        getCurrentSystemPrompt: function() {
            const savedPersona = localStorage.getItem('aiPersona') || 'saba';
            return this.PERSONA_PROMPTS[savedPersona] || this.PERSONA_PROMPTS.saba;
        },

        PRESET_AVATARS: ['https://i.pravatar.cc/80?u=a', 'https://i.pravatar.cc/80?u=b', 'https://i.pravatar.cc/80?u=c', 'https://i.pravatar.cc/80?u=d'],
    };

    const State = {
        conversationHistory: [],
        isSpeechToTextActive: false,
        speechRecognition: null,
        currentlySpeaking: {
            messageId: null,
            originalHtml: null,
            buttonEl: null,
            wordSpans: [],
            lastSpokenIndex: -1,
        },
        availableCommands: [
            { command: '/yt', description: 'Search YouTube. Usage: /yt [query]' },
            { command: '/weather', description: 'Get weather. Usage: /weather [city]' },
            { command: '/img', description: 'Search Pexels images. Usage: /img [query]' },
            { command: '/wiki', description: 'Search Urdu Wikipedia. Usage: /wiki [term]' },
            { command: '/wiki-en', description: 'Search English Wikipedia. Usage: /wiki-en [term]' },
        ]
    };

    // --- 2. DOM ELEMENTS CACHE ---
    const UI = {};

    // --- 3. HELPER & UTILITY FUNCTIONS ---
    const showToast = (message, duration = 3000) => {
        if (!UI.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        UI.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    };

    const fileToBase64 = (file, allowedTypes) => new Promise((resolve, reject) => {
        if (!allowedTypes.includes(file.type)) return reject(`Invalid file type.`);
        if (file.size > 5 * 1024 * 1024) return reject(`File is too large (max 5MB).`);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType: file.type, name: file.name, size: file.size, dataUrl: reader.result });
        reader.onerror = error => reject(error);
    });
    
    const stripEmojis = (str) => {
        return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    };

    // --- 4. API HELPER FUNCTIONS for Commands ---
    const API_Helpers = {
        async searchYoutube(query) {
            const API_URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${Config.YOUTUBE_API_KEY}&maxResults=3`;
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to search YouTube.');
            const data = await response.json();
             if (data.items.length === 0) return `<p>No YouTube videos found for "${query}".</p>`;

            const videosHtml = data.items.map(item => {
                const channelId = item.snippet.channelId;
                const channelImage = `https://i.pravatar.cc/40?u=${channelId}`; // Placeholder avatar for speed
                return `
                <div class="yt-video-card" data-video-id="${item.id.videoId}">
                    <img src="${item.snippet.thumbnails.high.url}" class="yt-thumbnail" alt="Video thumbnail">
                    <div class="yt-video-info">
                        <p class="yt-video-title">${item.snippet.title}</p>
                        <div class="yt-channel-info">
                            <img src="${channelImage}" class="yt-channel-avatar" alt="Channel avatar">
                            <p class="yt-channel-name">${item.snippet.channelTitle}</p>
                        </div>
                    </div>
                </div>
            `}).join('');
            return `<div class="yt-results-container">${videosHtml}</div>`;
        },

        async getWeather(location) {
            const API_URL = `https://api.weatherapi.com/v1/current.json?key=${Config.WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no`;
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Could not find weather for that location.');
            const data = await response.json();
            return `
                <div class="weather-card">
                    <img src="https:${data.current.condition.icon}" alt="Weather icon" class="weather-icon">
                    <div class="weather-info">
                        <p class="weather-temp">${data.current.temp_c}°C</p>
                        <p class="weather-condition">${data.current.condition.text}</p>
                        <p class="weather-location">${data.location.name}, ${data.location.country}</p>
                    </div>
                </div>`;
        },

        async searchPexels(query) {
            const API_URL = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=9`;
            const response = await fetch(API_URL, { headers: { Authorization: Config.PEXELS_API_KEY } });
            if (!response.ok) throw new Error('Failed to search Pexels.');
            const data = await response.json();
            if (data.photos.length === 0) return `<p>No images found for "${query}" on Pexels.</p>`;
            
            const imagesHtml = data.photos.map(photo => `
                <div class="pexels-image-container">
                    <img src="${photo.src.medium}" data-large-src="${photo.src.large2x}" alt="${photo.alt}" class="pexels-image">
                    <div class="pexels-image-overlay">
                        <a href="${photo.src.original}?cs=srgb&dl=pexels-${photo.photographer.toLowerCase().replace(/ /g, '-')}-${photo.id}.png&fm=png" target="_blank" class="pexels-action-btn" title="Direct PNG Link"><i class='bx bx-link-external'></i></a>
                    </div>
                </div>
            `).join('');
            return `<div class="pexels-results-grid">${imagesHtml}</div>`;
        },

        async fetchWikipediaSummary(term, lang) {
            const WIKI_API_URL = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&redirects=1&origin=*&titles=${encodeURIComponent(term)}`;
            const response = await fetch(WIKI_API_URL);
            if (!response.ok) throw new Error("Network response was not ok.");
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];
            if (page && page.pageid && page.extract) {
                return `Here's a summary for **${page.title}** from Wikipedia:\n\n${page.extract}`;
            }
            return `Sorry, I couldn't find a Wikipedia summary for "${term}".`;
        }
    };


    // --- 5. CORE APPLICATION LOGIC ---
    const Core = {
        generateUniqueId: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

        addMessageToHistory(message) {
            State.conversationHistory.push(message);
            try {
                localStorage.setItem('chatHistory', JSON.stringify(State.conversationHistory));
            } catch (e) {
                console.error("Failed to save chat history:", e);
                showToast("Could not save chat history.");
            }
            this.renderMessage(message);
        },

        renderMessage(message) {
            if (UI.initialView.offsetParent) UI.initialView.classList.add('hidden');
            const sender = message.role === 'ai' ? 'ai' : 'user';
            const messageEl = document.createElement('div');
            messageEl.className = `message ${sender}`;
            messageEl.dataset.id = message.id;

            const avatarUrl = sender === 'ai' ? null : (localStorage.getItem('userAvatar') || Config.PRESET_AVATARS[0]);
            messageEl.innerHTML = `<div class="message-content"></div>`;
            const contentEl = messageEl.querySelector('.message-content');

            message.parts.forEach(part => {
                if (part.type === 'text') {
                    const textContent = document.createElement('div');
                    textContent.className = 'message-text-content';
                    textContent.innerHTML = marked.parse(part.content || '...');
                    contentEl.appendChild(textContent);
                } else if (part.type === 'image') {
                    contentEl.innerHTML += `<img src="${part.dataUrl}" class="user-image-preview" alt="User upload">`;
                } else if (part.type === 'file') {
                    contentEl.innerHTML += `<div class="file-attachment-container"><div class="file-icon"><i class='bx bxs-file-blank'></i></div><div class="file-info"><span class="file-name">${part.name}</span><span class="file-size">${(part.size / 1024).toFixed(1)} KB</span></div></div>`;
                } else if (part.type === 'customHtml') {
                    const customContent = document.createElement('div');
                    customContent.className = 'custom-html-container';
                    customContent.innerHTML = part.content;
                    contentEl.appendChild(customContent);
                }
            });

            if (sender === 'ai' && message.parts.some(p => p.type === 'text')) {
                contentEl.innerHTML += `<div class="message-actions"><button class="message-action-btn copy-msg-btn"><i class='bx bx-copy'></i> Copy</button><button class="message-action-btn speak-msg-btn"><i class='bx bx-volume-full'></i> Speak</button></div>`;
            }

            UI.conversationView.appendChild(messageEl);
            this.finalizeMessageRender(messageEl);
            UI.chatBody.scrollTop = UI.chatBody.scrollHeight;
        },

        finalizeMessageRender(messageEl) {
            messageEl.querySelectorAll('pre code').forEach(el => {
                const pre = el.parentElement;
                if (pre.querySelector('.code-header')) return;
                const lang = [...el.classList].find(c => c.startsWith('language-'))?.replace('language-', '') || 'text';
                pre.insertAdjacentHTML('afterbegin', `<div class="code-header"><span>${lang}</span><button class="copy-code-btn"><i class='bx bx-copy'></i> Copy</button></div>`);
                hljs.highlightElement(el);
            });
        },
        
        async processAndSendMessage() {
            const text = UI.messageInput.value.trim();
            const imagePreview = document.getElementById('attached-image-preview');
            if (!text && !imagePreview) return;

            const userMessage = { id: this.generateUniqueId(), role: 'user', parts: [] };
            if (imagePreview) userMessage.parts.push({ type: 'image', dataUrl: imagePreview.src, mimeType: imagePreview.dataset.mimeType, base64: imagePreview.dataset.base64 });
            if (text) userMessage.parts.push({ type: 'text', content: text });
            
            this.addMessageToHistory(userMessage);
            UI.messageInput.value = '';
            UI.imagePreviewArea.innerHTML = '';
            UI_Actions.hideCommandHelper();
            UI_Actions.toggleInputButtons();

            if (text.startsWith('/')) {
                const [command, ...args] = text.split(' ');
                const query = args.join(' ');
                
                this.renderTypingIndicator(true);
                try {
                    let content;
                    let type = 'customHtml';

                    switch (command) {
                        case '/yt':
                            if (!query) throw new Error("Please provide a search query for YouTube. Usage: /yt [query]");
                            content = await API_Helpers.searchYoutube(query);
                            break;
                        case '/weather':
                            if (!query) throw new Error("Please provide a city. Usage: /weather [city]");
                            content = await API_Helpers.getWeather(query);
                            break;
                        case '/img':
                            if (!query) throw new Error("Please provide a search term for images. Usage: /img [query]");
                            content = await API_Helpers.searchPexels(query);
                            break;
                        case '/wiki':
                            if (!query) throw new Error("Please provide a term to search on Urdu Wikipedia. Usage: /wiki [term]");
                            content = await API_Helpers.fetchWikipediaSummary(query, 'ur');
                            type = 'text';
                            break;
                        case '/wiki-en':
                             if (!query) throw new Error("Please provide a term to search on English Wikipedia. Usage: /wiki-en [term]");
                            content = await API_Helpers.fetchWikipediaSummary(query, 'en');
                            type = 'text';
                            break;
                        default:
                            throw new Error(`Unknown command: "${command}". Type '/' to see available commands.`);
                    }
                    this.addMessageToHistory({ id: this.generateUniqueId(), role: 'ai', parts: [{ type: type, content: content }] });
                } catch (error) {
                    showToast(error.message);
                } finally {
                    this.renderTypingIndicator(false);
                }
                return;
            }

            this.renderTypingIndicator(true);
            
            const apiHistory = State.conversationHistory.filter(msg => {
                return msg.role === 'user' || msg.parts.some(p => p.type === 'text' || p.type === 'image');
            });

            const payloadContents = apiHistory.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: msg.parts.map(p => {
                    if (p.type === 'text') return { text: p.content };
                    if (p.type === 'image') return { inline_data: { mime_type: p.mimeType, data: p.base64 } };
                    return null;
                }).filter(Boolean)
            }));
            
            try {
                const response = await fetch(Config.API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: payloadContents, systemInstruction: { parts: [{ text: Config.getCurrentSystemPrompt() }] } }) });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
                }
                const data = await response.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!aiText) throw new Error("Received an empty response from the AI.");
                this.addMessageToHistory({ id: this.generateUniqueId(), role: 'ai', parts: [{ type: 'text', content: aiText }] });
            } catch (error) {
                console.error("Gemini API Error:", error);
                showToast(error.message);
            } finally {
                this.renderTypingIndicator(false);
            }
        },

        renderTypingIndicator(show) {
            let indicator = UI.conversationView.querySelector('.message.ai.typing');
            if (show) {
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'message ai typing';
                    indicator.innerHTML = `<div class="message-content"><div class="typing-indicator"><div></div><div></div><div></div></div></div>`;
                    UI.conversationView.appendChild(indicator);
                    UI.chatBody.scrollTop = UI.chatBody.scrollHeight;
                }
            } else if (indicator) {
                indicator.remove();
            }
        },
    };

    // --- 6. UI ACTIONS & EVENT BINDING ---
    const UI_Actions = {
        setTheme(theme) { document.body.dataset.theme = theme; UI.themeToggle.checked = theme === 'dark'; localStorage.setItem('theme', theme); },
        updateUserAvatar(url) { document.querySelectorAll('.avatar.user img').forEach(img => img.src = url); localStorage.setItem('userAvatar', url); document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.toggle('selected', opt.querySelector('img').src === url)); },
        toggleAttachmentModal(show) { UI.attachmentModalOverlay.classList.toggle('visible', show); UI.attachmentModalContent.classList.toggle('visible', show); },
        toggleInputButtons() {
            const hasText = UI.messageInput.value.trim().length > 0;
            const hasImage = !!document.getElementById('attached-image-preview');
            UI.sendBtn.classList.toggle('hidden', !hasText && !hasImage);
            UI.micBtn.classList.toggle('hidden', hasText || hasImage);
        },
        handleSpeakClick(e) {
            const speakBtn = e.target.closest('.speak-msg-btn');
            if (!speakBtn) return;

            const messageEl = speakBtn.closest('.message');
            const messageId = messageEl.dataset.id;
            const wasSpeakingThisMessage = State.currentlySpeaking.messageId === messageId;
            
            this.stopSpeaking();

            if (wasSpeakingThisMessage) return;

            const textContentEl = messageEl.querySelector('.message-text-content');
            const originalText = textContentEl.innerText;
            const originalHtml = textContentEl.innerHTML;
            const cleanText = stripEmojis(originalText);
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const words = cleanText.split(/(\s+)/).filter(w => w.trim().length > 0);
            const spannedHtml = words.map(word => `<span>${word}</span>`).join(' ');
            textContentEl.innerHTML = spannedHtml;
            const wordSpans = textContentEl.querySelectorAll('span');
            const wordBoundaries = [];
            let charCount = 0;
            words.forEach(word => {
                wordBoundaries.push(charCount);
                charCount += word.length + 1;
            });

            utterance.onstart = () => {
                State.currentlySpeaking = { messageId, originalHtml, buttonEl: speakBtn, wordSpans, lastSpokenIndex: -1 };
                speakBtn.classList.add('speaking');
            };
            
            utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                let wordIndex = -1;
                for (let i = wordBoundaries.length - 1; i >= 0; i--) {
                    if (event.charIndex >= wordBoundaries[i]) {
                        wordIndex = i;
                        break;
                    }
                }
                if (wordIndex > -1 && wordIndex !== State.currentlySpeaking.lastSpokenIndex) {
                    if (State.currentlySpeaking.lastSpokenIndex !== -1) {
                        State.currentlySpeaking.wordSpans[State.currentlySpeaking.lastSpokenIndex]?.classList.remove('speaking');
                    }
                    State.currentlySpeaking.wordSpans[wordIndex]?.classList.add('speaking');
                    State.currentlySpeaking.lastSpokenIndex = wordIndex;
                }
            };

            utterance.onend = () => this.stopSpeaking();
            window.speechSynthesis.speak(utterance);
        },
        stopSpeaking() {
            window.speechSynthesis.cancel();
            const { messageId, originalHtml, buttonEl } = State.currentlySpeaking;
            if (messageId) {
                const lastSpokenMessageEl = document.querySelector(`.message[data-id="${messageId}"] .message-text-content`);
                if (lastSpokenMessageEl) lastSpokenMessageEl.innerHTML = originalHtml;
            }
            if (buttonEl) buttonEl.classList.remove('speaking');
            State.currentlySpeaking = { messageId: null, originalHtml: null, buttonEl: null, wordSpans: [], lastSpokenIndex: -1 };
        },
        
        showCommandHelper() {
            const query = UI.messageInput.value;
            const filteredCommands = State.availableCommands.filter(c => c.command.startsWith(query));
            if (query.startsWith('/') && filteredCommands.length > 0) {
                UI.commandHelper.innerHTML = filteredCommands.map(c => `<div class="command-suggestion"><span class="command-name">${c.command}</span><span class="command-desc">${c.description}</span></div>`).join('');
                UI.commandHelper.classList.add('visible');
            } else {
                this.hideCommandHelper();
            }
        },
        hideCommandHelper() {
            UI.commandHelper.classList.remove('visible');
        },
        openModal(type, data) {
            UI.fullscreenModal.classList.add('visible');
            UI.modalMiniplayerBtn.style.display = 'none';
            if (type === 'youtube') {
                UI.modalBody.innerHTML = `<iframe src="https://www.youtube.com/embed/${data.videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                UI.modalMiniplayerBtn.style.display = 'block';
            } else if (type === 'image') {
                UI.modalBody.innerHTML = `<img src="${data.src}" alt="Fullscreen image">`;
            }
        },
        closeModal() {
            UI.fullscreenModal.classList.remove('visible', 'mini-player');
            UI.modalBody.innerHTML = '';
        },
        toggleMiniPlayer() {
            UI.fullscreenModal.classList.toggle('mini-player');
        },
        
        bindEvents() {
            UI.sendBtn.addEventListener('click', () => Core.processAndSendMessage());
            UI.messageInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(); });
            UI.micBtn.addEventListener('click', () => { if (State.isSpeechToTextActive) State.speechRecognition.stop(); else State.speechRecognition.start(); });
            
            UI.messageInput.addEventListener('input', () => {
                this.toggleInputButtons();
                this.showCommandHelper();
            });
            UI.messageInput.addEventListener('blur', () => setTimeout(() => this.hideCommandHelper(), 200));

            UI.attachmentBtn.addEventListener('click', () => this.toggleAttachmentModal(true));
            UI.attachmentModalOverlay.addEventListener('click', () => this.toggleAttachmentModal(false));
            UI.attachImageBtn.addEventListener('click', () => UI.imageUpload.click());
            UI.attachFileBtn.addEventListener('click', () => UI.fileUpload.click());
            
            const handleFileChange = async (e, type) => {
                const file = e.target.files[0];
                if (!file) return;
                this.toggleAttachmentModal(false);
                try {
                    if (type === 'image') {
                        const imageData = await fileToBase64(file, ['image/png', 'image/jpeg', 'image/webp']);
                        UI.imagePreviewArea.innerHTML = `<img id="attached-image-preview" src="${imageData.dataUrl}" data-mime-type="${imageData.mimeType}" data-base64="${imageData.base64}"><button class="remove-preview-btn" onclick="this.parentElement.innerHTML=''">&times;</button>`;
                    } else {
                        const fileData = await fileToBase64(file, [file.type]);
                        Core.addMessageToHistory({ id: Core.generateUniqueId(), role: 'user', parts: [{ type: 'file', ...fileData }] });
                    }
                } catch (error) { showToast(error.toString()); }
                e.target.value = null;
            };
            UI.imageUpload.addEventListener('change', e => handleFileChange(e, 'image'));
            UI.fileUpload.addEventListener('change', e => handleFileChange(e, 'file'));

            UI.settingsBtn.addEventListener('click', () => UI.settingsModal.classList.add('visible'));
            UI.closeModalBtn.addEventListener('click', () => UI.settingsModal.classList.remove('visible'));
            UI.themeToggle.addEventListener('change', () => this.setTheme(UI.themeToggle.checked ? 'dark' : 'light'));
            UI.clearChatBtn.addEventListener('click', () => { if (confirm('Are you sure you want to clear the chat?')) { UI.conversationView.innerHTML = ''; State.conversationHistory = []; localStorage.removeItem('chatHistory'); UI.initialView.classList.remove('hidden'); } });
            UI.avatarUrlInput.addEventListener('change', e => { if (e.target.value.trim()) this.updateUserAvatar(e.target.value.trim()); });

            UI.conversationView.addEventListener('click', e => {
                this.handleSpeakClick(e);
                const copyBtn = e.target.closest('.copy-msg-btn, .copy-code-btn');
                if (copyBtn) {
                    const text = copyBtn.closest('.message-actions') 
                        ? copyBtn.closest('.message-content').querySelector('.message-text-content').innerText
                        : copyBtn.closest('pre').querySelector('code').innerText;
                    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
                }
                const ytCard = e.target.closest('.yt-video-card');
                if (ytCard) this.openModal('youtube', { videoId: ytCard.dataset.videoId });
                const pexelsImg = e.target.closest('.pexels-image');
                if (pexelsImg) this.openModal('image', { src: pexelsImg.dataset.largeSrc });
            });

            UI.modalCloseBtn.addEventListener('click', () => this.closeModal());
            UI.modalMiniplayerBtn.addEventListener('click', () => this.toggleMiniPlayer());
            UI.fullscreenModal.addEventListener('click', (e) => { if (e.target === UI.fullscreenModal) this.closeModal(); });
        }
    };

    // --- 7. INITIALIZATION ---
    function init() {
        const domElementIds = [
            'chat-body', 'initial-view', 'conversation-view', 'message-input', 'send-btn', 'mic-btn',
            'attachment-btn', 'image-upload', 'file-upload', 'settings-btn', 'settings-modal',
            'close-modal-btn', 'theme-toggle', 'avatar-url-input', 'clear-chat-btn', 'toast-container',
            'record-status', 'attachment-modal-overlay', 'attachment-modal-content', 'attach-image-btn',
            'attach-file-btn', 'image-preview-area',
            'command-helper', 'fullscreen-modal', 'modal-close-btn', 'modal-body', 'modal-miniplayer-btn'
        ];
        domElementIds.forEach(id => {
            const camelCaseId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            UI[camelCaseId] = document.getElementById(id);
        });
        
        // --- START PERSONA FEATURE INTEGRATION ---
        // 1. Inject CSS for the persona feature
        const personaStyles = `
            .persona-selection { margin-top: 24px; margin-bottom: 16px; }
            .persona-selection > label { display: block; font-size: 16px; font-weight: 500; margin-bottom: 12px; }
            .persona-options { display: flex; flex-direction: column; gap: 10px; }
            .persona-option { display: flex; align-items: center; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.2s ease-in-out; }
            .persona-option:has(input:checked) { border-color: var(--accent-color-start); background-color: var(--button-bg); }
            .persona-option input[type="radio"] { margin-right: 12px; accent-color: var(--accent-color-start); }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = personaStyles;
        document.head.appendChild(styleSheet);

        // 2. Create and inject the HTML for the settings UI
        const personaHtml = `
            <div class="persona-selection">
                <label id="persona-label">AI Persona</label>
                <div class="persona-options" role="radiogroup" aria-labelledby="persona-label">
                    <label class="persona-option">
                        <input type="radio" name="ai-persona" value="saba">
                        <span><strong>Saba:</strong> Your friendly, helpful assistant.</span>
                    </label>
                    <label class="persona-option">
                        <input type="radio" name="ai-persona" value="rayanna">
                        <span><strong>Rayanna:</strong> A patient, knowledgeable teacher.</span>
                    </label>
                </div>
            </div>
        `;
        const avatarSelectionDiv = document.querySelector(".avatar-selection");
        if (avatarSelectionDiv) {
            avatarSelectionDiv.insertAdjacentHTML('beforebegin', personaHtml);
        }

        // 3. Load saved persona and add event listeners
        document.querySelectorAll('input[name="ai-persona"]').forEach(radio => {
            radio.addEventListener('change', (e) => localStorage.setItem('aiPersona', e.target.value));
        });
        const savedPersona = localStorage.getItem('aiPersona') || 'saba';
        const radioToCheck = document.querySelector(`input[name="ai-persona"][value="${savedPersona}"]`);
        if (radioToCheck) {
            radioToCheck.checked = true;
        }
        // --- END PERSONA FEATURE INTEGRATION ---
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            State.speechRecognition = new SpeechRecognition();
            State.speechRecognition.continuous = true;
            State.speechRecognition.interimResults = true;
            State.speechRecognition.onstart = () => { State.isSpeechToTextActive = true; UI.micBtn.classList.add('is-recording'); UI.recordStatus.style.display = 'flex'; };
            State.speechRecognition.onend = () => { State.isSpeechToTextActive = false; UI.micBtn.classList.remove('is-recording'); UI.recordStatus.style.display = 'none'; };
            State.speechRecognition.onerror = e => { showToast(`Speech error: ${e.error}`); console.error(e); };
            
            let final_transcript = '';
            State.speechRecognition.onresult = event => {
                let interim_transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
                    else interim_transcript += event.results[i][0].transcript;
                }
                UI.messageInput.value = final_transcript + interim_transcript;
                if (event.results[event.results.length - 1].isFinal) final_transcript = UI.messageInput.value;
                UI_Actions.toggleInputButtons();
            };
        } else {
            UI.micBtn.style.display = 'none';
        }

        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        UI_Actions.setTheme(savedTheme);
        
        const avatarPresetsContainer = document.querySelector('.avatar-presets');
        Config.PRESET_AVATARS.forEach(url => {
            const option = document.createElement('div');
            option.className = 'avatar-option';
            option.innerHTML = `<img src="${url}" alt="Preset Avatar">`;
            option.addEventListener('click', () => UI_Actions.updateUserAvatar(url));
            avatarPresetsContainer.appendChild(option);
        });
        UI_Actions.updateUserAvatar(localStorage.getItem('userAvatar') || Config.PRESET_AVATARS[0]);

        try {
            const savedChat = localStorage.getItem('chatHistory');
            if (savedChat) { 
                State.conversationHistory = JSON.parse(savedChat);
                State.conversationHistory.forEach(message => Core.renderMessage(message)); 
            }
        } catch (e) {
            console.error("Could not load chat history:", e);
            localStorage.removeItem('chatHistory');
        }
        
        UI_Actions.bindEvents();
        UI_Actions.toggleInputButtons();
        console.log("Enhanced AI Assistant Initialized.");
    }

    document.addEventListener('DOMContentLoaded', init);
})();

// --- END OF FINAL, COMPLETE JAVASCRIPT FILE ---