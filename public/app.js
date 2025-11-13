const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));


const state = {
authed: false,
profile: { name: 'Your Name', bio: '这里是简介', avatarUrl: '/public/default-avatar.png', backgroundUrl: '' },
links: []
};


async function api(path, opts={}){
const res = await fetch(path, { credentials:'include', headers:{ 'Content-Type':'application/json' }, ...opts });
if(!res.ok){ throw new Error(await res.text()); }
return res.json();
}


async function uploadFile(file){
const fd = new FormData();
fd.append('file', file);
const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
if(!res.ok){ throw new Error(await res.text()); }
return res.json(); // { url }
}


function render(){
$('#profile-name').textContent = state.profile.name || 'YourName';
$('#display-name').textContent = state.profile.name || 'Your Name';
$('#bio').textContent = state.profile.bio || '';
$('#avatar').src = state.profile.avatarUrl || '/public/default-avatar.png';
$('#bg').style.setProperty('--bg', state.profile.backgroundUrl ? `url(${state.profile.backgroundUrl})` : '#f3f4f6');


$('#login-btn').classList.toggle('hidden', state.authed);
$('#user-menu').classList.toggle('hidden', !state.authed);
$('#edit-profile').classList.toggle('hidden', !state.authed);
$('#add-link').classList.toggle('hidden', !state.authed);


const ul = $('#links');
ul.innerHTML = '';
state.links.forEach(link => {
const li = document.createElement('li');
li.className = 'link-item';
li.draggable = state.authed; // 登录后可拖拽
li.dataset.id = link.id;
li.innerHTML = `
<div class="link-left">
<div class="icon">${renderIcon(link.icon)}</div>
load().catch(err=> console.error(err));