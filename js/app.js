const SUPABASE_URL = 'https://thdozyoqygxanqmssbcr.supabase.co';
const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZG96eW9xeWd4YW5xbXNzYmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjMzNDYsImV4cCI6MjA5Mzg5OTM0Nn0.Fq7DBc3bLAlgNi-b2doKMKzaiqyjROgQSYsHyZRxMis';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;

const FREE_LIMIT = 10;
let currentUser = null;
let userPlan = 'free';
let todayCount = 0;
let messages = [];

async function checkAuth() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (window.location.pathname.includes('login.html') && user) {
    window.location.href = 'index.html'; return;
  }
  if (!window.location.pathname.includes('login.html') &&
      !window.location.pathname.includes('pricing.html') && !user) {
    window.location.href = 'login.html'; return;
  }
  if (user && !window.location.pathname.includes('login.html')) {
    await loadUserState(user);
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

async function loadUserState(user) {
  currentUser = user;
  let { data: profile } = await supabaseClient
    .from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    const { data: newProfile } = await supabaseClient
      .from('profiles')
      .insert({ id: user.id, plan: 'free', daily_count: 0, last_reset: new Date().toDateString() })
      .select().single();
    profile = newProfile;
  }
  const today = new Date().toDateString();
  if (profile && profile.last_reset !== today) {
    await supabaseClient.from('profiles')
      .update({ daily_count: 0, last_reset: today }).eq('id', user.id);
    profile.daily_count = 0;
  }
  userPlan = profile?.plan || 'free';
  todayCount = profile?.daily_count || 0;
  updateUI();
}

function updateUI() {
  const badge = document.getElementById('planBadge');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const limitDisplay = document.getElementById('limitDisplay');
  if (badge) { badge.textContent = userPlan === 'pro' ? 'PRO' : 'FREE'; badge.className = 'plan-badge ' + userPlan; }
  if (upgradeBtn) upgradeBtn.style.display = userPlan === 'pro' ? 'none' : 'inline-block';
  if (limitDisplay) {
    if (userPlan === 'pro') limitDisplay.innerHTML = '<span>∞</span>';
    else limitDisplay.innerHTML = '<span>' + todayCount + '</span>/' + FREE_LIMIT;
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;
  if (userPlan === 'free' && todayCount >= FREE_LIMIT) {
    document.getElementById('limitWarning').style.display = 'block'; return;
  }
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('limitWarning').style.display = 'none';
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.style.display = 'none';
  addMessage('user', text);
  messages.push({ role: 'user', parts: [{ text: text }] });
  const typingId = showTyping();
  try {
    const reply = await callGroq(messages);
    removeTyping(typingId);
    addMessage('ai', reply);
    messages.push({ role: 'model', parts: [{ text: reply }] });
    if (userPlan === 'free') {
      todayCount++;
      await supabaseClient.from('profiles')
        .update({ daily_count: todayCount }).eq('id', currentUser.id);
      updateUI();
      if (todayCount >= FREE_LIMIT) document.getElementById('limitWarning').style.display = 'block';
    }
  } catch (err) {
    removeTyping(typingId);
    addMessage('ai', 'Bir hata olustu. Lutfen tekrar dene.');
  }
  document.getElementById('sendBtn').disabled = false;
}

async function callGroq(msgs) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: msgs, plan: userPlan })
  });
  if (!response.ok) throw new Error('API hatasi');
  const data = await response.json();
  return data.reply;
}

function sendSuggestion(text) {
  document.getElementById('messageInput').value = text;
  sendMessage();
}

function addMessage(role, text) {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  div.className = 'message ' + role;
  div.innerHTML =
    '<div class="avatar">' + (role === 'user' ? 'SEN' : 'PX') + '</div>' +
    '<div class="bubble">' + formatText(text) + '</div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(0,212,255,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;">$1</code>')
    .replace(/\n/g, '<br>');
}

function showTyping() {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  const id = 'typing-' + Date.now();
  div.id = id;
  div.className = 'message ai';
  div.innerHTML = '<div class="avatar">PX</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('messageInput');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }
  checkAuth();
});
