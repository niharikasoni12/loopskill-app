const appContainer = document.getElementById('app-container');

// State
let state = {
    user: null, // The currently logged in user
    profiles: [],
    currentProfileIndex: 0,
    chatWebSocket: null,
    messages: []
};

// Temp state for registration flow
let regState = {
    auth_id: '',
    auth_type: '',
    name: '',
    image: '',
    teach: '',
    learn: ''
};

function generateAvatar(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#8A2BE2'; // Accent color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Text
    ctx.font = 'bold 150px Inter, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const letter = name ? name.charAt(0).toUpperCase() : 'U';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2 + 10);
    
    return canvas.toDataURL('image/png');
}

// View Templates
const templates = {
    splash: `
        <div id="splash-screen">
            <h1 class="logo-text">LoopSkill</h1>
            <button class="glass-button get-started-btn" onclick="app.navigate('loginOptions')">Get Started</button>
        </div>
    `,
    loginOptions: `
        <div class="view active" id="login-options">
            <div style="position: absolute; top: 30px; left: 24px; cursor: pointer; color: white; z-index: 10;" onclick="app.navigate('splash')">
                <i data-lucide="arrow-left"></i>
            </div>
            <h2 class="view-title" style="margin-top: 60px;">Login Options 🔐</h2>
            
            <div id="login-selection">
                <button class="glass-button" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="app.showLoginForm('email')">
                    <i data-lucide="mail"></i> Gmail Login
                </button>
                <button class="glass-button" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="app.showLoginForm('phone')">
                    <i data-lucide="smartphone"></i> Phone Login
                </button>
            </div>

            <div id="email-login-form" class="hidden">
                <input type="email" class="glass-input" id="login-email" placeholder="Enter Gmail">
                <input type="password" class="glass-input" id="login-password" placeholder="Password">
                <button class="glass-button" onclick="app.doLogin('email')">Login</button>
                <div style="text-align: center; margin-top: 25px; color: var(--text-secondary); cursor: pointer;" onclick="app.startRegister('email')">New user? Register with Email</div>
            </div>

            <div id="phone-login-form" class="hidden">
                <input type="tel" class="glass-input" id="login-phone" placeholder="Enter Phone Number">
                <div id="otp-section" class="hidden">
                    <input type="text" class="glass-input" id="login-otp" placeholder="Enter OTP (Use 123456 for test)">
                </div>
                <button class="glass-button" id="phone-action-btn" onclick="app.sendOTP()">Receive OTP</button>
                <div style="text-align: center; margin-top: 25px; color: var(--text-secondary); cursor: pointer;" onclick="app.startRegister('phone')">New user? Register with Phone</div>
            </div>
        </div>
    `,
    profileSetup: `
        <div class="view active" id="profile-setup">
            <div style="position: absolute; top: 30px; left: 24px; cursor: pointer; color: white; z-index: 10;" onclick="app.navigate('loginOptions')">
                <i data-lucide="arrow-left"></i>
            </div>
            <h2 class="view-title">Your Profile</h2>
            <div class="avatar-upload" onclick="document.getElementById('avatar-input').click()" id="avatar-preview" style="background-size: cover; background-position: center; cursor: pointer;">
                <i data-lucide="camera" id="camera-icon"></i>
            </div>
            <input type="file" id="avatar-input" accept="image/*" class="hidden" onchange="app.handleImageUpload(event)">
            <input type="text" class="glass-input" id="setup-name" placeholder="Name">
            <button class="glass-button" onclick="app.saveProfileSetup()" style="margin-top: 20px;">Next</button>
        </div>
    `,
    skillSetup: `
        <div class="view active" id="skill-setup">
            <div style="position: absolute; top: 30px; left: 24px; cursor: pointer; color: white; z-index: 10;" onclick="app.navigate('profileSetup')">
                <i data-lucide="arrow-left"></i>
            </div>
            <h2 class="view-title">Your Skills</h2>
            <div class="glass-card" style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 15px;">Skill You Know (Teach)</h3>
                <input type="text" class="glass-input" id="teach-skill" placeholder="e.g., Python, Guitar">
            </div>
            <div class="glass-card" style="margin-bottom: 30px;">
                <h3 style="margin-bottom: 15px;">Skill You Want to Learn</h3>
                <input type="text" class="glass-input" id="learn-skill" placeholder="e.g., Spanish, UI Design">
            </div>
            <button class="glass-button" onclick="app.submitRegistration()">Submit</button>
        </div>
    `,
    transition: `
        <div id="transition-screen">
            <div class="rocket-icon">🚀</div>
            <div class="rocket-text">Get ready to skill up</div>
        </div>
    `,
    mainHome: `
        <div class="view active" id="main-home">
            <div class="app-header">
                <div class="header-avatar" id="home-my-avatar" onclick="app.navigate('dashboard')" style="background-size: cover; background-position: center;"></div>
                <div class="header-logo">LoopSkill</div>
                <i data-lucide="message-circle" class="header-icon" onclick="app.navigate('chatList')"></i>
            </div>
            <div class="swipe-container" id="swipe-deck">
                <!-- Cards injected here -->
            </div>
            <div class="action-buttons">
                <button class="action-btn btn-reject" onclick="app.swipe('left')"><i data-lucide="x"></i></button>
                <button class="action-btn btn-like" onclick="app.swipe('right')"><i data-lucide="heart"></i></button>
            </div>
        </div>
    `,
    dashboard: `
        <div class="view active" id="dashboard">
            <div class="app-header">
                <i data-lucide="arrow-left" class="header-icon" onclick="app.navigate('mainHome')"></i>
                <div class="header-logo">Profile Dashboard</div>
                <div style="width: 24px;"></div>
            </div>
            <div class="dashboard-header">
                <div class="dashboard-avatar" id="dash-my-avatar" style="background-size: cover; background-position: center;"></div>
                <div class="dashboard-name" id="dash-my-name">My Profile</div>
                <div class="dashboard-stats">12 Friends • 2 Skills</div>
            </div>
            
            <div class="section-title">
                <span>Hobbies</span>
                <i data-lucide="edit-2" style="width: 16px; color: var(--text-secondary);"></i>
            </div>
            <div class="glass-card" style="padding: 15px; margin-bottom: 20px;">
                <span class="skill-badge" style="background: rgba(255,255,255,0.1);">Photography</span>
                <span class="skill-badge" style="background: rgba(255,255,255,0.1);">Gaming</span>
            </div>

            <div class="section-title">
                <span>Posts</span>
                <i data-lucide="plus-circle" style="color: var(--accent);"></i>
            </div>
            <div class="glass-card post-card">
                <div class="post-text">Looking for someone to practice Spanish conversation on weekends! 🇪🇸</div>
                <div style="font-size: 12px; color: var(--text-secondary);">2 days ago</div>
            </div>

            <div style="margin-top: 30px;">
                <button class="glass-button" style="background: var(--glass-bg); color: var(--danger); border: 1px solid var(--glass-border);" onclick="app.logout()">
                    <i data-lucide="log-out" style="display: inline-block; vertical-align: middle; margin-right: 8px; width: 18px;"></i> Logout
                </button>
            </div>
        </div>
    `,
    chatList: `
        <div class="view active" id="chat-list">
            <div class="app-header">
                <i data-lucide="arrow-left" class="header-icon" onclick="app.navigate('mainHome')"></i>
                <div class="header-logo">Messages</div>
                <div style="width: 24px;"></div>
            </div>
            <div style="margin-top: 10px;">
                <div class="glass-card" style="padding: 15px; display: flex; align-items: center; gap: 15px; margin-bottom: 10px; cursor: pointer;" onclick="app.navigate('chat')">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: #ccc; background-image: url('https://i.pravatar.cc/300?u=2'); background-size: cover;"></div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">Alex</div>
                        <div style="color: var(--text-secondary); font-size: 14px;">Hey, when can we start Python?</div>
                    </div>
                </div>
            </div>
        </div>
    `,
    chat: `
        <div class="view active" id="chat">
            <div class="app-header" style="border-bottom: 1px solid var(--glass-border); margin-bottom: 15px;">
                <i data-lucide="arrow-left" class="header-icon" onclick="app.navigate('chatList')"></i>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #ccc; background-image: url('https://i.pravatar.cc/300?u=2'); background-size: cover;"></div>
                    <div class="header-logo" style="font-size: 16px;">Alex</div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <i data-lucide="phone" class="header-icon" style="width: 20px;"></i>
                    <i data-lucide="video" class="header-icon" style="width: 20px;"></i>
                </div>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="message received">Hi! I saw you want to learn Guitar.</div>
                <div class="message sent">Yes! I can teach you Python in exchange.</div>
            </div>
            <div class="chat-input-area">
                <input type="text" class="glass-input chat-input" id="chat-input-field" placeholder="Type a message..." onkeypress="if(event.key === 'Enter') app.sendMessage()">
                <button class="send-btn" onclick="app.sendMessage()"><i data-lucide="send" style="width: 20px; margin-left: -2px;"></i></button>
            </div>
        </div>
    `
};

const app = {
    init: () => {
        // If user already logged in (session mock), go straight home
        if (state.user) {
            app.navigate('mainHome');
        } else {
            app.navigate('splash');
        }
    },

    navigate: (viewName) => {
        appContainer.innerHTML = templates[viewName];
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        if (viewName === 'mainHome') {
            app.fetchProfiles();
            const avatarDiv = document.getElementById('home-my-avatar');
            if(avatarDiv && state.user && state.user.image) {
                avatarDiv.style.backgroundImage = `url('${state.user.image}')`;
            }
        }
        if (viewName === 'dashboard') {
            const avatarDiv = document.getElementById('dash-my-avatar');
            const nameDiv = document.getElementById('dash-my-name');
            if(avatarDiv && state.user && state.user.image) {
                avatarDiv.style.backgroundImage = `url('${state.user.image}')`;
            }
            if(nameDiv && state.user && state.user.name) {
                nameDiv.textContent = state.user.name;
            }
        }
        if (viewName === 'chat') {
            app.setupWebSocket();
            const msgList = document.getElementById('chat-messages');
            if(msgList) msgList.scrollTop = msgList.scrollHeight;
        }
    },

    // --- Authentication Flow ---
    showLoginForm: (type) => {
        document.getElementById('login-selection').classList.add('hidden');
        if (type === 'email') {
            document.getElementById('email-login-form').classList.remove('hidden');
        } else {
            document.getElementById('phone-login-form').classList.remove('hidden');
        }
    },

    startRegister: (type) => {
        const inputId = type === 'email' ? 'login-email' : 'login-phone';
        const val = document.getElementById(inputId).value;
        if (!val) return alert('Please enter your ' + type + ' first to register!');
        
        regState.auth_type = type;
        regState.auth_id = val;
        app.navigate('profileSetup');
    },

    sendOTP: () => {
        document.getElementById('otp-section').classList.remove('hidden');
        document.getElementById('phone-action-btn').textContent = "Login";
        document.getElementById('phone-action-btn').onclick = () => app.doLogin('phone');
    },

    doLogin: async (type) => {
        const payload = {
            auth_type: type,
            auth_id: type === 'email' ? document.getElementById('login-email').value : document.getElementById('login-phone').value,
            password: type === 'email' ? document.getElementById('login-password').value : null,
            otp: type === 'phone' ? document.getElementById('login-otp').value : null
        };

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                state.user = await res.json();
                app.navigate('mainHome');
            } else {
                const err = await res.json();
                alert(err.detail || 'Login failed');
            }
        } catch (e) {
            console.error(e);
            alert("Network error");
        }
    },

    logout: () => {
        state.user = null;
        app.navigate('splash');
    },

    // --- Profile Setup & Registration ---
    handleImageUpload: (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                regState.image = e.target.result;
                const preview = document.getElementById('avatar-preview');
                preview.style.backgroundImage = `url('${regState.image}')`;
                document.getElementById('camera-icon').style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    },

    saveProfileSetup: () => {
        const name = document.getElementById('setup-name').value;
        if (!name) return alert('Please enter your name');
        regState.name = name;
        
        // If user didn't upload an image, generate a letter avatar!
        if (!regState.image) {
            regState.image = generateAvatar(name);
        }
        
        app.navigate('skillSetup');
    },

    submitRegistration: async () => {
        const teach = document.getElementById('teach-skill').value;
        const learn = document.getElementById('learn-skill').value;
        if(!teach || !learn) return alert("Please fill both skills");
        
        regState.teach = teach;
        regState.learn = learn;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(regState)
            });
            if (res.ok) {
                state.user = await res.json();
                app.startTransition();
            } else {
                alert("Registration failed");
            }
        } catch (e) {
            console.error(e);
            alert("Network error");
        }
    },

    startTransition: () => {
        appContainer.innerHTML = templates.transition;
        const screen = document.getElementById('transition-screen');
        screen.style.display = 'flex';
        
        // Trigger animation
        setTimeout(() => {
            screen.classList.add('rocket-animate');
        }, 100);

        setTimeout(() => {
            app.navigate('mainHome');
        }, 2200);
    },

    // --- Real Database Data Fetch ---
    fetchProfiles: async () => {
        try {
            const res = await fetch('/api/users/profiles');
            let allProfiles = await res.json();
            // Filter out the current user so they don't swipe on themselves
            if(state.user) {
                allProfiles = allProfiles.filter(p => p.id !== state.user.user_id);
            }
            state.profiles = allProfiles;
            state.currentProfileIndex = 0;
            app.renderDeck();
        } catch (e) {
            console.error("Could not fetch profiles", e);
        }
    },

    renderDeck: () => {
        const deck = document.getElementById('swipe-deck');
        if (!deck) return;
        deck.innerHTML = '';
        
        if (state.currentProfileIndex >= state.profiles.length) {
            deck.innerHTML = '<div style="color: var(--text-secondary); text-align: center;">No more profiles right now.<br>Check back later!</div>';
            return;
        }

        const profile = state.profiles[state.currentProfileIndex];
        const cardHTML = `
            <div class="swipe-card" id="current-card" style="background-image: url('${profile.image}')">
                <div class="swipe-card-content">
                    <div class="card-name">${profile.name}</div>
                    <div class="card-skills">
                        <span class="skill-badge teach-badge">Teaches: ${profile.teach}</span>
                        <span class="skill-badge learn-badge">Wants: ${profile.learn}</span>
                    </div>
                    <div style="font-size: 14px; margin-top: 10px; color: #ddd;">
                        <i data-lucide="book-open" style="width: 14px; display: inline-block; vertical-align: middle;"></i> ${(profile.hobbies && profile.hobbies.length > 0) ? profile.hobbies.join(', ') : 'General Hobbies'}
                    </div>
                </div>
            </div>
        `;
        deck.innerHTML = cardHTML;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    swipe: (direction) => {
        const card = document.getElementById('current-card');
        if (!card) return;
        
        if (direction === 'left') {
            card.classList.add('slide-left');
        } else {
            card.classList.add('slide-right');
        }

        setTimeout(() => {
            state.currentProfileIndex++;
            app.renderDeck();
        }, 300);
    },

    setupWebSocket: () => {
        if (!state.chatWebSocket || state.chatWebSocket.readyState !== WebSocket.OPEN) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use the real user id if logged in
            const cid = state.user ? state.user.user_id : Math.floor(Math.random() * 1000).toString();
            state.chatWebSocket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${cid}`);
            
            state.chatWebSocket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                const msgList = document.getElementById('chat-messages');
                if (msgList) {
                    const msgDiv = document.createElement('div');
                    msgDiv.className = `message ${data.client_id == cid ? 'sent' : 'received'}`;
                    msgDiv.textContent = data.message;
                    msgList.appendChild(msgDiv);
                    msgList.scrollTop = msgList.scrollHeight;
                }
            };
        }
    },

    sendMessage: () => {
        const input = document.getElementById('chat-input-field');
        if (input && input.value.trim() !== '') {
            if (state.chatWebSocket && state.chatWebSocket.readyState === WebSocket.OPEN) {
                state.chatWebSocket.send(input.value);
                input.value = '';
            } else {
                console.warn('WebSocket not connected');
            }
        }
    }
};

window.onload = app.init;
